import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { parse as parseUrl } from 'url'
import * as parsing from './parse.js'
import { tokenizeLines, extractSubpatches } from './parse.js'
const __dirname = path.dirname(parseUrl(import.meta.url).path)
const TEST_PATCHES_DIR = path.resolve(__dirname, '..', 'test-patches')

const TEST_PATCHES = {
  subpatches: fs.readFileSync(path.join(TEST_PATCHES_DIR, 'subpatches.pd')).toString(),
  simple: fs.readFileSync(path.join(TEST_PATCHES_DIR, 'simple.pd')).toString(),
  node_elems: fs.readFileSync(path.join(TEST_PATCHES_DIR, 'node-elems.pd')).toString(),
  arrays: fs.readFileSync(path.join(TEST_PATCHES_DIR, 'arrays.pd')).toString(),
  graphs: fs.readFileSync(path.join(TEST_PATCHES_DIR, 'graphs.pd')).toString(),
  object_size_pd_vanilla: fs.readFileSync(path.join(TEST_PATCHES_DIR, 'object-size-pd-vanilla.pd')).toString(),
}

// round a number to a given number of decimal places
var round = function(num, dec) {
  dec = dec || 4
  var f = Math.pow(10, dec)
  return Math.round(num * f) / f
}

// apply round to all elements of an array
var roundArray = function(array, dec) {
  var roundedArray = []
  for (var i=0; i<array.length; i++) roundedArray[i] = round(array[i], dec)
  return roundedArray
}

const assertTokenizedLinesEqual = (actualTokenizedLines, expectedTokens) => {
  assert.equal(actualTokenizedLines.length, expectedTokens.length)
  actualTokenizedLines.forEach(({tokens: actualTokens}, i) => {
    assert.deepEqual(actualTokens, expectedTokens[i])
  })
}

