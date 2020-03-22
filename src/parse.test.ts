import path from 'path'
import fs from 'fs'
import assert from 'assert'
import parse, { parsePatches } from './parse'
import round from 'lodash.round'
import tokenize, { TokenizedLine, Tokens } from './tokenize'

const TEST_PATCHES_DIR = path.resolve(__dirname, '..', 'test-patches')

const TEST_PATCHES = {
    subpatches: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'subpatches.pd'))
        .toString(),
    simple: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'simple.pd'))
        .toString(),
    nodeElems: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'node-elems.pd'))
        .toString(),
    arrays: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'arrays.pd'))
        .toString(),
    graphs: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'graphs.pd'))
        .toString(),
    objectSizePdVanilla: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'object-size-pd-vanilla.pd'))
        .toString(),
}

const roundArray = (array: Array<number>, precision: number): Array<number> =>
    array.map((val) => round(val, precision))

const assertTokenizedLinesEqual = (
    actualTokenizedLines: Array<TokenizedLine>,
    expectedTokens: Array<Tokens>
): void => {
    assert.equal(actualTokenizedLines.length, expectedTokens.length)
    actualTokenizedLines.forEach(({ tokens: actualTokens }, i) => {
        assert.deepEqual(actualTokens, expectedTokens[i])
    })
}

