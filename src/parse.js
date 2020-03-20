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

import isNumber from 'lodash.isnumber'
import isString from 'lodash.isstring'


var NODES = ['obj', 'floatatom', 'symbolatom', 'msg', 'text']

// Regular expression to split tokens in a message.
const TOKENS_RE = / |\r\n?|\n/
const AFTER_COMMA_RE = /,(?!\\)/

// Regular expressions to detect escaped special chars.
const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g
const ESCAPED_COMMA_VAR_RE_GLOB = /\\\,/g
const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\\;/g

// Regular expression for finding valid lines of Pd in a file
const LINES_RE = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/ig

// Helper function to reverse a string
// const _reverseString = (s: string): string => s.split("").reverse().join("")
const _reverseString = (s) => s.split("").reverse().join("")

// const _isNumber = (obj: any): boolean => isNumber(obj) && !isNaN(obj)
const _isNumber = (obj) => isNumber(obj) && !isNaN(obj)

const _tokensMatch = (tokens, ...values) => 
  values.every((value, i) => value === tokens[i])

// Parses argument to a string or a number.
// export const parseArg = (arg: string): ObjectArgument => {
export const parseArg = (arg) => {
  const parsed = parseNumberArg(arg)
  if (_isNumber(parsed)) {
      return parsed

  } else if (isString(arg)) {
    arg = arg.substr(0)
    // Unescape special characters
    arg = arg.replace(ESCAPED_COMMA_VAR_RE_GLOB, ',')
    arg = arg.replace(ESCAPED_SEMICOLON_VAR_RE_GLOB, ';')
    let matched
    while (matched = ESCAPED_DOLLAR_VAR_RE_GLOB.exec(arg)) {
      arg = arg.replace(matched[0], matched[1])
    }
    return arg

  } else {
    throw new Error('couldn\'t parse arg ' + arg)
  }
}

// Parses a float from a .pd file. Returns the parsed float or NaN.
// export const parseNumberArg = (data: string): number => {
export const parseNumberArg = (data) => {
  if (_isNumber(data)) {
    return data

  } else if (isString(data)) {
    return parseFloat(data)
    
  } else {
    return NaN
  }
}

// Converts arguments to a javascript array
// ???? What does that do exactly?
// ???? Don't we tokenize already ? 
// ???? why would we ever receive an int there ?
export const parseArgs = (args) => {
    
  // if it's an int, make a single valued array
  if (_isNumber(args)) {
      return [args]

  // if it's a string, split the atom
  } else {
    const parts = isString(args) ? args.split(TOKENS_RE) : args
    const parsed = []
    let arg, i, length

    for (i = 0, length = parts.length; i < length; i++) {
      if ((arg = parts[i]) === '') continue
      else parsed.push(parseArg(arg))
    }
    return parsed
  }
}

// Parses a Pd file, creates and returns a graph from it
// export const parse = (pdString: PdString) => {
export const parse = (pdString) => {
  const tokenizedLines = tokenizeLines(pdString)
  const [_, patchesMap] = extractSubpatches(tokenizedLines)
  const pd = {
    patches: {},
    arrays: {},
  }
  Object.values(patchesMap).forEach(({ id, layout, args, tokenizedLines }) => {
    const [tokenizedLinesWithoutArrays, arraysMap] = extractArrays(tokenizedLines, pd.arrays)
    const nodesAndConnections = recursParse(tokenizedLinesWithoutArrays)
    pd.patches[id] = {
      id, args, layout,
      ...nodesAndConnections
    }
    pd.arrays = {
      ...pd.arrays,
      ...arraysMap
    }
  })
  return pd
}

// interface TokenizedLine {
//     tokens: Array<string>;
//     lineAfterComma: string;
// }

