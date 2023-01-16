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

import assert from 'assert'
import parse, { parsePatches, nextPatchId, nextArrayId } from './parse'
import round from 'lodash.round'
import tokenize, { TokenizedLine, Tokens } from './tokenize'
import TEST_PATCHES from '@webpd/pd-json/test-patches'
import { PdJson } from '@webpd/pd-json'

const roundArray = (array: Array<number>, precision: number): Array<number> =>
    array.map((val) => round(val, precision))

const assertTokenizedLinesEqual = (
    actualTokenizedLines: Array<TokenizedLine>,
    expectedTokens: Array<Tokens>
): void => {
    assert.strictEqual(actualTokenizedLines.length, expectedTokens.length)
    actualTokenizedLines.forEach(({ tokens: actualTokens }, i) => {
        assert.deepStrictEqual(actualTokens, expectedTokens[i])
    })
}

describe('parse', () => {
    beforeEach(() => {
        nextPatchId.counter = -1
        nextArrayId.counter = -1
    })

    describe('parsePatches', () => {
        it('should extract nested subpatches', () => {
            const tokenizedLines = tokenize(TEST_PATCHES.subpatches)
            const emptyPd: PdJson.Pd = { patches: {}, arrays: {} }
            const [
                pd,
                remainingTokenizedLines,
                patchesTokenizedLines,
            ] = parsePatches(emptyPd, tokenizedLines)
            assert.deepStrictEqual(remainingTokenizedLines, [])
            assert.strictEqual(Object.keys(patchesTokenizedLines).length, 3)

            // root patch
            assert.deepStrictEqual(pd.patches[0].layout, {
                x: 340,
                y: 223,
                width: 450,
                height: 300,
            })
            assert.deepStrictEqual(pd.patches[0].args, ['10'])
            assertTokenizedLinesEqual(patchesTokenizedLines[0], [
                ['#X', 'obj', '78', '81', 'osc~'],
                ['PATCH', '1', '79', '117', 'pd', 'subPatch'],
                ['#X', 'obj', '80', '175', 'dac~'],
                ['#X', 'connect', '0', '0', '1', '0'],
                ['#X', 'connect', '1', '0', '2', '0'],
                ['#X', 'connect', '1', '0', '2', '1'],
            ])

            // subpatch
            assert.deepStrictEqual(pd.patches[1].layout, {
                x: 447,
                y: 260,
                width: 450,
                height: 300,
                openOnLoad: true,
            })
            assert.deepStrictEqual(pd.patches[1].args, ['mySubpatch'])
            assertTokenizedLinesEqual(patchesTokenizedLines[1], [
                ['#X', 'obj', '46', '39', 'inlet~'],
                ['#X', 'obj', '47', '83', 'delwrite~', 'myDel'],
                ['#X', 'obj', '47', '126', 'delread~', 'myDel'],
                ['#X', 'obj', '48', '165', 'outlet~'],
                ['PATCH', '2', '183', '83', 'pd', 'subSubPatch'],
                ['#X', 'connect', '0', '0', '1', '0'],
                ['#X', 'connect', '2', '0', '3', '0'],
            ])
            '1'
            // sub-subpatch
            assert.deepStrictEqual(pd.patches[2].layout, {
                x: 842,
                y: 260,
                width: 450,
                height: 300,
                openOnLoad: true,
            })
            assert.deepStrictEqual(pd.patches[2].args, ['subSubPatch'])
            assertTokenizedLinesEqual(patchesTokenizedLines[2], [
                ['#X', 'obj', '67', '67', 'outlet~'],
                ['#X', 'obj', '66', '32', 'phasor~', '-440'],
                ['#X', 'connect', '1', '0', '0', '0'],
            ])
        })
    })

    describe('parse', () => {
        it('should parse simple patch', () => {
            const pd = parse(TEST_PATCHES.simple)
            assert.strictEqual(Object.keys(pd.patches).length, 1)
            assert.strictEqual(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]

            assert.deepStrictEqual<PdJson.Patch>(patch, {
                id: '0',
                layout: { x: 778, y: 17, width: 450, height: 300 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        type: 'loadbang',
                        nodeClass: 'generic',
                        args: [],
                        layout: { x: 14, y: 13 },
                    },
                    '1': {
                        id: '1',
                        type: 'print',
                        nodeClass: 'generic',
                        args: ['bla'],
                        layout: { x: 14, y: 34 },
                    },
                },
                connections: [
                    {
                        source: { nodeId: '0', portletId: 0 },
                        sink: { nodeId: '1', portletId: 0 },
                    },
                ],
                inlets: [],
                outlets: [],
            })
        })

        it('should parse objects and controls rightly', () => {
            const pd = parse(TEST_PATCHES.nodeElems)
            assert.strictEqual(Object.keys(pd.patches).length, 1)
            assert.strictEqual(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[0], {
                id: '0',
                type: 'floatatom',
                nodeClass: 'control',
                args: [0, 0, '-', '-'],
                layout: {
                    x: 73,
                    y: 84,
                    width: 5,
                    labelPos: 0,
                    label: '-',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[1], {
                id: '1',
                type: 'msg',
                nodeClass: 'generic',
                args: [89],
                layout: { x: 73, y: 43 },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[2], {
                id: '2',
                type: 'bng',
                nodeClass: 'control',
                args: [0, 'empty', 'empty'],
                layout: {
                    size: 15,
                    x: 142,
                    y: 42,
                    label: 'empty',
                    labelX: 17,
                    labelY: 7,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-1',
                    hold: 250,
                    interrupt: 50,
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[3], {
                id: '3',
                type: 'tgl',
                nodeClass: 'control',
                args: [1, 'tglSendBla', 'tglRcvBla', 10, 10],
                layout: {
                    x: 144,
                    y: 85,
                    size: 15,
                    label: 'empty',
                    labelX: 17,
                    labelY: 7,
                    labelFont: '0',
                    labelFontSize: 4,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-262144',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[4], {
                id: '4',
                type: 'nbx',
                nodeClass: 'control',
                args: [-1e37, 1e37, 1, 'empty', 'empty', 56789],
                layout: {
                    x: 180,
                    y: 42,
                    size: 5,
                    height: 14,
                    log: 0,
                    label: 'empty',
                    labelX: 0,
                    labelY: -8,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-1',
                    logHeight: '256',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[5], {
                id: '5',
                type: 'hsl',
                nodeClass: 'control',
                args: [0, 1270, 1, 'empty', 'empty', 580],
                layout: {
                    x: 242,
                    y: 86,
                    width: 128,
                    height: 15,
                    log: 0,
                    label: 'empty',
                    labelX: -2,
                    labelY: -8,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-1',
                    steadyOnClick: '1',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[6], {
                id: '6',
                type: 'vradio',
                nodeClass: 'control',
                args: [1, 0, 8, 'empty', 'empty', 0],
                layout: {
                    x: 249,
                    y: 137,
                    size: 15,
                    label: 'empty',
                    labelX: 0,
                    labelY: -8,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-1',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[7], {
                id: '7',
                type: 'vu',
                nodeClass: 'control',
                args: ['empty', 0],
                layout: {
                    x: 89,
                    y: 141,
                    width: 15,
                    height: 120,
                    label: 'empty',
                    labelX: -1,
                    labelY: -8,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-66577',
                    labelColor: '-1',
                    log: 1,
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[8], {
                id: '8',
                type: 'cnv',
                nodeClass: 'control',
                args: ['empty', 'empty', 0],
                layout: {
                    x: 317,
                    y: 154,
                    size: 15,
                    width: 100,
                    height: 60,
                    label: 'empty',
                    labelX: 20,
                    labelY: 12,
                    labelFont: '0',
                    labelFontSize: 14,
                    bgColor: '-233017',
                    labelColor: '-66577',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[9], {
                id: '9',
                type: 'symbolatom',
                nodeClass: 'control',
                args: [0, 0, '-', '-'],
                layout: { x: 255, y: 38, width: 10, labelPos: 0, label: '-' },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[10], {
                id: '10',
                type: 'vsl',
                nodeClass: 'control',
                args: [0, 12700, 1, 'empty', 'empty', 9500],
                layout: {
                    x: 458,
                    y: 62,
                    width: 15,
                    height: 128,
                    log: 0,
                    label: 'empty',
                    labelX: 0,
                    labelY: -9,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-1',
                    steadyOnClick: '1',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[11], {
                id: '11',
                type: 'hradio',
                nodeClass: 'control',
                args: [1, 0, 8, 'empty', 'empty', 0],
                layout: {
                    x: 69,
                    y: 311,
                    size: 15,
                    label: 'empty',
                    labelX: 0,
                    labelY: -8,
                    labelFont: '0',
                    labelFontSize: 10,
                    bgColor: '-262144',
                    fgColor: '-1',
                    labelColor: '-1',
                },
            })

            assert.deepStrictEqual<PdJson.Node>(patch.nodes[12], {
                id: '12',
                type: 'text',
                nodeClass: 'generic',
                args: ['< this comment should be aligned to the hradio'],
                layout: { x: 205, y: 308 },
            })

            assert.deepStrictEqual<Array<PdJson.Connection>>(patch.connections, [
                {
                    source: { nodeId: '1', portletId: 0 },
                    sink: { nodeId: '0', portletId: 0 },
                },
                {
                    source: { nodeId: '2', portletId: 0 },
                    sink: { nodeId: '0', portletId: 0 },
                },
                {
                    source: { nodeId: '6', portletId: 0 },
                    sink: { nodeId: '4', portletId: 0 },
                },
            ])
        })

        it('should parse arrays rightly', () => {
            const pd = parse(TEST_PATCHES.arrays)
            assert.deepStrictEqual(Object.keys(pd.patches), ['0', '1', '2', '3'])
            assert.deepStrictEqual(Object.keys(pd.arrays), ['0', '1', '2'])
            const patch = pd.patches['0']

            const arraySubpatch = pd.patches['1']
            const arrayNotSavingContentPointsSubpatch = pd.patches['2']
            const arrayNotSavingContentBezierSubpatch = pd.patches['3']
            
            const arrayPolygon = pd.arrays['0']
            const arrayNotSavingContentPoints = pd.arrays['1']
            const arrayNotSavingContentBezier = pd.arrays['2']

            assert.deepStrictEqual<PdJson.Patch>(patch, {
                id: '0',
                layout: { x: 667, y: 72, width: 681, height: 545 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        type: 'graph',
                        nodeClass: 'subpatch',
                        args: [],
                        layout: { x: 157, y: 26 },
                        patchId: '1',
                    },
                    '1': {
                        id: '1',
                        type: 'graph',
                        nodeClass: 'subpatch',
                        args: [],
                        layout: { x: 158, y: 191 },
                        patchId: '2',
                    },
                    '2': {
                        id: '2',
                        type: 'graph',
                        nodeClass: 'subpatch',
                        args: [],
                        layout: { x: 160, y: 358 },
                        patchId: '3',
                    },
                },
                connections: [],
                inlets: [],
                outlets: [],
            })

            assert.deepStrictEqual<PdJson.Patch>(arraySubpatch, {
                id: '1',
                layout: {
                    x: 0,
                    y: 0,
                    width: 450,
                    height: 300,
                    openOnLoad: false,
                },
                args: ['(subpatch)'],
                nodes: {
                    '0': { id: '0', type: 'array', nodeClass: 'array', arrayId: '0', args: [] },
                },
                connections: [],
                inlets: [],
                outlets: [],
            })

            assert.deepStrictEqual<PdJson.Patch['nodes']>(arrayNotSavingContentPointsSubpatch.nodes, {
                '0': { id: '0', type: 'array', nodeClass: 'array', arrayId: '1', args: [] },
            })

            assert.deepStrictEqual<PdJson.Patch['nodes']>(arrayNotSavingContentBezierSubpatch.nodes, {
                '0': { id: '0', type: 'array', nodeClass: 'array', arrayId: '2', args: [] },
            })

            assert.deepStrictEqual<PdJson.PdArray>(
                { ...arrayPolygon, data: roundArray(arrayPolygon.data, 5) },
                {
                    id: '0',
                    args: ['myArrayPolygon', 35, 1],
                    layout: {drawAs: 'polygon'},
                    data: [
                        0.1,
                        0.2,
                        0.3,
                        0.4,
                        0.5,
                        0.6,
                        0.7,
                        0.8,
                        0.9,
                        1,
                        1.1,
                        1.2,
                        1.3,
                        1.4,
                        1.5,
                        1.6,
                        1.7,
                        1.8,
                        1.9,
                        2,
                        2.1,
                        2.2,
                        2.3,
                        2.4,
                        2.5,
                        2.6,
                        2.7,
                        2.8,
                        2.9,
                        3.0,
                        0,
                        0,
                        0,
                        0,
                        0,
                    ],
                }
            )

            assert.deepStrictEqual<PdJson.PdArray>(
                arrayNotSavingContentPoints,
                {
                    id: '1',
                    args: ['myArrayNotSavingContentPoints', 10, 0],
                    layout: {drawAs: 'points'},
                    data: null,
                }
            )

            assert.deepStrictEqual<PdJson.PdArray>(
                arrayNotSavingContentBezier,
                {
                    id: '2',
                    args: ['myArrayNotSavingContentBezier', 100, 0],
                    layout: {drawAs: 'bezier'},
                    data: null,
                }
            )
        })

        it('should parse graph rightly', () => {
            const pd = parse(TEST_PATCHES.graphs)
            assert.strictEqual(Object.keys(pd.patches).length, 2)
            assert.strictEqual(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]
            const graphSubpatch = pd.patches[1]

            assert.deepStrictEqual<PdJson.Patch>(patch, {
                id: '0',
                layout: { x: 49, y: 82, width: 450, height: 300 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        patchId: '1',
                        nodeClass: 'subpatch',
                        type: 'graph',
                        args: [],
                        layout: { x: 100, y: 20 },
                    },
                },
                connections: [],
                inlets: [],
                outlets: [],
            })

            assert.deepStrictEqual<PdJson.Patch>(graphSubpatch, {
                id: '1',
                layout: {
                    x: 0,
                    y: 0,
                    width: 450,
                    height: 300,
                    openOnLoad: false,
                },
                args: ['(subpatch)'],
                nodes: {},
                connections: [],
                inlets: [],
                outlets: [],
            })
        })

        it('should parse subpatches rightly', () => {
            const pd = parse(TEST_PATCHES.subpatches)
            assert.strictEqual(Object.keys(pd.patches).length, 3)
            assert.strictEqual(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]
            const subpatch1 = pd.patches[1]
            const subpatch2 = pd.patches[2]

            assert.deepStrictEqual<PdJson.Patch>(patch, {
                id: '0',
                layout: { x: 340, y: 223, width: 450, height: 300 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        type: 'osc~',
                        nodeClass: 'generic',
                        args: [],
                        layout: { x: 78, y: 81 },
                    },
                    '1': {
                        id: '1',
                        type: 'pd',
                        nodeClass: 'subpatch',
                        args: ['subPatch'],
                        layout: { x: 79, y: 117 },
                        patchId: '1',
                    },
                    '2': {
                        id: '2',
                        type: 'dac~',
                        nodeClass: 'generic',
                        args: [],
                        layout: { x: 80, y: 175 },
                    },
                },
                connections: [
                    {
                        source: { nodeId: '0', portletId: 0 },
                        sink: { nodeId: '1', portletId: 0 },
                    },
                    {
                        source: { nodeId: '1', portletId: 0 },
                        sink: { nodeId: '2', portletId: 0 },
                    },
                    {
                        source: { nodeId: '1', portletId: 0 },
                        sink: { nodeId: '2', portletId: 1 },
                    },
                ],
                inlets: [],
                outlets: [],
            })

            assert.deepStrictEqual<PdJson.Patch>(subpatch1, {
                id: '1',
                layout: {
                    x: 447,
                    y: 260,
                    width: 450,
                    height: 300,
                    openOnLoad: true,
                },
                args: ['mySubpatch'],
                nodes: {
                    '0': {
                        id: '0',
                        type: 'inlet~',
                        nodeClass: 'generic',
                        args: [],
                        layout: { x: 46, y: 39 },
                    },
                    '1': {
                        id: '1',
                        type: 'delwrite~',
                        nodeClass: 'generic',
                        args: ['myDel'],
                        layout: { x: 47, y: 83 },
                    },
                    '2': {
                        id: '2',
                        type: 'delread~',
                        nodeClass: 'generic',
                        args: ['myDel'],
                        layout: { x: 47, y: 126 },
                    },
                    '3': {
                        id: '3',
                        type: 'outlet~',
                        nodeClass: 'generic',
                        args: [],
                        layout: { x: 48, y: 165 },
                    },
                    '4': {
                        id: '4',
                        type: 'pd',
                        nodeClass: 'subpatch',
                        args: ['subSubPatch'],
                        layout: { x: 183, y: 83 },
                        patchId: '2',
                    },
                },
                connections: [
                    {
                        source: { nodeId: '0', portletId: 0 },
                        sink: { nodeId: '1', portletId: 0 },
                    },
                    {
                        source: { nodeId: '2', portletId: 0 },
                        sink: { nodeId: '3', portletId: 0 },
                    },
                ],
                inlets: ['0'],
                outlets: ['3'],
            })

            assert.deepStrictEqual<PdJson.Patch>(subpatch2, {
                id: '2',
                layout: {
                    x: 842,
                    y: 260,
                    width: 450,
                    height: 300,
                    openOnLoad: true,
                },
                args: ['subSubPatch'],
                nodes: {
                    '0': {
                        id: '0',
                        type: 'outlet~',
                        nodeClass: 'generic',
                        args: [],
                        layout: { x: 67, y: 67 },
                    },
                    '1': {
                        id: '1',
                        type: 'phasor~',
                        nodeClass: 'generic',
                        args: [-440],
                        layout: { x: 66, y: 32 },
                    },
                },
                connections: [
                    {
                        source: { nodeId: '1', portletId: 0 },
                        sink: { nodeId: '0', portletId: 0 },
                    },
                ],
                inlets: [],
                outlets: ['0'],
            })
        })

        it('should parse object size as saved in pd vanilla', () => {
            const pd = parse(TEST_PATCHES.objectSizePdVanilla)
            assert.strictEqual(Object.keys(pd.patches).length, 1)
            assert.strictEqual(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]

            assert.strictEqual(patch.nodes[0].layout.width, 30)
            assert.strictEqual(patch.nodes[1].layout.width, 40)
        })

        it('should add inlets and outlets in layout order', () => {
            const pd1 = parse(TEST_PATCHES.portletsOrder1)
            const pd2 = parse(TEST_PATCHES.portletsOrder2)
            assert.deepStrictEqual(pd1.patches[1].inlets, ['0', '1'])
            assert.deepStrictEqual(pd1.patches[1].outlets, ['2', '3'])
            assert.deepStrictEqual(pd2.patches[3].inlets, ['1', '0'])
            assert.deepStrictEqual(pd2.patches[3].outlets, ['3', '2'])
        })

        it('should manage to parse without newline at the end of the file', () => {
            const patchStr =
                '#N canvas 306 267 645 457 10;\n' +
                '#X obj 41 27 osc~ 220;\n' +
                '#X obj 41 50 dac~;\n' +
                '#X connect 0 0 1 0;'
            const pd = parse(patchStr)
            const patch = pd.patches[0]
            assert.strictEqual(Object.keys(patch.nodes).length, 2)
            assert.strictEqual(patch.connections.length, 1)
        })        

        it('should fail with an unknown element', () => {
            const patchStr =
                '#N canvas 778 17 450 300 10;\n' +
                '#X obj 14 13 loadbang;\n' +
                '#X weirdElement 14 34 dac~;\n' +
                '#X connect 0 0 1 0;\n'
            assert.throws(() => {
                parse(patchStr)
            })
        })

        it('should fail with an unknown chunk', () => {
            const patchStr =
                '#N canvas 778 17 450 300 10;\n' +
                '#X obj 14 13 loadbang;\n' +
                '#WEIRD dac~ 14 34 dac~;\n' +
                '#X connect 0 0 1 0;\n'
            assert.throws(() => {
                parse(patchStr)
            })
        })
    })
})
