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
import { parseBoolToken, parseFloatToken, parseArg, parseStringToken, parseIntToken } from './tokens'
import { TokenizedLine, Tokens } from './tokenize'

export const hydratePatch = (
    id: PdJson.NodeGlobalId,
    { tokens: canvasTokens }: TokenizedLine,
    { tokens: coordsTokens }: TokenizedLine
): PdJson.Patch => {
    let layout: PdJson.Patch['layout'] = {
        windowX: parseIntToken(canvasTokens[2]),
        windowY: parseIntToken(canvasTokens[3]),
        windowWidth: parseIntToken(canvasTokens[4]),
        windowHeight: parseIntToken(canvasTokens[5]),
    }
    if (typeof canvasTokens[7] !== 'undefined') {
        layout.openOnLoad = parseBoolToken(canvasTokens[7])
    }
    if (typeof coordsTokens[8] !== 'undefined') {
        const graphOnParentRaw = parseFloatToken(coordsTokens[8])
        layout.graphOnParent = graphOnParentRaw > 0 ? 1 : 0
        if (layout.graphOnParent === 1) {
            layout = {
                ...layout,
                hideObjectNameAndArguments: graphOnParentRaw === 2 ? 1: 0,
                viewportX: coordsTokens[9] ? parseIntToken(coordsTokens[9]) : 0,
                viewportY: coordsTokens[10] ? parseIntToken(coordsTokens[10]) : 0,
                viewportWidth: parseIntToken(coordsTokens[6]),
                viewportHeight: parseIntToken(coordsTokens[7]),
            }
        }
    }
    return {
        id,
        layout,
        args: [parseStringToken(canvasTokens[6])],
        nodes: {},
        connections: [],
        inlets: [],
        outlets: [],
    }
}

export const hydrateArray = (
    id: PdJson.NodeGlobalId,
    { tokens }: TokenizedLine
): PdJson.PdArray => {
    const arrayName = parseStringToken(tokens[2])
    const arraySize = parseIntToken(tokens[3])
    // Options flag :
    // first bit if for `saveContents` second for `drawAs`
    const optionsFlag = parseIntToken(tokens[5])
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
    const args: PdJson.NodeArgs = []

    if (canvasType !== 'pd' && canvasType !== 'graph') {
        throw new Error(`unknown canvasType : ${canvasType}`)
    }

    // add subpatch name
    if (canvasType === 'pd') {
        args.push(parseStringToken(tokens[5]))
    }

    return {
        id,
        type: canvasType,
        patchId: parseStringToken(tokens[1]),
        nodeClass: 'subpatch',
        args,
        layout: {
            x: parseIntToken(tokens[2]),
            y: parseIntToken(tokens[3]),
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
    arrayId: parseStringToken(tokens[1]),
})

export const hydrateNodeBase = (
    id: PdJson.NodeLocalId,
    tokens: Tokens
): PdJson.BaseNode => {
    const elementType = tokens[1]
    let type = '' // the object name
    let args: Tokens // the construction args for the object

    // 2 categories here :
    //  - elems whose name is `elementType`
    //  - elems whose name is `token[4]`
    if (elementType === 'obj') {
        type = parseStringToken(tokens[4])
        args = tokens.slice(5)
    } else {
        type = parseStringToken(elementType)
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
            x: parseFloatToken(tokens[2]),
            y: parseFloatToken(tokens[3]),
        },
    }
}

export const hydrateConnection = ({
    tokens,
}: TokenizedLine): PdJson.Connection => ({
    source: {
        nodeId: parseStringToken(tokens[2]),
        portletId: parseIntToken(tokens[3]),
    },
    sink: {
        nodeId: parseStringToken(tokens[4]),
        portletId: parseIntToken(tokens[5]),
    },
})

