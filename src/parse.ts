/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd 
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { parseFloatToken, parseStringToken, ValueError } from './tokens'
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
import { PdJson, CONTROL_TYPE } from './types'

type PatchTokenizedLinesMap = { [globalId: string]: Array<TokenizedLine> }

export interface ParsingWarningOrError {
    message: string

    /** 0-indexed line index of where the error occurred */
    lineIndex: number
}

export const DEFAULT_ARRAY_SIZE = 100

const NODES = ['obj', 'floatatom', 'symbolatom', 'listbox', 'msg', 'text']

export interface Compilation {
    pd: PdJson.Pd
    errors: Array<ParsingWarningOrError>,
    warnings: Array<ParsingWarningOrError>,
    tokenizedLines: Array<TokenizedLine>
    patchTokenizedLinesMap: { [globalId: string]: Array<TokenizedLine> }
}

interface CompilationSuccess {
    status: 0
    warnings: Array<ParsingWarningOrError>
    pd: PdJson.Pd
}

interface CompilationFailure {
    status: 1
    warnings: Array<ParsingWarningOrError>
    errors: Array<ParsingWarningOrError>
}

type CompilationResult = CompilationSuccess | CompilationFailure

export const nextPatchId = (): string => `${++nextPatchId.counter}`
nextPatchId.counter = -1

export const nextArrayId = (): string => `${++nextArrayId.counter}`
nextArrayId.counter = -1

const _tokensMatch = (tokens: Tokens, ...values: Tokens): boolean =>
    values.every((value, i) => value === tokens[i])

/** Parses a Pd file, returns a simplified JSON version */
export default (pdString: PdJson.PdString): CompilationResult => {
    let tokenizedLines = tokenize(pdString)
    let patchTokenizedLinesMap: PatchTokenizedLinesMap = {}
    const c: Compilation = {
        pd: {
            patches: {},
            arrays: {},
        },
        errors: [],
        warnings: [],
        tokenizedLines,
        patchTokenizedLinesMap,
    }
    _parsePatches(c, true)

    Object.keys(c.pd.patches).forEach((patchId) => {
        _parseArrays(c, patchId)
        _parseNodesAndConnections(c, patchId)
        _computePatchPortlets(c, patchId)
        if (c.patchTokenizedLinesMap[patchId]!.length) {
            c.patchTokenizedLinesMap[patchId]!.forEach(({ tokens, lineIndex }) => {
                c.errors.push({ message: `"${tokens[0]} ${tokens[1]}" unexpected chunk`, lineIndex })
            })
        }
    })

    if (c.errors.length) {
        return {
            status: 1,
            warnings: c.warnings,
            errors: c.errors,
        }
        
    } else {
        return {
            status: 0,
            warnings: c.warnings,
            pd: c.pd,
        }
    }
}

export const _parsePatches = (c: Compilation, isPatchRoot: boolean): void => {
    const patchId = nextPatchId()
    const patchTokenizedLines: Array<TokenizedLine> = []
    let patchCanvasTokens: TokenizedLine | null = null
    let patchCoordsTokens: TokenizedLine | null = null
    let iterCounter = -1
    let continueIteration = true
    let firstLineIndex = c.tokenizedLines[0] ? c.tokenizedLines[0].lineIndex: -1

    while (c.tokenizedLines.length && continueIteration) {
        const { tokens, lineIndex } = c.tokenizedLines[0]!

        if (
            _tokensMatch(tokens, '#N', 'struct')
            || _tokensMatch(tokens, '#X', 'declare')
            || _tokensMatch(tokens, '#X', 'scalar')
            || _tokensMatch(tokens, '#X', 'f')
        ) {
            c.warnings.push({ message: `"${tokens[0]} ${tokens[1]}" chunk is not supported`, lineIndex })
            c.tokenizedLines.shift()!
            continue
        }

        iterCounter++
        _catchParsingErrors(c, lineIndex, () => {
            // First line of the patch / subpatch, initializes the patch
            if (_tokensMatch(tokens, '#N', 'canvas') && iterCounter === 0) {
                patchCanvasTokens = c.tokenizedLines.shift()!

                // If not first line, starts a subpatch
            } else if (_tokensMatch(tokens, '#N', 'canvas')) {
                _parsePatches(c, false)

                // Table : a table subpatch
                // It seems that a table object is just a subpatch containing an array.
                // Therefore we add some synthetic lines to the tokenized file to simulate
                // this subpatch.
            } else if (
                // prettier-ignore
                _tokensMatch( tokens, '#X', 'obj', tokens[2]!, tokens[3]!, 'table')
            ) {
                const tableTokens = c.tokenizedLines.shift()!.tokens
                c.tokenizedLines = [
                    {
                        // prettier-ignore
                        tokens: [ '#N', 'canvas', '0', '0', '100', '100', '(subpatch)', '0'],
                        lineIndex,
                    },
                    {
                        // prettier-ignore
                        tokens: [ '#N', 'canvas', '0', '0', '100', '100', '(subpatch)', '0'],
                        lineIndex,
                    },
                    {
                        // prettier-ignore
                        tokens: [ '#X', 'array', parseStringToken(tableTokens[5]), tableTokens[6] || DEFAULT_ARRAY_SIZE.toString(), 'float', '0'],
                        lineIndex,
                    },
                    // prettier-ignore
                    { tokens: ['#X', 'restore', '0', '0', 'graph'], lineIndex },
                    {
                        // prettier-ignore
                        tokens: [ '#X', 'restore', tableTokens[2]!, tableTokens[3]!, 'table'],
                        lineIndex,
                    },
                    ...c.tokenizedLines,
                ]
                _parsePatches(c, false)

                // coords : visual range of framesets
            } else if (_tokensMatch(tokens, '#X', 'coords')) {
                patchCoordsTokens = c.tokenizedLines.shift()!

                // Restore : ends a canvas definition
            } else if (_tokensMatch(tokens, '#X', 'restore')) {
                // Creates a synthetic node that our parser will hydrate at a later stage
                c.tokenizedLines[0]!.tokens = [
                    'PATCH',
                    patchId,
                    ...c.tokenizedLines[0]!.tokens.slice(2),
                ]
                continueIteration = false

                // A normal chunk to add to the current patch
            } else {
                patchTokenizedLines.push(c.tokenizedLines.shift()!)
            }
        })
    }

    if (patchCanvasTokens === null) {
        c.errors.push({ message: `Parsing failed #canvas missing`, lineIndex: firstLineIndex })
        return
    }

    c.pd.patches[patchId] = hydratePatch(
        patchId,
        isPatchRoot,
        patchCanvasTokens,
        patchCoordsTokens
    )
    c.patchTokenizedLinesMap[patchId] = patchTokenizedLines
}

