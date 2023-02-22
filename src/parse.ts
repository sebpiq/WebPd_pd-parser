/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { CONTROL_TYPE, PdJson } from '@webpd/pd-json'
import { parseFloatToken, ValueError } from './tokens'
import {
    hydrateArray,
    hydrateConnection,
    hydrateNodeArray,
    hydrateNodeBase,
    hydrateNodeControl,
    hydrateNodeGeneric,
    hydrateLineAfterComma,
    hydrateNodePatch,
    hydratePatch,
} from './hydrate'
import tokenize, { Tokens, TokenizedLine } from './tokenize'

type PatchTokenizedLinesMap = { [globalId: string]: Array<TokenizedLine> }

export const nextPatchId = (): string => `${++nextPatchId.counter}`
nextPatchId.counter = -1

export const nextArrayId = (): string => `${++nextArrayId.counter}`
nextArrayId.counter = -1

const NODES = ['obj', 'floatatom', 'symbolatom', 'listbox', 'msg', 'text']

const _tokensMatch = (tokens: Tokens, ...values: Tokens): boolean =>
    values.every((value, i) => value === tokens[i])

/** Parses a Pd file, returns a simplified JSON version */
export default (pdString: PdJson.PdString): PdJson.Pd => {
    let pd: PdJson.Pd = {
        patches: {},
        arrays: {},
    }
    let tokenizedLines = tokenize(pdString)
    let patchTokenizedLinesMap: PatchTokenizedLinesMap = {}
    ;[pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(
        pd,
        true,
        tokenizedLines,
        patchTokenizedLinesMap
    )

    Object.values(pd.patches).forEach((patch) => {
        let patchTokenizedLines = patchTokenizedLinesMap[patch.id]!
        ;[pd, patchTokenizedLines] = parseArrays(pd, patchTokenizedLines)
        ;[patch, patchTokenizedLines] = parseNodesAndConnections(
            patch,
            patchTokenizedLines
        )
        patch = _computePatchPortlets(patch)
        if (patchTokenizedLines.length) {
            throw new ParseError(
                'invalid chunks ' +
                    JSON.stringify(patchTokenizedLines, null, 2),
                patchTokenizedLines[0]!.lineIndex
            )
        }
        pd.patches[patch.id] = patch
    })
    return pd
}

export const parsePatches = (
    pd: PdJson.Pd,
    isPatchRoot: boolean,
    tokenizedLines: Array<TokenizedLine>,
    patchTokenizedLinesMap: { [globalId: string]: Array<TokenizedLine> }
): [
    PdJson.Pd,
    Array<TokenizedLine>,
    { [globalId: string]: Array<TokenizedLine> }
] => {
    pd = {
        patches: { ...pd.patches },
        arrays: { ...pd.arrays },
    }
    tokenizedLines = [...tokenizedLines]
    patchTokenizedLinesMap = { ...patchTokenizedLinesMap }
    const patchId = nextPatchId()
    const patchTokenizedLines: Array<TokenizedLine> = []
    let patchCanvasTokens: TokenizedLine | null = null
    let patchCoordsTokens: TokenizedLine | null = null
    let iterCounter = -1
    let continueIteration = true

    while (tokenizedLines.length && continueIteration) {
        const { tokens, lineIndex } = tokenizedLines[0]!
        if (_tokensMatch(tokens, '#N', 'struct')) {
            console.warn(`"#N struct" chunk is not supported`, lineIndex)
            tokenizedLines.shift()!
            continue
        }

        if (_tokensMatch(tokens, '#X', 'declare')) {
            console.warn(`"#X declare" chunk is not supported`, lineIndex)
            tokenizedLines.shift()!
            continue
        }

        if (_tokensMatch(tokens, '#X', 'scalar')) {
            console.warn(`"#X scalar" chunk is not supported`, lineIndex)
            tokenizedLines.shift()!
            continue
        }

        if (_tokensMatch(tokens, '#X', 'f')) {
            console.warn(`"#X f" chunk is not supported`, lineIndex)
            tokenizedLines.shift()!
            continue
        }

        iterCounter++
        catchParsingErrors(lineIndex, () => {
            // First line of the patch / subpatch, initializes the patch
            if (_tokensMatch(tokens, '#N', 'canvas') && iterCounter === 0) {
                patchCanvasTokens = tokenizedLines.shift()!

                // If not first line, starts a subpatch
            } else if (_tokensMatch(tokens, '#N', 'canvas')) {
                ;[pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(
                    pd,
                    false,
                    tokenizedLines,
                    patchTokenizedLinesMap
                )

                // Table : a table subpatch
                // It seems that a table object is just a subpatch containing an array.
                // Therefore we add some synthetic lines to the tokenized file to simulate
                // this subpatch.
            } else if (
                _tokensMatch(
                    tokens,
                    '#X',
                    'obj',
                    tokens[2]!,
                    tokens[3]!,
                    'table'
                )
            ) {
                const tableTokens = tokenizedLines.shift()!.tokens
                tokenizedLines = [
                    { tokens: ['#N', 'canvas', '0', '0', '100', '100', '(subpatch)', '0'], lineIndex },
                    { tokens: ['#N', 'canvas', '0', '0', '100', '100', '(subpatch)', '0'], lineIndex },
                    { tokens: ['#X', 'array', tableTokens[5]!, tableTokens[6]!, 'float', '0'], lineIndex },
                    { tokens: ['#X', 'restore', '0', '0', 'graph'], lineIndex },
                    { tokens: ['#X', 'restore', tableTokens[2]!, tableTokens[3]!, 'table'], lineIndex },
                    ...tokenizedLines
                ]
                ;[pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(
                    pd,
                    false,
                    tokenizedLines,
                    patchTokenizedLinesMap
                )

                // coords : visual range of framesets
            } else if (_tokensMatch(tokens, '#X', 'coords')) {
                patchCoordsTokens = tokenizedLines.shift()!

                // Restore : ends a canvas definition
            } else if (_tokensMatch(tokens, '#X', 'restore')) {
                // Creates a synthetic node that our parser will hydrate at a later stage
                tokenizedLines[0]!.tokens = [
                    'PATCH',
                    patchId,
                    ...tokenizedLines[0]!.tokens.slice(2),
                ]
                continueIteration = false

                // A normal chunk to add to the current patch
            } else {
                patchTokenizedLines.push(tokenizedLines.shift()!)
            }
        })
    }

    if (patchCanvasTokens === null) {
        throw new Error(`Parsing failed #canvas missing`)
    }

    pd.patches[patchId] = hydratePatch(
        patchId,
        isPatchRoot,
        patchCanvasTokens,
        patchCoordsTokens
    )
    patchTokenizedLinesMap[patchId] = patchTokenizedLines

    return [pd, tokenizedLines, patchTokenizedLinesMap]
}

/**
 * Use the layout of [inlet] / [outlet] objects to compute the order
 * of portlets of a subpatch.
 */
const _computePatchPortlets = (patch: PdJson.Patch): PdJson.Patch => {
    const _comparePortletsId = (
        node1: PdJson.Node,
        node2: PdJson.Node
    ): number => parseFloat(node1.id) - parseFloat(node2.id)
    const _comparePortletsLayout = (
        node1: PdJson.Node,
        node2: PdJson.Node
    ): number => node1.layout!.x! - node2.layout!.x!

    const inletNodes = Object.values(patch.nodes).filter((node) =>
        ['inlet', 'inlet~'].includes(node.type)
    )
    const inletsSortFunction = inletNodes.every((node) => !!node.layout)
        ? _comparePortletsLayout
        : _comparePortletsId
    inletNodes.sort(inletsSortFunction)

    const outletNodes = Object.values(patch.nodes).filter((node) =>
        ['outlet', 'outlet~'].includes(node.type)
    )
    const outletsSortFunction = outletNodes.every((node) => !!node.layout)
        ? _comparePortletsLayout
        : _comparePortletsId
    outletNodes.sort(outletsSortFunction)

    return {
        ...patch,
        inlets: inletNodes.map((node) => node.id),
        outlets: outletNodes.map((node) => node.id),
    }
}

const parseArrays = (
    pd: PdJson.Pd,
    tokenizedLines: Array<TokenizedLine>
): [PdJson.Pd, Array<TokenizedLine>] => {
    pd = {
        patches: { ...pd.patches },
        arrays: { ...pd.arrays },
    }
    tokenizedLines = [...tokenizedLines]
    const remainingTokenizedLines: Array<TokenizedLine> = []

    // keep the last array for handling correctly
    // the array related instructions which might follow.
    let currentArray: PdJson.PdArray | null = null

    while (tokenizedLines.length) {
        const { tokens, lineIndex } = tokenizedLines[0]!

        catchParsingErrors(lineIndex, () => {
            // start of an array definition
            if (_tokensMatch(tokens, '#X', 'array')) {
                currentArray = hydrateArray(
                    nextArrayId(),
                    tokenizedLines.shift()!
                )
                pd.arrays[currentArray.id] = currentArray
                // Creates a synthetic node that our parser will hydrate at a later stage
                remainingTokenizedLines.push({
                    tokens: ['ARRAY', currentArray.id],
                    lineAfterComma: [],
                    lineIndex,
                })

                // array data to add to the current array
            } else if (_tokensMatch(tokens, '#A')) {
                if (!currentArray) {
                    throw new Error('got array data outside of a array.')
                }
                const currentData = currentArray.data
                if (currentData === null) {
                    throw new Error(
                        "got array data for an array that doesn't save contents."
                    )
                }

                // reads in part of an array of data, starting at the index specified in this line
                // name of the array comes from the the '#X array' and '#X restore' matches above
                const indexOffset = parseFloatToken(tokens[1])
                tokens.slice(2).forEach((rawVal, i) => {
                    const val = parseFloatToken(rawVal)
                    if (Number.isFinite(val)) {
                        currentData[indexOffset + i] = val
                    }
                })
                tokenizedLines.shift()

                // A normal chunk to add to the current patch
            } else {
                remainingTokenizedLines.push(tokenizedLines.shift()!)
            }
        })
    }

    return [pd, remainingTokenizedLines]
}

const parseNodesAndConnections = (
    patch: PdJson.Patch,
    tokenizedLines: Array<TokenizedLine>
): [PdJson.Patch, Array<TokenizedLine>] => {
    patch = {
        ...patch,
        nodes: { ...patch.nodes },
        connections: [...patch.connections],
    }
    tokenizedLines = [...tokenizedLines]
    const remainingTokenizedLines: Array<TokenizedLine> = []

    // In Pd files it seems like node ids are assigned in order in which nodes are declared.
    // Then connection declarations use these same ids to identify nodes.
    let idCounter = -1
    const nextId = (): string => `${++idCounter}`

    while (tokenizedLines.length) {
        const { tokens, lineIndex } = tokenizedLines[0]!

        catchParsingErrors(lineIndex, () => {
            let node: PdJson.Node | null = null
            if (_tokensMatch(tokens, 'PATCH')) {
                node = hydrateNodePatch(nextId(), tokenizedLines.shift()!)
            } else if (_tokensMatch(tokens, 'ARRAY')) {
                node = hydrateNodeArray(nextId(), tokenizedLines.shift()!)
            } else if (
                NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))
            ) {
                const tokenizedLine = tokenizedLines.shift()!
                const nodeBase = hydrateNodeBase(nextId(), tokenizedLine.tokens)
                if (Object.keys(CONTROL_TYPE).includes(nodeBase.type)) {
                    node = hydrateNodeControl(nodeBase)
                    node = hydrateLineAfterComma(
                        node,
                        tokenizedLine.lineAfterComma
                    )
                } else {
                    node = hydrateNodeGeneric(nodeBase)
                    node = hydrateLineAfterComma(
                        node,
                        tokenizedLine.lineAfterComma
                    )
                }
            }

            if (node) {
                patch.nodes[node.id] = node
                return
            }

            if (_tokensMatch(tokens, '#X', 'connect')) {
                patch.connections.push(
                    hydrateConnection(tokenizedLines.shift()!)
                )
            } else {
                remainingTokenizedLines.push(tokenizedLines.shift()!)
            }
        })
    }

    return [patch, remainingTokenizedLines]
}

const catchParsingErrors = (lineIndex: number, func: () => void) => {
    try {
        func()
    } catch (err) {
        if (err instanceof ValueError) {
            throw new ParseError(err, lineIndex)
        } else {
            throw err
        }
    }
}

class ParseError extends Error {
    /** 0-indexed line index of where the error occurred */
    public lineIndex: number
    constructor(error: Error | string, lineIndex: number) {
        super(typeof error === 'string' ? error : error.message)
        this.lineIndex = lineIndex
    }
}