export const hydrateNodeGeneric = (
    nodeBase: PdJson.BaseNode
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
    nodeBase: PdJson.BaseNode
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
            width: parseFloatToken(args[0]),
            labelPos: parseFloatToken(args[3]),
            label: parseStringToken(args[4], '-'),
        }
        node.args = [
            parseFloatToken(args[1]),
            parseFloatToken(args[2]),
            parseStringToken(args[5], '-'),
            parseStringToken(args[6], '-'),
        ]
    } else if (node.type === 'bng') {
        // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
        node.layout = {
            ...node.layout,
            size: parseFloatToken(args[0]),
            hold: parseFloatToken(args[1]),
            interrupt: parseFloatToken(args[2]),
            label: parseStringToken(args[6], 'empty'),
            labelX: parseFloatToken(args[7]),
            labelY: parseFloatToken(args[8]),
            labelFont: args[9],
            labelFontSize: parseFloatToken(args[10]),
            bgColor: args[11],
            fgColor: args[12],
            labelColor: args[13],
        }
        node.args = [
            parseBoolToken(args[3]),
            parseStringToken(args[4], 'empty'),
            parseStringToken(args[5], 'empty'),
        ]
    } else if (node.type === 'tgl') {
        // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
        node.layout = {
            ...node.layout,
            size: parseFloatToken(args[0]),
            label: parseStringToken(args[4], 'empty'),
            labelX: parseFloatToken(args[5]),
            labelY: parseFloatToken(args[6]),
            labelFont: args[7],
            labelFontSize: parseFloatToken(args[8]),
            bgColor: args[9],
            fgColor: args[10],
            labelColor: args[11],
        }
        node.args = [
            parseFloatToken(args[13]),
            parseBoolToken(args[1]),
            parseFloatToken(args[12]),
            parseStringToken(args[2], 'empty'),
            parseStringToken(args[3], 'empty'),
        ]
    } else if (node.type === 'nbx') {
        // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
        // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
        node.layout = {
            ...node.layout,
            widthDigits: parseFloatToken(args[0]),
            height: parseFloatToken(args[1]),
            log: parseFloatToken(args[4]),
            label: parseStringToken(args[8], 'empty'),
            labelX: parseFloatToken(args[9]),
            labelY: parseFloatToken(args[10]),
            labelFont: args[11],
            labelFontSize: parseFloatToken(args[12]),
            bgColor: args[13],
            fgColor: args[14],
            labelColor: args[15],
            logHeight: args[17],
        }
        node.args = [
            parseFloatToken(args[2]),
            parseFloatToken(args[3]),
            parseBoolToken(args[5]),
            parseFloatToken(args[16]),
            parseStringToken(args[6], 'empty'),
            parseStringToken(args[7], 'empty'),
        ]
    } else if (node.type === 'vsl' || node.type === 'hsl') {
        // <width> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
        node.layout = {
            ...node.layout,
            width: parseFloatToken(args[0]),
            height: parseFloatToken(args[1]),
            log: parseFloatToken(args[4]),
            label: parseStringToken(args[8], 'empty'),
            labelX: parseFloatToken(args[9]),
            labelY: parseFloatToken(args[10]),
            labelFont: args[11],
            labelFontSize: parseFloatToken(args[12]),
            bgColor: args[13],
            fgColor: args[14],
            labelColor: args[15],
            steadyOnClick: args[17],
        }

        const minValue = parseFloatToken(args[2])
        const maxValue = parseFloatToken(args[3])
        const isLogScale = parseBoolToken(args[4])
        const pixValue = parseFloatToken(args[16])
        const pixSize =
            node.type === 'hsl' ? node.layout.width : node.layout.height

        let initValue: number = 0
        if (isLogScale) {
            const k = Math.log(maxValue / minValue) / (pixSize! - 1)
            initValue = minValue * Math.exp(k * pixValue * 0.01)
        } else {
            // Reversed engineered formula for the initial value.
            initValue =
                minValue +
                ((maxValue - minValue) * pixValue) / ((pixSize! - 1) * 100)
        }

        node.args = [
            minValue,
            maxValue,
            parseBoolToken(args[5]),
            initValue,
            parseStringToken(args[6], 'empty'),
            parseStringToken(args[7], 'empty'),
        ]
    } else if (node.type === 'vradio' || node.type === 'hradio') {
        // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
        node.layout = {
            ...node.layout,
            size: parseFloatToken(args[0]),
            label: parseStringToken(args[6], 'empty'),
            labelX: parseFloatToken(args[7]),
            labelY: parseFloatToken(args[8]),
            labelFont: args[9],
            labelFontSize: parseFloatToken(args[10]),
            bgColor: args[11],
            fgColor: args[12],
            labelColor: args[13],
        }
        node.args = [
            parseFloatToken(args[3]),
            parseBoolToken(args[1]),
            parseFloatToken(args[14]),
            parseStringToken(args[4], 'empty'),
            parseStringToken(args[5], 'empty'),
            parseBoolToken(args[2]),
        ]
    } else if (node.type === 'vu') {
        // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
        node.layout = {
            ...node.layout,
            width: parseFloatToken(args[0]),
            height: parseFloatToken(args[1]),
            label: parseStringToken(args[3], 'empty'),
            labelX: parseFloatToken(args[4]),
            labelY: parseFloatToken(args[5]),
            labelFont: args[6],
            labelFontSize: parseFloatToken(args[7]),
            bgColor: args[8],
            labelColor: args[9],
            log: parseFloatToken(args[10]),
        }
        node.args = [parseStringToken(args[2], 'empty'), parseStringToken(args[11])]
    } else if (node.type === 'cnv') {
        // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
        node.layout = {
            ...node.layout,
            size: parseFloatToken(args[0]),
            width: parseFloatToken(args[1]),
            height: parseFloatToken(args[2]),
            label: parseStringToken(args[5], 'empty'),
            labelX: parseFloatToken(args[6]),
            labelY: parseFloatToken(args[7]),
            labelFont: args[8],
            labelFontSize: parseFloatToken(args[9]),
            bgColor: args[10],
            labelColor: args[11],
        }
        node.args = [parseStringToken(args[3], 'empty'), parseStringToken(args[4], 'empty'), parseStringToken(args[12])]
    } else {
        throw new Error(`Unexpected control node ${node.type}`)
    }
    return node
}

export function hydrateLineAfterComma(
    node: PdJson.GenericNode,
    lineAfterComma?: Tokens
): PdJson.GenericNode

export function hydrateLineAfterComma(
    node: PdJson.ControlNode,
    lineAfterComma?: Tokens
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
                ;(node.layout as PdJson.BaseNode['layout'])!.width =
                    parseFloatToken(afterCommaTokens.shift())
            }
        }
    }
    return node
}