/**
 * Use the layout of [inlet] / [outlet] objects to compute the order
 * of portlets of a subpatch.
 */
const _computePatchPortlets = (c: Compilation, patchId: PdJson.GlobalId): void => {
    const patch: PdJson.Patch = c.pd.patches[patchId]!
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

    c.pd.patches[patchId] = {
        ...patch,
        inlets: inletNodes.map((node) => node.id),
        outlets: outletNodes.map((node) => node.id),
    }
}

const _parseArrays = (
    c: Compilation,
    patchId: PdJson.GlobalId
): void => {
    const patchTokenizedLines = c.patchTokenizedLinesMap[patchId]!
    const remainingTokenizedLines: Array<TokenizedLine> = []

    // keep the last array for handling correctly
    // the array related instructions which might follow.
    let currentArray: PdJson.PdArray | null = null

    while (patchTokenizedLines.length) {
        const { tokens, lineIndex } = patchTokenizedLines[0]!

        _catchParsingErrors(c, lineIndex, () => {
            // start of an array definition
            if (_tokensMatch(tokens, '#X', 'array')) {
                currentArray = hydrateArray(
                    nextArrayId(),
                    patchTokenizedLines.shift()!
                )
                c.pd.arrays[currentArray.id] = currentArray
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
                if (currentArray.args[2] === 0) {
                    throw new Error(
                        "got array data for an array that doesn't save contents."
                    )
                }
                const currentData = currentArray.data || []
                currentArray.data = currentData

                // reads in part of an array of data, starting at the index specified in this line
                // name of the array comes from the the '#X array' and '#X restore' matches above
                const indexOffset = parseFloatToken(tokens[1])
                tokens.slice(2).forEach((rawVal, i) => {
                    const val = parseFloatToken(rawVal)
                    if (Number.isFinite(val)) {
                        currentData[indexOffset + i] = val
                    }
                })
                patchTokenizedLines.shift()

                // A normal chunk to add to the current patch
            } else {
                remainingTokenizedLines.push(patchTokenizedLines.shift()!)
            }
        })
    }
    c.patchTokenizedLinesMap[patchId] = remainingTokenizedLines
}

const _parseNodesAndConnections = (
    c: Compilation,
    patchId: PdJson.GlobalId,
): void => {
    const patch = c.pd.patches[patchId]!
    const patchTokenizedLines = c.patchTokenizedLinesMap[patchId]!
    const remainingTokenizedLines: Array<TokenizedLine> = []

    // In Pd files it seems like node ids are assigned in order in which nodes are declared.
    // Then connection declarations use these same ids to identify nodes.
    let idCounter = -1
    const nextId = (): string => `${++idCounter}`

    while (patchTokenizedLines.length) {
        const { tokens, lineIndex } = patchTokenizedLines[0]!

        _catchParsingErrors(c, lineIndex, () => {
            let node: PdJson.Node | null = null
            if (_tokensMatch(tokens, 'PATCH')) {
                node = hydrateNodePatch(nextId(), patchTokenizedLines.shift()!)
            } else if (_tokensMatch(tokens, 'ARRAY')) {
                node = hydrateNodeArray(nextId(), patchTokenizedLines.shift()!)
            } else if (
                NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))
            ) {
                const tokenizedLine = patchTokenizedLines.shift()!
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
                    hydrateConnection(patchTokenizedLines.shift()!)
                )
            } else {
                remainingTokenizedLines.push(patchTokenizedLines.shift()!)
            }
        })
    }
    c.patchTokenizedLinesMap[patchId] = remainingTokenizedLines
}

const _catchParsingErrors = (c: Compilation, lineIndex: number, func: () => void) => {
    try {
        func()
    } catch (err) {
        if (err instanceof ValueError) {
            c.errors.push({ message: err.message, lineIndex })
        } else {
            throw err
        }
    }
}