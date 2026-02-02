/*
 * Copyright (c) 2022-2025 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
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

import { isNumber, parseFloatToken, parseStringToken, ValueError } from './tokens'
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
    hydrateNodeText,
    hydrateNodeLayoutPosition,
} from './hydrate'
import tokenize, { Tokens, TokenizedLine } from './tokenize'
import { PdJson } from './types'

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
    errors: Array<ParsingWarningOrError>
    warnings: Array<ParsingWarningOrError>
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

export const nextUniqueArrayName = (
    arrays: PdJson.Pd['arrays']
): string => {
    let newArrayName: string
    do {
        newArrayName = `table${++nextUniqueArrayName.counter}`
        // Ensure name is unique
    } while (Object.values(arrays).some(otherArray => otherArray.args[0] == newArrayName))
    return newArrayName
}
nextUniqueArrayName.counter = -1

const _tokensMatch = (tokens: Tokens, ...values: Tokens): boolean =>
    values.every((value, i) => value === tokens[i])

/** Parses a Pd file, returns a simplified JSON version */
export default (pdString: PdJson.PdString): CompilationResult => {
    let tokenizedLines = tokenize(pdString)
    let patchTokenizedLinesMap: PatchTokenizedLinesMap = {}
    const c: Compilation = {
        pd: {
            rootPatchId: '0',
            patches: {},
            arrays: {},
        },
        errors: [],
        warnings: [],
        tokenizedLines,
        patchTokenizedLinesMap,
    }
    _parsePatches(c, true)
    
    // Callbacks to execute at the end of parsing for all patches.
    const parsingEndCallbacks: Array<() => void> = []

    Object.keys(c.pd.patches).forEach((patchId) => {
        _parsePatchContents(c, patchId, parsingEndCallbacks)
        _computePatchPortlets(c, patchId)
        if (c.patchTokenizedLinesMap[patchId]!.length) {
            c.patchTokenizedLinesMap[patchId]!.forEach(
                ({ tokens, lineIndex }) => {
                    c.errors.push({
                        message: `"${tokens[0]} ${tokens[1]}" unexpected chunk`,
                        lineIndex,
                    })
                }
            )
        }
    })
    parsingEndCallbacks.forEach(callback => callback())

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
    let firstLineIndex = c.tokenizedLines[0]
        ? c.tokenizedLines[0].lineIndex
        : -1

    while (c.tokenizedLines.length && continueIteration) {
        const { tokens, lineIndex } = c.tokenizedLines[0]!

        if (
            _tokensMatch(tokens, '#N', 'struct') ||
            _tokensMatch(tokens, '#X', 'declare') ||
            _tokensMatch(tokens, '#X', 'scalar') ||
            _tokensMatch(tokens, '#X', 'f')
        ) {
            c.warnings.push({
                message: `"${tokens[0]} ${tokens[1]}" chunk is not supported`,
                lineIndex,
            })
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
        c.errors.push({
            message: `Parsing failed #canvas missing`,
            lineIndex: firstLineIndex,
        })
        return
    }

    if (isPatchRoot) {
        c.pd.rootPatchId = patchId
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
 * of portlets of a subpatch. Leftmost portlet is inlet/outlet 0, next is 1, etc.
 */
const _computePatchPortlets = (
    c: Compilation,
    patchId: PdJson.GlobalId
): void => {
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

const _parsePatchContents = (c: Compilation, patchId: PdJson.GlobalId, parsingEndCallbacks: Array<() => void>): void => {
    const patch = c.pd.patches[patchId]!
    const patchTokenizedLines = c.patchTokenizedLinesMap[patchId]!
    const remainingTokenizedLines: Array<TokenizedLine> = []

    // keep the last array for handling correctly
    // the array related instructions which might follow.
    let currentArray: PdJson.PdArray | null = null

    // In Pd files it seems like node ids are assigned in order in which nodes are declared.
    // Then connection declarations use these same ids to identify nodes.
    let idCounter = -1
    const nextId = (): string => `${++idCounter}`

    while (patchTokenizedLines.length) {
        const { tokens, lineIndex } = patchTokenizedLines[0]!

        _catchParsingErrors(c, lineIndex, () => {
            // -------------------- ARRAYS -------------------- //
            // start of an array definition
            if (_tokensMatch(tokens, '#X', 'array')) {
                currentArray = hydrateArray(
                    nextArrayId(),
                    patchTokenizedLines.shift()!
                )
                c.pd.arrays[currentArray.id] = currentArray
                const node = hydrateNodeArray(nextId(), currentArray.id)
                patch.nodes[node.id] = node

            // array data to add to the current array
            } else if (_tokensMatch(tokens, '#A')) {
                if (!currentArray) {
                    throw new Error(
                        `line ${lineIndex}: Unsupported data chunk #A.`
                    )
                }
                if (currentArray.args[2] === 0) {
                    throw new Error(
                        "got array data for an array that doesn't save contents."
                    )
                }
                const currentData = currentArray.data || []
                currentArray.data = currentData

                // reads in part of an array of data, starting at the index specified in this line
                // name of the array comes from the '#X array' and '#X restore' matches above
                const indexOffset = parseFloatToken(tokens[1])
                tokens.slice(2).forEach((rawVal, i) => {
                    const val = parseFloatToken(rawVal)
                    if (Number.isFinite(val)) {
                        currentData[indexOffset + i] = val
                    }
                })
                patchTokenizedLines.shift()

            // -------------------- NODES -------------------- //
            // [table] node
            } else if (
                // prettier-ignore
                _tokensMatch( tokens, '#X', 'obj', tokens[2]!, tokens[3]!, 'table')
            ) {
                _parseNode(patch, patchTokenizedLines.shift()!, nextId)
                currentArray = hydrateArray(
                    nextArrayId(),
                    {
                        tokens: [ '#X', 'array', parseStringToken(tokens[5]), tokens[6] || DEFAULT_ARRAY_SIZE.toString(), 'float', '0'],
                        lineIndex,
                    }
                )
                c.pd.arrays[currentArray.id] = currentArray

            // [array define] node
            } else if (
                // prettier-ignore
                _tokensMatch(tokens, '#X', 'obj', tokens[2]!, tokens[3]!, 'array', 'define')
            ) {
                let arrayParamsTokens = tokens.slice(6)
                let arrayName: string | null = null
                let arraySize: string | null = null
                let arraySave: '0' | '1' = '0'

                // Parse [array define] arguments
                while (arrayParamsTokens.length > 0) {
                    const token = arrayParamsTokens[0]!
                    
                    let shiftCount = 0
                    // -k
                    if (token === '-k') {
                        arraySave = '1'
                        shiftCount = 1
                    // -yrange low hi
                    // -pix x y
                    } else if (['-yrange', '-pix'].includes(token)) {
                        shiftCount = 3
                    }
                    if (shiftCount > 0) {
                        arrayParamsTokens = arrayParamsTokens.slice(shiftCount)
                        continue
                    }

                    if (isNumber(parseInt(token, 10))) {
                        arraySize = token
                    } else {
                        arrayName = parseStringToken(token)
                    }
                    arrayParamsTokens = arrayParamsTokens.slice(1)
                }

                // Process the `array define` node
                const node = _parseNode(patch, patchTokenizedLines.shift()!, nextId)

                // Retain the last seen array for next #A data chunks
                currentArray = hydrateArray(
                    nextArrayId(),
                    {
                        tokens: [ '#X', 'array', arrayName || '', arraySize || DEFAULT_ARRAY_SIZE.toString(), 'float', arraySave],
                        lineIndex,
                    }
                )
                c.pd.arrays[currentArray.id] = currentArray

                // We assign a name to all unnamed arrays. 
                // This is important to do last because otherwise
                // there's a risk of collision with a name given by the user.
                if (arrayName === null) {
                    parsingEndCallbacks.push(((node: PdJson.Node, array: PdJson.PdArray) => () => {
                        arrayName = nextUniqueArrayName(c.pd.arrays)
                        node.args.push('-k')
                        node.args.push(arrayName)
                        array.args[0] = arrayName
                    })(node, currentArray))
                }

            } else if (_tokensMatch(tokens, 'PATCH')) {
                const node = hydrateNodePatch(nextId(), patchTokenizedLines.shift()!)
                patch.nodes[node.id] = node

            // Other node types
            } else if (
                NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))
            ) {
                _parseNode(patch, patchTokenizedLines.shift()!, nextId)

            // -------------------- CONNECTIONS -------------------- //
            } else if (_tokensMatch(tokens, '#X', 'connect')) {
                patch.connections.push(
                    hydrateConnection(patchTokenizedLines.shift()!)
                )

            // -------------------- UNHANDLED CHUNKS -------------------- //
            } else {
                remainingTokenizedLines.push(patchTokenizedLines.shift()!)
            }

        })
    }
    c.patchTokenizedLinesMap[patchId] = remainingTokenizedLines
}


/** Helper to parse nodes */
const _parseNode = (
    patch: PdJson.Patch,
    tokenizedLine: TokenizedLine,
    nextId: () => string
): PdJson.Node => {
    let node: PdJson.Node
    const { nodeClass, type, args } = hydrateNodeBase(
        tokenizedLine.tokens
    )
    const layout = hydrateNodeLayoutPosition(tokenizedLine.tokens)

    if (nodeClass === 'control') {
        node = hydrateNodeControl(
            nextId(),
            type as PdJson.ControlNode['type'],
            args,
            layout
        )
    } else if (nodeClass === 'text') {
        node = hydrateNodeText(nextId(), args, layout)
    } else {
        node = hydrateNodeGeneric(nextId(), type, args, layout)
    }

    node = hydrateLineAfterComma(node, tokenizedLine.lineAfterComma)
    patch.nodes[node.id] = node
    return node
}


const _catchParsingErrors = (
    c: Compilation,
    lineIndex: number,
    func: () => void
) => {
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