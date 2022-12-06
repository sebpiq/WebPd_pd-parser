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

import { PdJson } from '@webpd/pd-json'
import {
    hydrateArray,
    hydrateConnection,
    hydrateNodeArray,
    hydrateNodeGeneric,
    hydrateNodePatch,
    hydratePatch,
    NodeHydrator,
} from './hydrate'
import tokenize, { Tokens, TokenizedLine } from './tokenize'

export const nextPatchId = (): string => `${++nextPatchId.counter}`
nextPatchId.counter = -1

export const nextArrayId = (): string => `${++nextArrayId.counter}`
nextArrayId.counter = -1

const NODES = ['obj', 'floatatom', 'symbolatom', 'msg', 'text']

const _tokensMatch = (tokens: Tokens, ...values: Tokens): boolean =>
    values.every((value, i) => value === tokens[i])

// Parses a Pd file, returns a simplified JSON version
export default (pdString: Pd.PdString): PdJson.Pd => {
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
        ;[patch, patchTokenizedLines] = parseNodesAndConnections(
            patch,
            patchTokenizedLines
        )
        patch = computePatchPortlets(patch)
        if (patchTokenizedLines.length) {
            throw new Error(
                `invalid chunks : ${patchTokenizedLines.map((l) => l.tokens)}`
            )
        }
        pd.patches[patch.id] = patch
    })
    return pd
}

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
            currentPatch = hydratePatch(nextPatchId(), tokenizedLines.shift())
            pd.patches[currentPatch.id] = currentPatch
            patchTokenizedLinesMap[currentPatch.id] = []

            // If not first line, starts a subpatch
        } else if (_tokensMatch(tokens, '#N', 'canvas')) {
            ;[pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(
                pd,
                tokenizedLines,
                patchTokenizedLinesMap
            )

            // Restore : ends a canvas definition
        } else if (_tokensMatch(tokens, '#X', 'restore')) {
            // Creates a synthetic node that our parser will hydrate at a later stage
            tokenizedLines[0].tokens = [
                'PATCH',
                currentPatch.id,
                ...tokenizedLines[0].tokens.slice(2),
            ]
            return [pd, tokenizedLines, patchTokenizedLinesMap]

            // A normal chunk to add to the current patch
        } else {
            patchTokenizedLinesMap[currentPatch.id].push(tokenizedLines.shift())
        }
    }

    return [pd, tokenizedLines, patchTokenizedLinesMap]
}

const computePatchPortlets = (patch: PdJson.Patch): PdJson.Patch => {
    const _comparePortletsId = (
        node1: PdJson.Node,
        node2: PdJson.Node
    ): number => parseFloat(node1.id) - parseFloat(node2.id)
    const _comparePortletsLayout = (
        node1: PdJson.Node,
        node2: PdJson.Node
    ): number => node1.layout.x - node2.layout.x

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

    // keep the last table for handling correctly
    // the table related instructions which might follow.
    let currentArray: PdJson.PdArray | null = null

    while (tokenizedLines.length) {
        const { tokens } = tokenizedLines[0]

        // start of an array definition
        if (_tokensMatch(tokens, '#X', 'array')) {
            currentArray = hydrateArray(nextArrayId(), tokenizedLines.shift())
            pd.arrays[currentArray.id] = currentArray
            // Creates a synthetic node that our parser will hydrate at a later stage
            remainingTokenizedLines.push({
                tokens: ['ARRAY', currentArray.id],
                lineAfterComma: '',
            })

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
                if (Number.isFinite(val)) {
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

const parseNodesAndConnections = (
    patch: PdJson.Patch,
    tokenizedLines: Array<TokenizedLine>
): [PdJson.Patch, Array<TokenizedLine>] => {
    patch = {
        nodes: { ...patch.nodes },
        connections: [...patch.connections],
        ...patch,
    }
    tokenizedLines = [...tokenizedLines]
    const remainingTokenizedLines: Array<TokenizedLine> = []

    // In Pd files it seems like node ids are assigned in order in which nodes are declared.
    // Then connection declarations use these same ids to identify nodes.
    let idCounter = -1
    const nextId = (): string => `${++idCounter}`

    while (tokenizedLines.length) {
        const { tokens } = tokenizedLines[0]

        let nodeHydrator: NodeHydrator | null
        if (_tokensMatch(tokens, 'PATCH')) {
            nodeHydrator = hydrateNodePatch
        } else if (_tokensMatch(tokens, 'ARRAY')) {
            nodeHydrator = hydrateNodeArray
        } else if (
            NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))
        ) {
            nodeHydrator = hydrateNodeGeneric
        }

        if (nodeHydrator) {
            const node = nodeHydrator(nextId(), tokenizedLines.shift())
            patch.nodes[node.id] = node
            continue
        }

        if (_tokensMatch(tokens, '#X', 'connect')) {
            patch.connections.push(hydrateConnection(tokenizedLines.shift()))

            // coords : visual range of framsets
        } else if (_tokensMatch(tokens, '#X', 'coords')) {
            tokenizedLines.shift()
        } else {
            remainingTokenizedLines.push(tokenizedLines.shift())
        }
    }

    return [patch, remainingTokenizedLines]
}
