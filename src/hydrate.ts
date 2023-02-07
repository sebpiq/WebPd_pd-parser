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
import { parseBoolArg, parseNumberArg, parseArg } from './args'
import { TokenizedLine, Tokens } from './tokenize'

export const hydratePatch = (
    id: PdJson.NodeGlobalId,
    { tokens }: TokenizedLine
): PdJson.Patch => {
    const patch: PdJson.Patch = {
        id,
        layout: {
            x: parseInt(tokens[2], 10),
            y: parseInt(tokens[3], 10),
            width: parseInt(tokens[4], 10),
            height: parseInt(tokens[5], 10),
        },
        args: [tokens[6]],
        nodes: {},
        connections: [],
        inlets: [],
        outlets: [],
    }
    if (typeof tokens[7] !== 'undefined') {
        patch.layout.openOnLoad = parseBoolArg(tokens[7])
    }
    return patch
}

export const hydrateArray = (
    id: PdJson.NodeGlobalId,
    { tokens }: TokenizedLine
): PdJson.PdArray => {
    const arrayName = tokens[2]
    const arraySize = parseFloat(tokens[3])
    // Options flag :
    // first bit if for `saveContents` second for `drawAs`
    const optionsFlag = parseFloat(tokens[5])
    const saveContents = (optionsFlag % 2) as 0 | 1
    const drawAs = ['polygon', 'points', 'bezier'][
        optionsFlag >>> 1
    ] as PdJson.ArrayLayout['drawAs']
    return {
        id,
        args: [arrayName, arraySize, saveContents],
        data: saveContents ? Array(arraySize).fill(0) : null,
        layout: {
            drawAs,
        },
    }
}

export const hydrateNodePatch = (
    id: PdJson.NodeLocalId,
    { tokens }: TokenizedLine
): PdJson.SubpatchNode => {
    const canvasType = tokens[4]
    const args = []

    if (canvasType !== 'pd' && canvasType !== 'graph') {
        throw new Error(`unknown canvasType : ${canvasType}`)
    }

    // add subpatch name
    if (canvasType === 'pd') {
        args.push(tokens[5])
    }

    return {
        id,
        type: canvasType,
        patchId: tokens[1],
        nodeClass: 'subpatch',
        args,
        layout: {
            x: parseInt(tokens[2], 10),
            y: parseInt(tokens[3], 10),
        },
    }
}

export const hydrateNodeArray = (
    id: PdJson.NodeLocalId,
    { tokens }: TokenizedLine
): PdJson.ArrayNode => ({
    id,
    args: [],
    type: 'array',
    nodeClass: 'array',
    arrayId: tokens[1],
})

export const hydrateNodeBase = (
    id: PdJson.NodeLocalId,
    tokens: Tokens
): PdJson.BaseNode => {
    const elementType = tokens[1]
    let type // the object name
    let args: Tokens // the construction args for the object

    // 2 categories here :
    //  - elems whose name is `elementType`
    //  - elems whose name is `token[4]`
    if (elementType === 'obj') {
        type = tokens[4]
        args = tokens.slice(5)
    } else {
        type = elementType
        args = tokens.slice(4)
    }

    // If text, we need to re-join all tokens
    if (elementType === 'text') {
        args = [tokens.slice(4).join(' ')]
    }

    return {
        id,
        type,
        args,
        layout: {
            x: parseNumberArg(tokens[2]),
            y: parseNumberArg(tokens[3]),
        },
    }
}

export const hydrateConnection = ({
    tokens,
}: TokenizedLine): PdJson.Connection => ({
    source: {
        nodeId: tokens[2],
        portletId: parseInt(tokens[3], 10),
    },
    sink: {
        nodeId: tokens[4],
        portletId: parseInt(tokens[5], 10),
    },
})

export const hydrateNodeGeneric = (
    nodeBase: PdJson.BaseNode,
): PdJson.GenericNode => {
    const node: PdJson.GenericNode = {
        ...nodeBase,
        nodeClass: 'generic',
    }
    node.args = node.args.map(parseArg)
    return node
}