describe('parse', function () {
    describe('parsePatches', () => {
        it('should extract nested subpatches', () => {
            const tokenizedLines = tokenize(TEST_PATCHES.subpatches)
            const emptyPd: PdJson.Pd = { patches: {}, arrays: {} }
            const [
                pd,
                remainingTokenizedLines,
                patchesTokenizedLines,
            ] = parsePatches(emptyPd, tokenizedLines)
            assert.deepEqual(remainingTokenizedLines, [])
            assert.equal(Object.keys(patchesTokenizedLines).length, 3)

            // root patch
            assert.deepEqual(pd.patches[0].layout, {
                x: 340,
                y: 223,
                width: 450,
                height: 300,
            })
            assert.deepEqual(pd.patches[0].args, ['10'])
            assertTokenizedLinesEqual(patchesTokenizedLines[0], [
                ['#X', 'obj', '78', '81', 'osc~'],
                ['PATCH', '1', '79', '117', 'pd', 'subPatch'],
                ['#X', 'obj', '80', '175', 'dac~'],
                ['#X', 'connect', '0', '0', '1', '0'],
                ['#X', 'connect', '1', '0', '2', '0'],
                ['#X', 'connect', '1', '0', '2', '1'],
            ])

            // subpatch
            assert.deepEqual(pd.patches[1].layout, {
                x: 447,
                y: 260,
                width: 450,
                height: 300,
                openOnLoad: '1',
            })
            assert.deepEqual(pd.patches[1].args, ['mySubpatch'])
            assertTokenizedLinesEqual(patchesTokenizedLines[1], [
                ['#X', 'obj', '46', '39', 'inlet~'],
                ['#X', 'obj', '47', '83', 'delwrite~', 'myDel'],
                ['#X', 'obj', '47', '126', 'delread~', 'myDel'],
                ['#X', 'obj', '48', '165', 'outlet~'],
                ['PATCH', '2', '183', '83', 'pd', 'subSubPatch'],
                ['#X', 'connect', '0', '0', '1', '0'],
                ['#X', 'connect', '2', '0', '3', '0'],
            ])

            // sub-subpatch
            assert.deepEqual(pd.patches[2].layout, {
                x: 842,
                y: 260,
                width: 450,
                height: 300,
                openOnLoad: '1',
            })
            assert.deepEqual(pd.patches[2].args, ['subSubPatch'])
            assertTokenizedLinesEqual(patchesTokenizedLines[2], [
                ['#X', 'obj', '67', '67', 'outlet~'],
                ['#X', 'obj', '66', '32', 'phasor~', '-440'],
                ['#X', 'connect', '1', '0', '0', '0'],
            ])
        })
    })

    describe('parse', function () {
        it('should parse simple patch', function () {
            const pd = parse(TEST_PATCHES.simple)
            assert.equal(Object.keys(pd.patches).length, 1)
            assert.equal(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]

            assert.deepEqual(patch, {
                id: '0',
                layout: { x: 778, y: 17, width: 450, height: 300 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        proto: 'loadbang',
                        args: [],
                        layout: { x: 14, y: 13 },
                    },
                    '1': {
                        id: '1',
                        proto: 'print',
                        args: ['bla'],
                        layout: { x: 14, y: 34 },
                    },
                },
                connections: [
                    {
                        source: { id: '0', port: 0 },
                        sink: { id: '1', port: 0 },
                    },
                ],
            })
        })

        it('should parse objects and controls rightly', function () {
            const pd = parse(TEST_PATCHES.nodeElems)
            assert.equal(Object.keys(pd.patches).length, 1)
            assert.equal(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]

            assert.deepEqual(patch.nodes[0], {
                id: '0',
                proto: 'floatatom',
                args: [0, 0, '-', '-'],
                layout: {
                    x: 73,
                    y: 84,
                    width: 5,
                    labelPos: 0,
                    label: '-',
                },
            })

            assert.deepEqual(patch.nodes[1], {
                id: 1,
                proto: 'msg',
                args: [89],
                layout: { x: 73, y: 43 },
            })

            assert.deepEqual(patch.nodes[2], {
                id: 2,
                proto: 'bng',
                args: [0, 'empty', 'empty'],
                layout: {
                    size: 15,
                    x: 142,
                    y: 42,
                    label: 'empty',
                    labelX: 17,
                    labelY: 7,
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -1,
                    hold: 250,
                    interrupt: 50,
                },
            })

            assert.deepEqual(patch.nodes[3], {
                id: 3,
                proto: 'tgl',
                args: [1, 'tglSendBla', 'tglRcvBla', 10, 10],
                layout: {
                    x: 144,
                    y: 85,
                    size: 15,
                    label: 'empty',
                    labelX: 17,
                    labelY: 7,
                    labelFont: 0,
                    labelFontSize: 4,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -262144,
                },
            })

            assert.deepEqual(patch.nodes[4], {
                id: 4,
                proto: 'nbx',
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
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -1,
                    logHeight: 256,
                },
            })

            assert.deepEqual(patch.nodes[5], {
                id: 5,
                proto: 'hsl',
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
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -1,
                    steadyOnClick: 1,
                },
            })

            assert.deepEqual(patch.nodes[6], {
                id: 6,
                proto: 'vradio',
                args: [1, 0, 8, 'empty', 'empty', 0],
                layout: {
                    x: 249,
                    y: 137,
                    size: 15,
                    label: 'empty',
                    labelX: 0,
                    labelY: -8,
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -1,
                },
            })

            assert.deepEqual(patch.nodes[7], {
                id: 7,
                proto: 'vu',
                args: ['empty', 0],
                layout: {
                    x: 89,
                    y: 141,
                    width: 15,
                    height: 120,
                    label: 'empty',
                    labelX: -1,
                    labelY: -8,
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -66577,
                    labelColor: -1,
                    log: 1,
                },
            })

            assert.deepEqual(patch.nodes[8], {
                id: 8,
                proto: 'cnv',
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
                    labelFont: 0,
                    labelFontSize: 14,
                    bgColor: -233017,
                    labelColor: -66577,
                },
            })

            assert.deepEqual(patch.nodes[9], {
                id: 9,
                proto: 'symbolatom',
                args: [0, 0, '-', '-'],
                layout: { x: 255, y: 38, width: 10, labelPos: 0, label: '-' },
            })

            assert.deepEqual(patch.nodes[10], {
                id: 10,
                proto: 'vsl',
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
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -1,
                    steadyOnClick: 1,
                },
            })

            assert.deepEqual(patch.nodes[11], {
                id: 11,
                proto: 'hradio',
                args: [1, 0, 8, 'empty', 'empty', 0],
                layout: {
                    x: 69,
                    y: 311,
                    size: 15,
                    label: 'empty',
                    labelX: 0,
                    labelY: -8,
                    labelFont: 0,
                    labelFontSize: 10,
                    bgColor: -262144,
                    fgColor: -1,
                    labelColor: -1,
                },
            })

            assert.deepEqual(patch.nodes[12], {
                id: 12,
                proto: 'text',
                args: ['< this comment should be aligned to the hradio'],
                layout: { x: 205, y: 308 },
            })

            assert.deepEqual(patch.connections, [
                { source: { id: 1, port: 0 }, sink: { id: 0, port: 0 } },
                { source: { id: 2, port: 0 }, sink: { id: 0, port: 0 } },
                { source: { id: 6, port: 0 }, sink: { id: 4, port: 0 } },
            ])
        })

        it('should parse array rightly', function () {
            const pd = parse(TEST_PATCHES.arrays)
            assert.equal(Object.keys(pd.patches).length, 2)
            assert.equal(Object.keys(pd.arrays).length, 1)
            const patch = pd.patches['0']
            const arraySubpatch = pd.patches['1']
            const array = pd.arrays['0']

            assert.deepEqual(patch, {
                id: '0',
                layout: { x: 667, y: 72, width: 551, height: 408 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        proto: 'graph',
                        args: [],
                        layout: { x: 157, y: 26 },
                        refId: '1',
                    },
                    '1': {
                        id: '1',
                        proto: 'osc~',
                        args: [440],
                        layout: { x: 19, y: 370 },
                    },
                },
                connections: [],
            })

            assert.deepEqual(arraySubpatch, {
                id: '1',
                layout: {
                    x: 0,
                    y: 0,
                    width: 450,
                    height: 300,
                    openOnLoad: '0',
                },
                args: ['(subpatch)'],
                nodes: {
                    '0': { id: '0', proto: 'array', refId: '0', args: [] },
                },
                connections: [],
            })

            assert.deepEqual(
                { ...array, data: roundArray(array.data, 5) },
                {
                    id: '0',
                    args: ['myTable', 35],
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
        })

        it('should parse graph rightly', function () {
            const pd = parse(TEST_PATCHES.graphs)
            assert.equal(Object.keys(pd.patches).length, 2)
            assert.equal(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]
            const graphSubpatch = pd.patches[1]

            assert.deepEqual(patch, {
                id: '0',
                layout: { x: 49, y: 82, width: 450, height: 300 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        refId: '1',
                        proto: 'graph',
                        args: [],
                        layout: { x: 100, y: 20 },
                    },
                },
                connections: [],
            })

            assert.deepEqual(graphSubpatch, {
                id: '1',
                layout: {
                    x: 0,
                    y: 0,
                    width: 450,
                    height: 300,
                    openOnLoad: '0',
                },
                args: ['(subpatch)'],
                nodes: {},
                connections: [],
            })
        })

        it('should parse subpatches rightly', function () {
            const pd = parse(TEST_PATCHES.subpatches)
            assert.equal(Object.keys(pd.patches).length, 3)
            assert.equal(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]
            const subpatch1 = pd.patches[1]
            const subpatch2 = pd.patches[2]

            assert.deepEqual(patch, {
                id: '0',
                layout: { x: 340, y: 223, width: 450, height: 300 },
                args: ['10'],
                nodes: {
                    '0': {
                        id: '0',
                        proto: 'osc~',
                        args: [],
                        layout: { x: 78, y: 81 },
                    },
                    '1': {
                        id: '1',
                        proto: 'pd',
                        args: ['subPatch'],
                        layout: { x: 79, y: 117 },
                        refId: '1',
                    },
                    '2': {
                        id: '2',
                        proto: 'dac~',
                        args: [],
                        layout: { x: 80, y: 175 },
                    },
                },
                connections: [
                    { source: { id: 0, port: 0 }, sink: { id: 1, port: 0 } },
                    { source: { id: 1, port: 0 }, sink: { id: 2, port: 0 } },
                    { source: { id: 1, port: 0 }, sink: { id: 2, port: 1 } },
                ],
            })

            assert.deepEqual(subpatch1, {
                id: '1',
                layout: {
                    x: 447,
                    y: 260,
                    width: 450,
                    height: 300,
                    openOnLoad: 1,
                },
                args: ['mySubpatch'],
                nodes: {
                    '0': {
                        id: '0',
                        proto: 'inlet~',
                        args: [],
                        layout: { x: 46, y: 39 },
                    },
                    '1': {
                        id: '1',
                        proto: 'delwrite~',
                        args: ['myDel'],
                        layout: { x: 47, y: 83 },
                    },
                    '2': {
                        id: '2',
                        proto: 'delread~',
                        args: ['myDel'],
                        layout: { x: 47, y: 126 },
                    },
                    '3': {
                        id: '3',
                        proto: 'outlet~',
                        args: [],
                        layout: { x: 48, y: 165 },
                    },
                    '4': {
                        id: '4',
                        proto: 'pd',
                        args: ['subSubPatch'],
                        layout: { x: 183, y: 83 },
                        refId: '2',
                    },
                },
                connections: [
                    { source: { id: 0, port: 0 }, sink: { id: 1, port: 0 } },
                    { source: { id: 2, port: 0 }, sink: { id: 3, port: 0 } },
                ],
            })

            assert.deepEqual(subpatch2, {
                id: '2',
                layout: {
                    x: 842,
                    y: 260,
                    width: 450,
                    height: 300,
                    openOnLoad: 1,
                },
                args: ['subSubPatch'],
                nodes: {
                    '0': {
                        id: '0',
                        proto: 'outlet~',
                        args: [],
                        layout: { x: 67, y: 67 },
                    },
                    '1': {
                        id: '1',
                        proto: 'phasor~',
                        args: [-440],
                        layout: { x: 66, y: 32 },
                    },
                },
                connections: [
                    { source: { id: 1, port: 0 }, sink: { id: 0, port: 0 } },
                ],
            })
        })

        it('should parse object size as saved in pd vanilla', function () {
            const pd = parse(TEST_PATCHES.objectSizePdVanilla)
            assert.equal(Object.keys(pd.patches).length, 1)
            assert.equal(Object.keys(pd.arrays).length, 0)
            const patch = pd.patches[0]

            assert.equal(patch.nodes[0].layout.width, 30)
            assert.equal(patch.nodes[1].layout.width, 40)
        })

        it('should fail with an unknown element', function () {
            const patchStr =
                '#N canvas 778 17 450 300 10;\n' +
                '#X obj 14 13 loadbang;\n' +
                '#X weirdElement 14 34 dac~;\n' +
                '#X connect 0 0 1 0;'
            assert.throws(function () {
                parse(patchStr)
            })
        })

        it('should fail with an unknown chunk', function () {
            const patchStr =
                '#N canvas 778 17 450 300 10;\n' +
                '#X obj 14 13 loadbang;\n' +
                '#WEIRD dac~ 14 34 dac~;\n' +
                '#X connect 0 0 1 0;'
            assert.throws(function () {
                parse(patchStr)
            })
        })
    })
})