describe('parsing', function() {

  describe('extractSubpatches', () => {

    it('should extract nested subpatches', () => {
      const tokenizedLines = tokenizeLines(TEST_PATCHES.subpatches)
      
      const [remainingTokenizedLines, patchesMap] = extractSubpatches(tokenizedLines)
      assert.deepEqual(remainingTokenizedLines, [])
      assert.equal(Object.keys(patchesMap).length, 3)

      // root patch
      assert.deepEqual(patchesMap[0].layout, {
        x: 340,
        y: 223,
        width: 450,
        height: 300,
      })
      assert.deepEqual(patchesMap[0].args, ['10'])
      assertTokenizedLinesEqual(patchesMap[0].tokenizedLines, [
        ['#X', 'obj', '78', '81', 'osc~'],
        ['PATCH', '1', '79', '117', 'pd', 'subPatch'],
        ['#X', 'obj', '80', '175', 'dac~'],
        ['#X', 'connect', '0', '0', '1', '0'],
        ['#X', 'connect', '1', '0', '2', '0'],
        ['#X', 'connect', '1', '0', '2', '1'],
      ])

      // subpatch
      assert.deepEqual(patchesMap[1].layout, {
        x: 447,
        y: 260,
        width: 450,
        height: 300,
        openOnLoad: '1',
      })
      assert.deepEqual(patchesMap[1].args, ['mySubpatch'])
      assertTokenizedLinesEqual(patchesMap[1].tokenizedLines, [
        ['#X', 'obj', '46', '39', 'inlet~'],
        ['#X', 'obj', '47', '83', 'delwrite~', 'myDel'],
        ['#X', 'obj', '47', '126', 'delread~', 'myDel'],
        ['#X', 'obj', '48', '165', 'outlet~'],
        ['PATCH', '2', '183', '83', 'pd', 'subSubPatch'],
        ['#X', 'connect', '0', '0', '1', '0'],
        ['#X', 'connect', '2', '0', '3', '0'],
      ])

      // sub-subpatch
      assert.deepEqual(patchesMap[2].layout, {
        x: 842,
        y: 260,
        width: 450,
        height: 300,
        openOnLoad: '1',
      })
      assert.deepEqual(patchesMap[2].args, ['subSubPatch'])
      assertTokenizedLinesEqual(patchesMap[2].tokenizedLines, [
        ['#X', 'obj', '67', '67', 'outlet~'],
        ['#X', 'obj', '66', '32', 'phasor~', '-440'],
        ['#X', 'connect', '1', '0', '0', '0'],
      ])

    })

  })

  describe('#parseNumberArg', function() {

    it('should parse floats rightly', function() {
      assert.strictEqual(parsing.parseNumberArg('789.9'), 789.9)
      assert.strictEqual(parsing.parseNumberArg('0'), 0)
      assert.strictEqual(parsing.parseNumberArg('0.'), 0)
      assert.strictEqual(parsing.parseNumberArg('-0.9'), -0.9)
      assert.strictEqual(parsing.parseNumberArg('-4e-2'), -0.04)
      assert.strictEqual(parsing.parseNumberArg('0.558e2'), 55.8)
    })

    it('return NaN if invalid float', function() {
      assert.ok(isNaN(parsing.parseNumberArg('bla')))
      assert.ok(isNaN(parsing.parseNumberArg([1])))
    })

  })

  describe('#parseArg', function() {

    it('should parse numbers rightly', function() {
      assert.equal(parsing.parseArg(1), 1)
      assert.equal(parsing.parseArg(0.7e-2), 0.007)
      assert.equal(parsing.parseArg('1'), 1)
      assert.equal(parsing.parseArg('0.7e-2'), 0.007)
    })

    it('should parse strings rightly', function() {
      assert.equal(parsing.parseArg('bla'), 'bla')
    })

    it('should unescape dollar vars', function() {
      assert.equal(parsing.parseArg('\\$15'), '$15')
      assert.equal(parsing.parseArg('\\$15-bla-\\$0'), '$15-bla-$0')
    })

    it('should unescape comas and semicolons', function() {
      assert.equal(parsing.parseArg('\\,bla'), ',bla')
      assert.equal(parsing.parseArg('lolo\\;\\,'), 'lolo;,')
    })

    it('should raise error with invalid args', function() {
      assert.throws(function() {
        parsing.parseArg([1, 2])
      })
      assert.throws(function() {
        parsing.parseArg(null)
      })
    })

  })

  describe('#parseArgs', function() {

    it('should parse list of args rightly', function() {
      var parts
      parts = parsing.parseArgs('bla -1    2 3e-1')
      assert.deepEqual(parts, ['bla', -1, 2, 0.3])

      parts = parsing.parseArgs('bla')
      assert.deepEqual(parts, ['bla'])

      parts = parsing.parseArgs('1.8e2')
      assert.deepEqual(parts, [180])

      parts = parsing.parseArgs(1)
      assert.deepEqual(parts, [1])

      parts = parsing.parseArgs([1, '2', 3, 'quatre'])
      assert.deepEqual(parts, [1, 2, 3, 'quatre'])
    })

    it('should raise if args are invalid', function() {
      assert.throws(function() {
        parsing.parseArgs([1, 2, [], 'quatre'])
      })

      assert.throws(function() {
        parsing.parseArgs(null)
      })
    })

  })

  describe('#parse', function() {

    it('should parse simple patch', function() {
      const pd = parsing.parse(TEST_PATCHES.simple)
      assert.equal(Object.keys(pd.patches).length, 1)
      assert.equal(Object.keys(pd.arrays).length, 0)
      const patch = pd.patches[0]

      assert.deepEqual(patch, {
        id: '0',
        layout: {x: 778, y: 17, width: 450, height: 300},
        args: ['10'],
        nodes: [
          {id: 0, proto: 'loadbang', args: [], layout: {x: 14, y: 13}},
          {id: 1, proto: 'print', args: ['bla'], layout: {x: 14, y: 34}},
        ],
        connections: [
          { source: {id: 0, port: 0}, sink: {id: 1, port: 0} }
        ],
      })
    })

    it('should parse objects and controls rightly', function() {
      const pd = parsing.parse(TEST_PATCHES.node_elems)
      assert.equal(Object.keys(pd.patches).length, 1)
      assert.equal(Object.keys(pd.arrays).length, 0)
      const patch = pd.patches[0]

      assert.deepEqual(patch.nodes[0],
        {id: 0, proto: 'floatatom', args: [0, 0, '-', '-'], layout: {
          x: 73, y: 84, width: 5, labelPos: 0, label: '-'}})

      assert.deepEqual(patch.nodes[1], 
        {id: 1, proto: 'msg', args: [89], layout: {x: 73, y: 43}})

      assert.deepEqual(patch.nodes[2], 
        {id: 2, proto: 'bng', args: [0, 'empty', 'empty'], layout: {
          size: 15, x: 142, y: 42, label: 'empty', labelX: 17, labelY: 7, labelFont: 0, labelFontSize: 10,
          bgColor: -262144, fgColor: -1, labelColor: -1, hold: 250, interrupt: 50}})

      assert.deepEqual(patch.nodes[3], 
        {id: 3, proto: 'tgl', args: [1, 'tglSendBla', 'tglRcvBla', 10, 10], layout: {x: 144, y: 85, size: 15, label: 'empty',
          labelX: 17, labelY: 7, labelFont: 0, labelFontSize: 4, bgColor: -262144, fgColor: -1, labelColor: -262144}})

      assert.deepEqual(patch.nodes[4], 
        {id: 4, proto: 'nbx', args: [-1e+37, 1e+37, 1, 'empty', 'empty', 56789], layout: {x: 180, y: 42, size: 5, height: 14,
          log: 0, label: 'empty', labelX: 0, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1,
          labelColor: -1, logHeight: 256}})

      assert.deepEqual(patch.nodes[5], 
        {id: 5, proto: 'hsl', args: [0, 1270, 1, 'empty', 'empty', 580], layout: {x: 242, y: 86, width: 128, height: 15, log: 0,
          label: 'empty', labelX: -2, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1,
          labelColor: -1, steadyOnClick: 1}})

      assert.deepEqual(patch.nodes[6],
        {id: 6, proto: 'vradio', args: [1, 0, 8, 'empty', 'empty', 0], layout: {x: 249, y: 137, size: 15, label: 'empty',
          labelX: 0, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1, labelColor: -1}})

      assert.deepEqual(patch.nodes[7],
        {id: 7, proto: 'vu', args: ['empty', 0], layout: {x: 89, y: 141, width: 15, height: 120, label: 'empty',
          labelX: -1, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -66577, labelColor: -1, log: 1}})

      assert.deepEqual(patch.nodes[8],
        {id: 8, proto: 'cnv', args: ['empty', 'empty', 0], layout: {x: 317, y: 154, size: 15, width: 100, height: 60,
          label: 'empty', labelX: 20, labelY: 12, labelFont: 0, labelFontSize: 14, bgColor: -233017, labelColor: -66577}})

      assert.deepEqual(patch.nodes[9], 
        {id: 9, proto: 'symbolatom', args: [0, 0, '-', '-'], layout: {x: 255, y: 38, width: 10, labelPos: 0, label: '-'}})

      assert.deepEqual(patch.nodes[10],
        {id: 10, proto: 'vsl', args: [0, 12700, 1, 'empty', 'empty', 9500], layout: {x: 458, y: 62, width: 15, height: 128, log: 0, 
          label: 'empty', labelX: 0, labelY: -9, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1,
          labelColor: -1, steadyOnClick: 1}})

      assert.deepEqual(patch.nodes[11],
        {id: 11, proto: 'hradio', args: [1, 0, 8, 'empty', 'empty', 0], layout: {x: 69, y: 311, size: 15, label: 'empty',
          labelX: 0, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1, labelColor: -1}})

      assert.deepEqual(patch.nodes[12],
        {id: 12, proto: 'text', args: ['< this comment should be aligned to the hradio'], layout: {x: 205, y: 308}})

      assert.deepEqual(patch.connections, [
        { source: {id: 1, port: 0}, sink: {id: 0, port: 0} },
        { source: {id: 2, port: 0}, sink: {id: 0, port: 0} },
        { source: {id: 6, port: 0}, sink: {id: 4, port: 0} }
      ])

    })

    it('should parse array rightly', function() {
      const pd = parsing.parse(TEST_PATCHES.arrays)
      assert.equal(Object.keys(pd.patches).length, 2)
      assert.equal(Object.keys(pd.arrays).length, 1)
      const patch = pd.patches[0]
      const arraySubpatch = pd.patches[1]
      const array = pd.arrays[0]

      assert.deepEqual(patch, {
        id: '0',
        layout: {x: 667, y: 72, width: 551, height: 408},
        args: ['10'],
        nodes: [
          {id: 0, proto: 'graph', args: [], layout: {x: 157, y: 26}, subpatch: '1'},
          {id: 1, proto: 'osc~', args: [440], layout: {x: 19, y: 370}},
        ],
        connections: [],
      })

      assert.deepEqual(arraySubpatch, {
        id: '1',
        layout: {x: 0, y: 0, width: 450, height: 300, openOnLoad: '0'},
        args: ['(subpatch)'],
        nodes: [
          {id: 0, proto: 'array', refId: '0'}
        ],
        connections: [],
      })

      assert.deepEqual({...array, data: roundArray(array.data, 5)}, {
        id: '0', args: ['myTable', 35],
        data:
          [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
          1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4,
          2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 0, 0, 0, 0, 0]
      })
    })

    it('should parse graph rightly', function() {
      const pd = parsing.parse(TEST_PATCHES.graphs)
      assert.equal(Object.keys(pd.patches).length, 2)
      assert.equal(Object.keys(pd.arrays).length, 0)
      const patch = pd.patches[0]
      const graphSubpatch = pd.patches[1]

      assert.deepEqual(patch, {
        id: '0',
        layout: { x: 49, y: 82, width: 450, height: 300 },
        args: ['10'],
        nodes: [
          {
            id: 0,
            subpatch: '1',
            proto: 'graph',
            args: [],
            layout: { x: 100, y: 20 }
          }
        ],
        connections: [],
      })

      assert.deepEqual(graphSubpatch, { 
        id: '1',
        layout: { x: 0, y: 0, width: 450, height: 300, openOnLoad: '0' },
        args: ['(subpatch)'], 
        nodes: [],
        connections: [],
      })
    })

    it('should parse subpatches rightly', function() {
      const pd = parsing.parse(TEST_PATCHES.subpatches)
      assert.equal(Object.keys(pd.patches).length, 3)
      assert.equal(Object.keys(pd.arrays).length, 0)
      const patch = pd.patches[0]
      const subpatch1 = pd.patches[1]
      const subpatch2 = pd.patches[2]
  
      assert.deepEqual(patch, {
        id: '0',
        layout: {x: 340, y: 223, width: 450, height: 300},
        args: ['10'],
        nodes: [
          {id: 0, proto: 'osc~', args: [], layout: {x: 78, y: 81}},
          {id: 1, proto: 'pd', args: ['subPatch'], layout: {x: 79, y: 117}, subpatch: '1'},
          {id: 2, proto: 'dac~', args: [], layout: {x: 80, y: 175}}
        ],
        connections: [
          {source: {id: 0, port: 0}, sink: {id: 1, port: 0}},
          {source: {id: 1, port: 0}, sink: {id: 2, port: 0}},
          {source: {id: 1, port: 0}, sink: {id: 2, port: 1}}
        ],
      })

      assert.deepEqual(subpatch1, {
        id: '1',
        layout: {x: 447, y: 260, width: 450, height: 300, openOnLoad: 1},
        args: ['mySubpatch'],
        nodes: [
          {id: 0, proto: 'inlet~', args: [], layout: {x: 46, y: 39}},
          {id: 1, proto: 'delwrite~', args: ['myDel'], layout: {x: 47, y: 83}},
          {id: 2, proto: 'delread~', args: ['myDel'], layout: {x: 47, y: 126}},
          {id: 3, proto: 'outlet~', args: [], layout: {x: 48, y: 165}},
          {id: 4, proto: 'pd', args: ['subSubPatch'], layout: {x: 183, y: 83}, subpatch: '2'},
        ],
        connections: [
          {source: {id: 0, port: 0}, sink: {id: 1, port: 0}},
          {source: {id: 2, port: 0}, sink: {id: 3, port: 0}}
        ],
      })

      assert.deepEqual(subpatch2, {
        id: '2',
        layout: {x: 842, y: 260, width: 450, height: 300, openOnLoad: 1},
        args: ['subSubPatch'],
        nodes: [
          {id: 0, proto: 'outlet~', args: [], layout: {x: 67, y: 67}},
          {id: 1, proto: 'phasor~', args: [-440], layout: {x: 66, y: 32}}
        ],
        connections: [
          {source: {id: 1, port: 0}, sink: {id: 0, port: 0}}
        ],
      })

    })

    it('should parse object size as saved in pd vanilla', function() {
      const pd = parsing.parse(TEST_PATCHES.object_size_pd_vanilla)
      assert.equal(Object.keys(pd.patches).length, 1)
      assert.equal(Object.keys(pd.arrays).length, 0)
      const patch = pd.patches[0]

      assert.equal(patch.nodes[0].layout.width, 30)
      assert.equal(patch.nodes[1].layout.width, 40)
    })

    it('should fail with an unknown element', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
          + '#X obj 14 13 loadbang;\n'
          + '#X weirdElement 14 34 dac~;\n'
          + '#X connect 0 0 1 0;'
        assert.throws(function() {
          var patch = parsing.parse(patchStr)
        })
    })

    it('should fail with an unknown chunk', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
          + '#X obj 14 13 loadbang;\n'
          + '#WEIRD dac~ 14 34 dac~;\n'
          + '#X connect 0 0 1 0;'
        assert.throws(function() {
          var patch = parsing.parse(patchStr)
        })
    })

  })

})