// function* iterTokenizedLines (pdString: PdString): Generator<TokenizedLine> {
export const tokenizeLines = (pdString) => {
  const tokenizedLines = []

  // use our regular expression to match instances of valid Pd lines
  LINES_RE.lastIndex = 0 // reset lastIndex, in case the previous call threw an error

  // let line: RegExpMatchArray
  let lineMatch
  while (lineMatch = LINES_RE.exec(pdString)) {
    // In order to support object width, pd vanilla adds something like ", f 10" at the end
    // of the line. So we need to look for non-escaped comma, and get that part after it.
    // Doing that is annoying in JS since regexps have no look-behind assertions.
    // The hack is to reverse the string, and use a regexp look-forward assertion.
    const lineParts = _reverseString(lineMatch[1]).split(AFTER_COMMA_RE).reverse().map(_reverseString)
    const tokens = lineParts[0].split(TOKENS_RE)
    const lineAfterComma = lineParts[1]
    tokenizedLines.push({ tokens, lineAfterComma})
  }

  return tokenizedLines
}

const HYDRATORS = {
  '#N canvas': ({ tokens }) => {
    const data = {
      layout: {
        x: parseInt(tokens[2], 10), 
        y: parseInt(tokens[3], 10),
        width: parseInt(tokens[4], 10), 
        height: parseInt(tokens[5], 10),
      },
      args: [tokens[6]],
    }
    if (typeof tokens[7] !== 'undefined') {
      data.layout.openOnLoad = tokens[7]
    }
    return data
  },

  'PATCH': ({ tokens }) => {
    const canvasType = tokens[4]
    const args = []
    // add subpatch name
    if (canvasType === 'pd') {
      args.push(tokens[5])
    }

    return {
      proto: canvasType,
      refId: tokens[1],
      args,
      layout: {
        x: parseInt(tokens[2], 10), 
        y: parseInt(tokens[3], 10),
      },
    }
  },

  'ARRAY': ({ tokens }) => ({
    proto: 'array',
    refId: tokens[1],
    args: [],
  }),

  '#X array': ({ tokens }) => {
    const arrayName = tokens[2]
    const arraySize = parseFloat(tokens[3])
    return {
      args: [arrayName, arraySize],
      data: new Float32Array(arraySize)
    }
  },

  '#X connect': ({ tokens }) => ({
    source: {
      id: parseInt(tokens[2], 10), 
      port: parseInt(tokens[3], 10)
    },
    sink: {
      id: parseInt(tokens[4], 10), 
      port: parseInt(tokens[5], 10)
    }
  })

}

// Recursively extract subpatches
export const extractSubpatches = (tokenizedLines, patchesMap = {}) => {
  patchesMap = {...patchesMap}
  tokenizedLines = [...tokenizedLines]
  let currentPatch = null
  let lineIndex = -1

  while(tokenizedLines.length) {
    const { tokens } = tokenizedLines[0]
    lineIndex++

    // First line of the patch / subpatch, initializes the patch
    if (_tokensMatch(tokens, '#N', 'canvas') && lineIndex === 0) {
      currentPatch = {
        id: `${Object.keys(patchesMap).length}`,
        tokenizedLines: [],
        ...HYDRATORS['#N canvas'](tokenizedLines[0]),
      }
      patchesMap[currentPatch.id] = currentPatch
      tokenizedLines.shift()

    // If not first line, starts a subpatch
    } else if (_tokensMatch(tokens, '#N', 'canvas')) {
      const [remainingTokenizedLines, updatedPatchesMap] = extractSubpatches(tokenizedLines, patchesMap)
      tokenizedLines = remainingTokenizedLines
      patchesMap = updatedPatchesMap
    
    // Restore : ends a canvas definition
    } else if (_tokensMatch(tokens, '#X', 'restore')) {
      tokenizedLines[0].tokens[0] = 'PATCH'
      tokenizedLines[0].tokens[1] = currentPatch.id
      return [tokenizedLines, patchesMap]

    // A normal chunk to add to the current patch
    } else {
      currentPatch.tokenizedLines.push(tokenizedLines.shift())
    }
  }

  return [tokenizedLines, patchesMap]
}

