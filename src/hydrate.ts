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
import { TOKENS_RE, TokenizedLine, Tokens } from './tokenize'

export const hydratePatch = (
    id: PdJson.ObjectGlobalId,
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
    id: PdJson.ObjectGlobalId,
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
    id: PdJson.ObjectLocalId,
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
    id: PdJson.ObjectLocalId,
    { tokens }: TokenizedLine
): PdJson.ArrayNode => ({
    id,
    args: [],
    type: 'array',
    nodeClass: 'array',
    arrayId: tokens[1],
})

export const hydrateNodeBase = (
    id: PdJson.ObjectLocalId,
    { tokens }: TokenizedLine
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
    tokenizedLine: TokenizedLine
): PdJson.GenericNode => {
    const node: PdJson.GenericNode = {
        ...nodeBase,
        nodeClass: 'generic',
    }
    return hydrateNodeGenericAndControl(node, tokenizedLine)
}

// This is put here just for readability of the main `parse` function
export const hydrateNodeControl = (
    nodeBase: PdJson.BaseNode,
    tokenizedLine: TokenizedLine,
    args: Tokens
): PdJson.ControlNode => {
    const node: PdJson.ControlNode = {
        ...nodeBase,
        type: nodeBase.type as PdJson.ControlNode['type'],
        nodeClass: 'control',
    }
    if (node.type === 'floatatom' || node.type === 'symbolatom') {
        // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
        node.layout.width = parseNumberArg(args[0])
        node.layout.labelPos = parseNumberArg(args[3])
        node.layout.label = args[4]
        // <lower_limit> <upper_limit> <receive> <send>
        node.args = [args[1], args[2], args[5], args[6]]
    } else if (node.type === 'bng') {
        // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
        node.layout.size = parseNumberArg(args[0])
        node.layout.hold = parseNumberArg(args[1])
        node.layout.interrupt = parseNumberArg(args[2])
        node.layout.label = args[6]
        node.layout.labelX = parseNumberArg(args[7])
        node.layout.labelY = parseNumberArg(args[8])
        node.layout.labelFont = args[9]
        node.layout.labelFontSize = parseNumberArg(args[10])
        node.layout.bgColor = args[11]
        node.layout.fgColor = args[12]
        node.layout.labelColor = args[13]
        // <init> <send> <receive>
        node.args = [args[3], args[4], args[5]]
    } else if (node.type === 'tgl') {
        // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
        node.layout.size = parseNumberArg(args[0])
        node.layout.label = args[4]
        node.layout.labelX = parseNumberArg(args[5])
        node.layout.labelY = parseNumberArg(args[6])
        node.layout.labelFont = args[7]
        node.layout.labelFontSize = parseNumberArg(args[8])
        node.layout.bgColor = args[9]
        node.layout.fgColor = args[10]
        node.layout.labelColor = args[11]
        // <init> <send> <receive> <init_value> <default_value>
        node.args = [args[1], args[2], args[3], args[12], args[13]]
    } else if (node.type === 'nbx') {
        // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
        // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
        node.layout.size = parseNumberArg(args[0])
        node.layout.height = parseNumberArg(args[1])
        node.layout.log = parseNumberArg(args[4])
        node.layout.label = args[8]
        node.layout.labelX = parseNumberArg(args[9])
        node.layout.labelY = parseNumberArg(args[10])
        node.layout.labelFont = args[11]
        node.layout.labelFontSize = parseNumberArg(args[12])
        node.layout.bgColor = args[13]
        node.layout.fgColor = args[14]
        node.layout.labelColor = args[15]
        node.layout.logHeight = args[17]
        // <min> <max> <init> <send> <receive>
        node.args = [args[2], args[3], args[5], args[6], args[7], args[16]]
    } else if (node.type === 'vsl' || node.type === 'hsl') {
        // <width> <height> <bottom> <top> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
        node.layout.width = parseNumberArg(args[0])
        node.layout.height = parseNumberArg(args[1])
        node.layout.log = parseNumberArg(args[4])
        node.layout.label = args[8]
        node.layout.labelX = parseNumberArg(args[9])
        node.layout.labelY = parseNumberArg(args[10])
        node.layout.labelFont = args[11]
        node.layout.labelFontSize = parseNumberArg(args[12])
        node.layout.bgColor = args[13]
        node.layout.fgColor = args[14]
        node.layout.labelColor = args[15]
        node.layout.steadyOnClick = args[17]
        // <bottom> <top> <init> <send> <receive> <default_value>
        node.args = [
            args[2],
            args[3],
            args[5],
            args[6],
            args[7],
            parseNumberArg(args[2]) +
                ((parseNumberArg(args[3]) - parseNumberArg(args[2])) *
                    parseNumberArg(args[16])) /
                    12700,
        ]
    } else if (node.type === 'vradio' || node.type === 'hradio') {
        // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
        node.layout.size = parseNumberArg(args[0])
        node.layout.label = args[6]
        node.layout.labelX = parseNumberArg(args[7])
        node.layout.labelY = parseNumberArg(args[8])
        node.layout.labelFont = args[9]
        node.layout.labelFontSize = parseNumberArg(args[10])
        node.layout.bgColor = args[11]
        node.layout.fgColor = args[12]
        node.layout.labelColor = args[13]

        // <new_old> <init> <number> <send> <receive> <default_value>
        node.args = [args[1], args[2], args[3], args[4], args[5], args[14]]
    } else if (node.type === 'vu') {
        // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
        node.layout.width = parseNumberArg(args[0])
        node.layout.height = parseNumberArg(args[1])
        node.layout.label = args[3]
        node.layout.labelX = parseNumberArg(args[4])
        node.layout.labelY = parseNumberArg(args[5])
        node.layout.labelFont = args[6]
        node.layout.labelFontSize = parseNumberArg(args[7])
        node.layout.bgColor = args[8]
        node.layout.labelColor = args[9]
        node.layout.log = parseNumberArg(args[10])

        // <receive> <?>
        node.args = [args[2], args[11]]
    } else if (node.type === 'cnv') {
        // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
        node.layout.size = parseNumberArg(args[0])
        node.layout.width = parseNumberArg(args[1])
        node.layout.height = parseNumberArg(args[2])
        node.layout.label = args[5]
        node.layout.labelX = parseNumberArg(args[6])
        node.layout.labelY = parseNumberArg(args[7])
        node.layout.labelFont = args[8]
        node.layout.labelFontSize = parseNumberArg(args[9])
        node.layout.bgColor = args[10]
        node.layout.labelColor = args[11]
        // <send> <receive> <?>
        node.args = [args[3], args[4], args[12]]
    }

    return hydrateNodeGenericAndControl(node, tokenizedLine)
}

function hydrateNodeGenericAndControl(
    node: PdJson.GenericNode,
    { lineAfterComma }: TokenizedLine
): PdJson.GenericNode
function hydrateNodeGenericAndControl(
    node: PdJson.ControlNode,
    { lineAfterComma }: TokenizedLine
): PdJson.ControlNode

function hydrateNodeGenericAndControl(
    node: PdJson.ControlNode | PdJson.GenericNode,
    { lineAfterComma }: TokenizedLine
): PdJson.ControlNode | PdJson.GenericNode {
    // Handling stuff after the comma
    // I have no idea what's the specification for this, so this is really reverse
    // engineering on what appears in pd files.
    if (lineAfterComma) {
        const afterCommaTokens = lineAfterComma.split(TOKENS_RE)
        while (afterCommaTokens.length) {
            const command = afterCommaTokens.shift()
            if (command === 'f') {
                node.layout.width = parseNumberArg(afterCommaTokens.shift())
            }
        }
    }
    node.args = node.args.map(parseArg)
    return node
}
