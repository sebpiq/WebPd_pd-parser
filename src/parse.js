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
    const pd = {}
    Object.values(patchesMap).forEach(({ id, layout, args, tokenizedLines }) => {
      const nodesAndConnections = recursParse(tokenizedLines)
      pd[id] = {
        id, args, layout,
        ...nodesAndConnections
      }
    })
    return pd
}

// interface TokenizedLine {
//     lineIndex: number;
//     chunkType: string; // ENUM ?
//     tokens: Array<string>;
//     lineAfterComma: string;
// }

// function* iterTokenizedLines (pdString: PdString): Generator<TokenizedLine> {
export const tokenizeLines = (pdString) => {
  const tokenizedLines = []

  // use our regular expression to match instances of valid Pd lines
  LINES_RE.lastIndex = 0 // reset lastIndex, in case the previous call threw an error

  let lineIndex = 0
  // let line: RegExpMatchArray
  let lineMatch
  while (lineMatch = LINES_RE.exec(pdString)) {
    // In order to support object width, pd vanilla adds something like ", f 10" at the end
    // of the line. So we need to look for non-escaped comma, and get that part after it.
    // Doing that is annoying in JS since regexps have no look-behind assertions.
    // The hack is to reverse the string, and use a regexp look-forward assertion.
    const lineParts = _reverseString(lineMatch[1]).split(AFTER_COMMA_RE).reverse().map(_reverseString)
    const tokens = lineParts[0].split(TOKENS_RE)
    const chunkType = tokens[0]
    const lineAfterComma = lineParts[1]
    tokenizedLines.push({lineIndex, chunkType, tokens, lineAfterComma})
    lineIndex++
  }

  return tokenizedLines
}

// Recursively extract subpatches
export const extractSubpatches = (tokenizedLines, patchesMap = {}, lineIndexOffset = 0) => {
  patchesMap = {...patchesMap}
  tokenizedLines = [...tokenizedLines]
  let currentPatch = null

  while(tokenizedLines.length) {
    const { chunkType, tokens, lineIndex: lineIndexGlobal } = tokenizedLines[0]
    const lineIndex = lineIndexGlobal - lineIndexOffset

    //================ #N : frameset ================//
    // First line of the patch file, initializes the patch
    if (chunkType === '#N' && tokens[1] === 'canvas' && lineIndex === 0) {
      tokenizedLines.shift()
      currentPatch = {
        id: `${Object.keys(patchesMap).length}`,
        layout: {
          x: parseInt(tokens[2], 10), 
          y: parseInt(tokens[3], 10),
          width: parseInt(tokens[4], 10), 
          height: parseInt(tokens[5], 10),
        },
        args: [tokens[6]],
        tokenizedLines: [],
      }
      if (typeof tokens[7] !== 'undefined') {
        currentPatch.layout.openOnLoad = tokens[7]
      }
      patchesMap[currentPatch.id] = currentPatch

    // If not first line, starts a subpatch
    } else if (chunkType === '#N' && tokens[1] === 'canvas') {
      const [remainingTokenizedLines, updatedPatchesMap] = extractSubpatches(tokenizedLines, patchesMap, lineIndexGlobal)
      tokenizedLines = remainingTokenizedLines
      patchesMap = updatedPatchesMap
    
    // Restore : ends a canvas definition
    } else if (chunkType === '#X' && tokens[1] === 'restore') {
      tokenizedLines[0].chunkType = 'PATCH'
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

const recursParse = (tokenizedLines) => {

  let currentTable = null       // last table name to add samples to
  let idCounter = -1
  const nextId = function() { idCounter++; return idCounter }
  const patch = { nodes: [], connections: [] }

  for (const {chunkType, tokens, lineAfterComma} of tokenizedLines) {
      //console.log(chunkType, tokens)
    
    if (chunkType === 'PATCH') {
      const patchId = tokens[1]
      const canvasType = tokens[4]
      const args = []
      // add subpatch name
      if (canvasType === 'pd') {
        args.push(tokens[5])
      }

      patch.nodes.push({
        id: nextId(),
        subpatch: patchId,
        proto: canvasType,
        args,
        layout: {
          x: parseInt(tokens[2], 10), 
          y: parseInt(tokens[3], 10),
        },
      })
    
      //================ #X : patch elements ================// 
    } else if (chunkType === '#X') {
      var elementType = tokens[1]

      // ---- NODES : object/control instantiation ---- //
      if (NODES.includes(elementType)) {
        var proto  // the object name
          , args   // the construction args for the object
          , layout = {x: parseInt(tokens[2], 10), y: parseInt(tokens[3], 10)}
          , result

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
        if (elementType === 'text') args = [tokens.slice(4).join(' ')]

        // Handling controls' creation arguments
        result = parseControls(proto, args, layout)
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
          proto: proto,
          layout: layout,
          args: parseArgs(args)
        })

      // ---- array : start of an array definition ---- //
      } else if (elementType === 'array') {
        var arrayName = tokens[2]
          , arraySize = parseFloat(tokens[3])
          , table = {
            id: nextId(),
            proto: 'table',
            args: [arrayName, arraySize],
            data: []
          }
        patch.nodes.push(table)

        // remind the last table for handling correctly 
        // the table related instructions which might follow.
        currentTable = table

      // ---- connect : connection between 2 nodes ---- //
      } else if (elementType === 'connect') {
        var sourceId = parseInt(tokens[2], 10)
          , sinkId = parseInt(tokens[4], 10)
          , sourceOutlet = parseInt(tokens[3], 10)
          , sinkInlet = parseInt(tokens[5], 10)

        patch.connections.push({
          source: {id: sourceId, port: sourceOutlet},
          sink: {id: sinkId, port: sinkInlet}
        })

      // ---- coords : visual range of framsets ---- //
      } else if (elementType === 'coords') { // TODO ?
      } else throw new Error('invalid element type for chunk #X : ' + elementType)
      
    //================ #A : array data ================// 
    } else if (chunkType === '#A') {
      // reads in part of an array/table of data, starting at the index specified in this line
      // name of the array/table comes from the the '#X array' and '#X restore' matches above
      var idx = parseFloat(tokens[1]), t, length, val
      if (currentTable) {
        for (t = 2, length = tokens.length; t < length; t++, idx++) {
          val = parseFloat(tokens[t])
          if (isNumber(val) && !isNaN(val)) currentTable.data[idx] = val
        }
      } else {
        console.error('got table data outside of a table.')
      }

    } else throw new Error('invalid chunk : ' + chunkType)

  }

  // end the current table, pad the data with zeros
  if (currentTable) {
    var tableSize = currentTable.args[1]
    while (currentTable.data.length < tableSize)
      currentTable.data.push(0)
    currentTable = null
  }

  return patch
}

// This is put here just for readability of the main `parse` function
var parseControls = function(proto, args, layout) {

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