const extractArrays = (tokenizedLines, arraysMap = {}) => {
  arraysMap = {...arraysMap}
  tokenizedLines = [...tokenizedLines]
  const remainingTokenizedLines = []

  // remind the last table for handling correctly 
  // the table related instructions which might follow.
  let currentArray = null

  while(tokenizedLines.length) {
    const { tokens } = tokenizedLines[0]

    // start of an array definition
    if (_tokensMatch(tokens, '#X', 'array')) {
      currentArray = {
        id: `${Object.keys(arraysMap).length}`,
        ...HYDRATORS['#X array'](tokenizedLines[0])
      }
      arraysMap[currentArray.id] = currentArray
      remainingTokenizedLines.push({ 
        tokens: ['ARRAY', currentArray.id],
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
      tokens.slice(2).forEach((val, i) => {
        val = parseFloat(val)
        if (_isNumber(val)) {
          currentArray.data[indexOffset + i] = val
        }
      })
      tokenizedLines.shift()

    // A normal chunk to add to the current patch
    } else {
      remainingTokenizedLines.push(tokenizedLines.shift())
    }

  }

  return [remainingTokenizedLines, arraysMap]
}

const recursParse = (tokenizedLines) => {

  let idCounter = -1
  const nextId = () => ++idCounter
  const patch = { nodes: [], connections: [] }

  for (const tokenizedLine of tokenizedLines) {
    const {tokens, lineAfterComma} = tokenizedLine

    if (_tokensMatch(tokens, 'PATCH')) {
      patch.nodes.push({
        id: nextId(),
        ...HYDRATORS['PATCH'](tokenizedLine)
      })
    
    } else if (_tokensMatch(tokens, 'ARRAY')) {
      patch.nodes.push({
        id: nextId(),
        ...HYDRATORS['ARRAY'](tokenizedLine)
      })

    } else if (_tokensMatch(tokens, '#X', 'connect')) {
      patch.connections.push(HYDRATORS['#X connect'](tokenizedLine))

    // ---- NODES : object/control instantiation ---- //
    } else if (NODES.some(nodeType => _tokensMatch(tokens, '#X', nodeType))) {

        const elementType = tokens[1]
        let proto  // the object name
        let args   // the construction args for the object
        let layout = {x: parseInt(tokens[2], 10), y: parseInt(tokens[3], 10)}

        // 2 categories here :
        //  - elems whose name is `elementType`
        //  - elems whose name is `token[4]`
        if (elementType === 'obj') {
          proto = tokens[4]
          args = tokens.slice(5)
        } else {
          proto = elementType
          args = tokens.slice(4)
        }

        if (elementType === 'text') {
          args = [tokens.slice(4).join(' ')]
        }

        // Handling controls' creation arguments
        const result = parseControls(proto, args, layout)
        args = result[0]
        layout = result[1]

        // Handling stuff after the comma
        // I have no idea what's the specification for this, so this is really reverse
        // engineering on what appears in pd files.
        if (lineAfterComma) {
          var afterCommaTokens = lineAfterComma.split(TOKENS_RE)
          while (afterCommaTokens.length) {
            var command = afterCommaTokens.shift()
            if (command === 'f')
              layout.width = afterCommaTokens.shift()
          }
        }

        // Add the object to the graph
        patch.nodes.push({
          id: nextId(),
          proto,
          layout,
          args: parseArgs(args)
        })

      // ---- coords : visual range of framsets ---- //
      } else if (_tokensMatch(tokens, '#X', 'coords')) {
        
      } else throw new Error(`invalid chunk : ${tokens}`)

  }

  return patch
}

// This is put here just for readability of the main `parse` function
const parseControls = (proto, args, layout) => {

  if (proto === 'floatatom') {
    // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
    layout.width = args[0] ; layout.labelPos = args[3] ; layout.label = args[4]
    // <lower_limit> <upper_limit> <receive> <send>
    args = [args[1], args[2], args[5], args[6]]
  } else if (proto === 'symbolatom') {
    // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
    layout.width = args[0] ; layout.labelPos = args[3] ; layout.label = args[4]
    // <lower_limit> <upper_limit> <receive> <send>
    args = [args[1], args[2], args[5], args[6]]
  } else if (proto === 'bng') {
    // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
    layout.size = args[0] ; layout.hold = args[1] ; layout.interrupt = args[2]
    layout.label = args[6] ; layout.labelX = args[7] ; layout.labelY = args[8]
    layout.labelFont = args[9] ; layout.labelFontSize = args[10] ; layout.bgColor = args[11]
    layout.fgColor = args[12] ; layout.labelColor = args[13]
    // <init> <send> <receive>
    args = [args[3], args[4], args[5]]
  } else if (proto === 'tgl') {
    // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
    layout.size = args[0] ; layout.label = args[4] ; layout.labelX = args[5]
    layout.labelY = args[6] ; layout.labelFont = args[7] ; layout.labelFontSize = args[8]
    layout.bgColor = args[9] ; layout.fgColor = args[10] ; layout.labelColor = args[11]
    // <init> <send> <receive> <init_value> <default_value>
    args = [args[1], args[2], args[3], args[12], args[13]]
  } else if (proto === 'nbx') {
    // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
    // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
    layout.size = args[0] ; layout.height = args[1] ; layout.log = args[4]
    layout.label = args[8] ; layout.labelX = args[9] ; layout.labelY = args[10]
    layout.labelFont = args[11] ; layout.labelFontSize = args[12] ; layout.bgColor = args[13]
    layout.fgColor = args[14] ; layout.labelColor = args[15] ; layout.logHeight = args[17]
    // <min> <max> <init> <send> <receive>
    args = [args[2], args[3], args[5], args[6], args[7], args[16]]
  } else if (proto === 'vsl') {
    // <width> <height> <bottom> <top> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
    layout.width = args[0] ; layout.height = args[1] ; layout.log = args[4]
    layout.label = args[8] ; layout.labelX = args[9] ; layout.labelY = args[10]
    layout.labelFont = args[11] ; layout.labelFontSize = args[12] ; layout.bgColor = args[13]
    layout.fgColor = args[14] ; layout.labelColor = args[15] ; layout.steadyOnClick = args[17]
    // <bottom> <top> <init> <send> <receive> <default_value>
    args = [args[2], args[3], args[5], args[6], args[7], args[2] + (args[3] - args[2]) * args[16] / 12700]
  } else if (proto === 'hsl') {
    // <width> <height> <bottom> <top> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
    layout.width = args[0] ; layout.height = args[1] ; layout.log = args[4]
    layout.label = args[8] ; layout.labelX = args[9] ; layout.labelY = args[10]
    layout.labelFont = args[11] ; layout.labelFontSize = args[12] ; layout.bgColor = args[13]
    layout.fgColor = args[14] ; layout.labelColor = args[15] ; layout.steadyOnClick = args[17]
    // <bottom> <top> <init> <send> <receive> <default_value>
    args = [args[2], args[3], args[5], args[6], args[7], args[2] + (args[3] - args[2]) * args[16] / 12700]
  } else if (proto === 'vradio') {
    // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
    layout.size = args[0] ; layout.label = args[6] ; layout.labelX = args[7]
    layout.labelY = args[8] ; layout.labelFont = args[9] ; layout.labelFontSize = args[10]
    layout.bgColor = args[11] ; layout.fgColor = args[12] ; layout.labelColor = args[13]
    // <new_old> <init> <number> <send> <receive> <default_value>
    args = [args[1], args[2], args[3], args[4], args[5], args[14]]
  } else if (proto === 'hradio') {
    // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
    layout.size = args[0] ; layout.label = args[6] ; layout.labelX = args[7]
    layout.labelY = args[8] ; layout.labelFont = args[9] ; layout.labelFontSize = args[10]
    layout.bgColor = args[11] ; layout.fgColor = args[12] ; layout.labelColor = args[13]
    // <new_old> <init> <number> <send> <receive> <default_value>
    args = [args[1], args[2], args[3], args[4], args[5], args[14]]
  } else if (proto === 'vu') {
    // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
    layout.width = args[0] ; layout.height = args[1] ; layout.label = args[3]
    layout.labelX = args[4] ; layout.labelY = args[5] ; layout.labelFont = args[6]
    layout.labelFontSize = args[7] ; layout.bgColor = args[8] ; layout.labelColor = args[9]
    layout.log = args[10]
    // <receive> <?>
    args = [args[2], args[11]]
  } else if (proto === 'cnv') {
    // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
    layout.size = args[0] ; layout.width = args[1] ; layout.height = args[2]
    layout.label = args[5] ; layout.labelX = args[6] ; layout.labelY = args[7]
    layout.labelFont = args[8] ; layout.labelFontSize = args[9] ; layout.bgColor = args[10]
    layout.labelColor = args[11]
    // <send> <receive> <?>
    args = [args[3], args[4], args[12]]
  }
  // Other objects (including msg) all args belong to the graph model

  return [args, layout]

}
