/*
 * Copyright (c) 2012-2015 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/pd-fileutils for documentation
 *
 */

// See http://puredata.info/docs/developer/PdFileFormat for the Pd file format reference
import defaults from 'lodash.defaults'
import { HYDRATORS } from './hydrate'
import { isNumber } from './args'
import tokenize, { Tokens, TokenizedLine } from './tokenize'

const NODES = ['obj', 'floatatom', 'symbolatom', 'msg', 'text']

const _tokensMatch = (tokens: Tokens, ...values: Tokens): boolean =>
    values.every((value, i) => value === tokens[i])

const buildPatch = (patchData: Partial<PdJson.Patch>): PdJson.Patch =>
    defaults({}, patchData, {
        id: 'NOT ASSIGNED',
        nodes: {},
        connections: [],
        args: [],
    })

const buildArray = (arrayData: Partial<PdJson.PdArray>): PdJson.PdArray =>
    defaults({}, arrayData, {
        id: 'NOT ASSIGNED',
        args: [],
        data: [],
    })

const buildNode = (nodeData: Partial<PdJson.Node>): PdJson.GenericNode =>
    defaults({}, nodeData, {
        id: 'NOT ASSIGNED',
        proto: 'NOT ASSIGNED',
        args: [],
    })

// Parses a Pd file, creates and returns a graph from it
export const parse = (pdString: Pd.PdString): PdJson.Pd => {
    let pd: PdJson.Pd = {
        patches: {},
        arrays: {},
    }
    const tokenizedLines = tokenize(pdString)
    const parsePatchesResult = parsePatches(pd, tokenizedLines)
    const patchTokenizedLinesMap = parsePatchesResult[2]
    pd = parsePatchesResult[0]
    Object.values(pd.patches).forEach((patch) => {
        let patchTokenizedLines = patchTokenizedLinesMap[patch.id]
        ;[pd, patchTokenizedLines] = parseArrays(pd, patchTokenizedLines)
        ;[patch, patchTokenizedLines] = parseGraph(patch, patchTokenizedLines)
        pd.patches[patch.id] = patch
    })
    return pd
}

// Recursively parse subpatches
export const parsePatches = (
    pd: PdJson.Pd,
    tokenizedLines: Array<TokenizedLine>,
    patchTokenizedLinesMap: { [globalId: string]: Array<TokenizedLine> } = {}
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
    let currentPatch: PdJson.Patch | null = null
    let lineIndex = -1

    while (tokenizedLines.length) {
        const { tokens } = tokenizedLines[0]
        lineIndex++

        // First line of the patch / subpatch, initializes the patch
        if (_tokensMatch(tokens, '#N', 'canvas') && lineIndex === 0) {
            currentPatch = HYDRATORS.patch(
                buildPatch({
                    id: `${Object.keys(pd.patches).length}`,
                }),
                tokenizedLines[0]
            )
            pd.patches[currentPatch.id] = currentPatch
            patchTokenizedLinesMap[currentPatch.id] = []
            tokenizedLines.shift()

            // If not first line, starts a subpatch
        } else if (_tokensMatch(tokens, '#N', 'canvas')) {
            ;[pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(
                pd,
                tokenizedLines,
                patchTokenizedLinesMap
            )

            // Restore : ends a canvas definition
        } else if (_tokensMatch(tokens, '#X', 'restore')) {
            tokenizedLines[0].tokens[0] = 'PATCH'
            tokenizedLines[0].tokens[1] = currentPatch.id
            return [pd, tokenizedLines, patchTokenizedLinesMap]

            // A normal chunk to add to the current patch
        } else {
            patchTokenizedLinesMap[currentPatch.id].push(tokenizedLines.shift())
        }
    }

    return [pd, tokenizedLines, patchTokenizedLinesMap]
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

    // remind the last table for handling correctly
    // the table related instructions which might follow.
    let currentArray: PdJson.PdArray | null = null

    while (tokenizedLines.length) {
        const { tokens } = tokenizedLines[0]

        // start of an array definition
        if (_tokensMatch(tokens, '#X', 'array')) {
            currentArray = HYDRATORS.array(
                buildArray({
                    id: `${Object.keys(pd.arrays).length}`,
                }),
                tokenizedLines[0]
            )
            pd.arrays[currentArray.id] = currentArray
            remainingTokenizedLines.push({
                tokens: ['ARRAY', currentArray.id],
                lineAfterComma: '',
            })
            tokenizedLines.shift()

            // array data to add to the current array
        } else if (_tokensMatch(tokens, '#A')) {
            if (!currentArray) {
                throw new Error('got table data outside of a table.')
            }

            // reads in part of an array/table of data, starting at the index specified in this line
            // name of the array/table comes from the the '#X array' and '#X restore' matches above
            const indexOffset = parseFloat(tokens[1])
            tokens.slice(2).forEach((rawVal, i) => {
                const val = parseFloat(rawVal)
                if (isNumber(val)) {
                    currentArray.data[indexOffset + i] = val
                }
            })
            tokenizedLines.shift()

            // A normal chunk to add to the current patch
        } else {
            remainingTokenizedLines.push(tokenizedLines.shift())
        }
    }

    return [pd, remainingTokenizedLines]
}

const parseGraph = (
    patch: PdJson.Patch,
    tokenizedLines: Array<TokenizedLine>
): [PdJson.Patch, Array<TokenizedLine>] => {
    patch = {
        nodes: { ...patch.nodes },
        connections: [...patch.connections],
        ...patch,
    }
    tokenizedLines = [...tokenizedLines]

    let idCounter = -1
    const nextId = (): string => `${++idCounter}`

    for (const tokenizedLine of tokenizedLines) {
        const { tokens } = tokenizedLine

        if (_tokensMatch(tokens, 'PATCH')) {
            const node = HYDRATORS.nodePatch(
                buildNode({
                    id: nextId(),
                }),
                tokenizedLine
            )
            patch.nodes[node.id] = node
        } else if (_tokensMatch(tokens, 'ARRAY')) {
            const node = HYDRATORS.nodeArray(
                buildNode({
                    id: nextId(),
                }),
                tokenizedLine
            )
            patch.nodes[node.id] = node
        } else if (
            NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))
        ) {
            const node = HYDRATORS.nodeGeneric(
                buildNode({
                    id: nextId(),
                }),
                tokenizedLine
            )
            patch.nodes[node.id] = node
        } else if (_tokensMatch(tokens, '#X', 'connect')) {
            patch.connections.push(HYDRATORS.connection(tokenizedLine))

            // coords : visual range of framsets
        } else if (_tokensMatch(tokens, '#X', 'coords')) {
            null
        } else throw new Error(`invalid chunk : ${tokens}`)
    }

    return [patch, tokenizedLines]
}