// This is put here just for readability of the main `parse` function
export const hydrateNodeControl = (
    nodeBase: PdJson.BaseNode,
): PdJson.ControlNode => {
    const args = nodeBase.args as Tokens
    const node: PdJson.ControlNode = {
        ...nodeBase,
        type: nodeBase.type as PdJson.ControlNode['type'],
        nodeClass: 'control',
    } as PdJson.ControlNode

    if (node.type === 'floatatom' || node.type === 'symbolatom') {
        // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
        node.layout = {
            ...node.layout,
            width: parseNumberArg(args[0]),
            labelPos: parseNumberArg(args[3]),
            label: args[4],
        }
        node.args = [
            parseNumberArg(args[1]),
            parseNumberArg(args[2]),
            args[5],
            args[6],
        ]
    } else if (node.type === 'bng') {
        // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
        node.layout = {
            ...node.layout,
            size: parseNumberArg(args[0]),
            hold: parseNumberArg(args[1]),
            interrupt: parseNumberArg(args[2]),
            label: args[6],
            labelX: parseNumberArg(args[7]),
            labelY: parseNumberArg(args[8]),
            labelFont: args[9],
            labelFontSize: parseNumberArg(args[10]),
            bgColor: args[11],
            fgColor: args[12],
            labelColor: args[13],
        }
        node.args = [parseBoolArg(args[3]), args[4], args[5]]
    } else if (node.type === 'tgl') {
        // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
        node.layout = {
            ...node.layout,
            size: parseNumberArg(args[0]),
            label: args[4],
            labelX: parseNumberArg(args[5]),
            labelY: parseNumberArg(args[6]),
            labelFont: args[7],
            labelFontSize: parseNumberArg(args[8]),
            bgColor: args[9],
            fgColor: args[10],
            labelColor: args[11],
        }
        node.args = [
            parseNumberArg(args[13]),
            parseBoolArg(args[1]),
            parseNumberArg(args[12]),
            args[2],
            args[3],
        ]
    } else if (node.type === 'nbx') {
        // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
        // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
        node.layout = {
            ...node.layout,
            size: parseNumberArg(args[0]),
            height: parseNumberArg(args[1]),
            log: parseNumberArg(args[4]),
            label: args[8],
            labelX: parseNumberArg(args[9]),
            labelY: parseNumberArg(args[10]),
            labelFont: args[11],
            labelFontSize: parseNumberArg(args[12]),
            bgColor: args[13],
            fgColor: args[14],
            labelColor: args[15],
            logHeight: args[17],
        }
        node.args = [
            parseNumberArg(args[2]),
            parseNumberArg(args[3]),
            parseBoolArg(args[5]),
            parseNumberArg(args[16]),
            args[6],
            args[7],
        ]
    } else if (node.type === 'vsl' || node.type === 'hsl') {
        // <width> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
        node.layout = {
            ...node.layout,
            width: parseNumberArg(args[0]),
            height: parseNumberArg(args[1]),
            log: parseNumberArg(args[4]),
            label: args[8],
            labelX: parseNumberArg(args[9]),
            labelY: parseNumberArg(args[10]),
            labelFont: args[11],
            labelFontSize: parseNumberArg(args[12]),
            bgColor: args[13],
            fgColor: args[14],
            labelColor: args[15],
            steadyOnClick: args[17],
        }

        const minValue = parseNumberArg(args[2])
        const maxValue = parseNumberArg(args[3])
        const isLogScale = parseBoolArg(args[4])
        const pixValue = parseNumberArg(args[16])
        const pixSize = (node.type === 'hsl' ? node.layout.width : node.layout.height)

        let initValue: number = 0
        if (isLogScale) {
            const k = Math.log(maxValue / minValue) / (pixSize - 1)
            initValue = minValue * Math.exp(k * pixValue * 0.01)
        } else {
            // Reversed engineered formula for the initial value.
            initValue = minValue +
                (maxValue - minValue) * pixValue / ((pixSize - 1) * 100)
        }

        node.args = [
            minValue,
            maxValue,
            parseBoolArg(args[5]),
            initValue,
            args[6],
            args[7],
        ]
    } else if (node.type === 'vradio' || node.type === 'hradio') {
        // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
        node.layout = {
            ...node.layout,
            size: parseNumberArg(args[0]),
            label: args[6],
            labelX: parseNumberArg(args[7]),
            labelY: parseNumberArg(args[8]),
            labelFont: args[9],
            labelFontSize: parseNumberArg(args[10]),
            bgColor: args[11],
            fgColor: args[12],
            labelColor: args[13],
        }
        node.args = [
            parseNumberArg(args[3]),
            parseBoolArg(args[1]),
            parseNumberArg(args[14]),
            args[4],
            args[5],
            parseBoolArg(args[2]),
        ]
    } else if (node.type === 'vu') {
        // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
        node.layout = {
            ...node.layout,
            width: parseNumberArg(args[0]),
            height: parseNumberArg(args[1]),
            label: args[3],
            labelX: parseNumberArg(args[4]),
            labelY: parseNumberArg(args[5]),
            labelFont: args[6],
            labelFontSize: parseNumberArg(args[7]),
            bgColor: args[8],
            labelColor: args[9],
            log: parseNumberArg(args[10]),
        }
        node.args = [args[2], args[11]]
    } else if (node.type === 'cnv') {
        // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
        node.layout = {
            ...node.layout,
            size: parseNumberArg(args[0]),
            width: parseNumberArg(args[1]),
            height: parseNumberArg(args[2]),
            label: args[5],
            labelX: parseNumberArg(args[6]),
            labelY: parseNumberArg(args[7]),
            labelFont: args[8],
            labelFontSize: parseNumberArg(args[9]),
            bgColor: args[10],
            labelColor: args[11],
        }
        node.args = [args[3], args[4], args[12]]
    } else {
        throw new Error(`Unexpected control node ${node.type}`)
    }
    return node
}

export function hydrateLineAfterComma(
    node: PdJson.GenericNode,
    lineAfterComma: Tokens
): PdJson.GenericNode

export function hydrateLineAfterComma(
    node: PdJson.ControlNode,
    lineAfterComma: Tokens
): PdJson.ControlNode

export function hydrateLineAfterComma(
    node: PdJson.ControlNode | PdJson.GenericNode,
    lineAfterComma?: Tokens
): PdJson.ControlNode | PdJson.GenericNode {
    // Handling stuff after the comma
    // I have no idea what's the specification for this, so this is really reverse
    // engineering on what appears in pd files.
    if (lineAfterComma) {
        const afterCommaTokens = lineAfterComma
        while (afterCommaTokens.length) {
            const command = afterCommaTokens.shift()
            if (command === 'f') {
                node.layout.width = parseNumberArg(afterCommaTokens.shift())
            }
        }
    }
    return node
}
