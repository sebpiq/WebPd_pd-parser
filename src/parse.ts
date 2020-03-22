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

import isNumber from "lodash.isnumber";
import isString from "lodash.isstring";
import { Tokens, TokenizedLine, ControlType } from "./types";

const NODES = ["obj", "floatatom", "symbolatom", "msg", "text"];

// Regular expression to split tokens in a message.
const TOKENS_RE = / |\r\n?|\n/;
const AFTER_COMMA_RE = /,(?!\\)/;

// Regular expressions to detect escaped special chars.
const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g;
const ESCAPED_COMMA_VAR_RE_GLOB = /\\\,/g;
const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\\;/g;

// Regular expression for finding valid lines of Pd in a file
const LINES_RE = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/gi;

// Helper function to reverse a string
const _reverseString = (s: string): string => s.split("").reverse().join("");

const _isNumber = (obj: number | string): obj is number =>
  isNumber(obj) && !isNaN(obj);

const _tokensMatch = (tokens: Tokens, ...values: Tokens): boolean =>
  values.every((value, i) => value === tokens[i]);

// Parses argument to a string or a number.
// Needs to handle the case when the argument is already a number as in the process of gathering
// arguments we sometimes insert a number.
export const parseArg = (arg: PdJson.ObjectArgument): PdJson.ObjectArgument => {
  const parsed = parseNumberArg(arg);
  if (_isNumber(parsed)) {
    return parsed;
  } else if (isString(arg)) {
    arg = arg.substr(0);
    // Unescape special characters
    arg = arg.replace(ESCAPED_COMMA_VAR_RE_GLOB, ",");
    arg = arg.replace(ESCAPED_SEMICOLON_VAR_RE_GLOB, ";");
    let matched;
    while ((matched = ESCAPED_DOLLAR_VAR_RE_GLOB.exec(arg))) {
      arg = arg.replace(matched[0], matched[1]);
    }
    return arg;
  } else {
    throw new Error("couldn't parse arg " + arg);
  }
};

// Parses a float from a .pd file. Returns the parsed float or NaN.
export const parseNumberArg = (val: PdJson.ObjectArgument): number => {
  if (_isNumber(val)) {
    return val;
  } else if (isString(val)) {
    return parseFloat(val);
  } else {
    return NaN;
  }
};

// Parses a '0' or '1' from a .pd file. Returns the equivalent boolean.
export const parseBoolArg = (val: PdJson.ObjectArgument): boolean => {
  if (_isNumber(val)) {
    return !!val;
  } else if (isString(val)) {
    const num = parseInt(val, 10);
    if (!_isNumber(num)) {
      throw new Error(`invalid number ${val}`);
    }
    return !!num;
  } else {
    throw new Error(`invalid input ${val}`);
  }
};

// Parses a Pd file, creates and returns a graph from it
export const parse = (pdString: Pd.PdString): PdJson.Pd => {
  const pd: PdJson.Pd = {
    patches: {},
    arrays: {},
  };
  const tokenizedLines = tokenizeLines(pdString);
  const [_, patchTokenizedLinesMap] = parsePatches(pd, tokenizedLines);
  Object.values(pd.patches).forEach((patch) => {
    const tokenizedLines = patchTokenizedLinesMap[patch.id];
    const [tokenizedLinesWithoutArrays, arraysMap] = parseArrays(
      tokenizedLines,
      pd.arrays
    );
    recursParse(tokenizedLinesWithoutArrays, patch);
    pd.patches[patch.id] = patch;
    pd.arrays = {
      ...pd.arrays,
      ...arraysMap,
    };
  });
  return pd;
};

export const tokenizeLines = (pdString: Pd.PdString): Array<TokenizedLine> => {
  const tokenizedLines: Array<TokenizedLine> = [];

  // use our regular expression to match instances of valid Pd lines
  LINES_RE.lastIndex = 0; // reset lastIndex, in case the previous call threw an error

  // let line: RegExpMatchArray
  let lineMatch;
  while ((lineMatch = LINES_RE.exec(pdString))) {
    // In order to support object width, pd vanilla adds something like ", f 10" at the end
    // of the line. So we need to look for non-escaped comma, and get that part after it.
    // Doing that is annoying in JS since regexps have no look-behind assertions.
    // The hack is to reverse the string, and use a regexp look-forward assertion.
    const lineParts = _reverseString(lineMatch[1])
      .split(AFTER_COMMA_RE)
      .reverse()
      .map(_reverseString);
    const tokens = lineParts[0].split(TOKENS_RE);
    const lineAfterComma = lineParts[1];
    tokenizedLines.push({ tokens, lineAfterComma });
  }

  return tokenizedLines;
};

const HYDRATORS = {
  "#N canvas": ({ tokens }: TokenizedLine) => {
    const layout: PdJson.PatchLayout = {
      x: parseInt(tokens[2], 10),
      y: parseInt(tokens[3], 10),
      width: parseInt(tokens[4], 10),
      height: parseInt(tokens[5], 10),
    };
    const data = {
      layout,
      args: [tokens[6]],
    };
    if (typeof tokens[7] !== "undefined") {
      data.layout.openOnLoad = parseBoolArg(tokens[7]);
    }
    return data;
  },

  PATCH: ({ tokens }: TokenizedLine) => {
    const canvasType = tokens[4];
    const args = [];
    // add subpatch name
    if (canvasType === "pd") {
      args.push(tokens[5]);
    }

    return {
      proto: canvasType,
      refId: tokens[1],
      args,
      layout: {
        x: parseInt(tokens[2], 10),
        y: parseInt(tokens[3], 10),
      },
    };
  },

  ARRAY: ({ tokens }: TokenizedLine) => ({
    proto: "array",
    refId: tokens[1],
    args: [] as Array<PdJson.ObjectArgument>,
  }),

  "#X array": ({ tokens }: TokenizedLine) => {
    const arrayName = tokens[2];
    const arraySize = parseFloat(tokens[3]);
    return {
      args: [arrayName, arraySize],
      data: Array(arraySize).fill(0),
    };
  },

  "#X connect": ({ tokens }: TokenizedLine) => ({
    source: {
      id: tokens[2],
      port: parseInt(tokens[3], 10),
    },
    sink: {
      id: tokens[4],
      port: parseInt(tokens[5], 10),
    },
  }),
};

// Recursively parse subpatches
export const parsePatches = (
  pd: PdJson.Pd,
  tokenizedLines: Array<TokenizedLine>,
  patchTokenizedLinesMap: { [globalId: string]: Array<TokenizedLine> } = {}
): [Array<TokenizedLine>, { [globalId: string]: Array<TokenizedLine> }] => {
  tokenizedLines = [...tokenizedLines];
  patchTokenizedLinesMap = { ...patchTokenizedLinesMap };
  let currentPatch: PdJson.Patch | null = null;
  let lineIndex = -1;

  while (tokenizedLines.length) {
    const { tokens } = tokenizedLines[0];
    lineIndex++;

    // First line of the patch / subpatch, initializes the patch
    if (_tokensMatch(tokens, "#N", "canvas") && lineIndex === 0) {
      currentPatch = {
        id: `${Object.keys(pd.patches).length}`,
        nodes: {},
        connections: [],
        ...HYDRATORS["#N canvas"](tokenizedLines[0]),
      };
      pd.patches[currentPatch.id] = currentPatch;
      patchTokenizedLinesMap[currentPatch.id] = [];
      tokenizedLines.shift();

      // If not first line, starts a subpatch
    } else if (_tokensMatch(tokens, "#N", "canvas")) {
      const [remainingTokenizedLines, updatedTokenizedLinesMap] = parsePatches(
        pd,
        tokenizedLines,
        patchTokenizedLinesMap
      );
      tokenizedLines = remainingTokenizedLines;
      patchTokenizedLinesMap = updatedTokenizedLinesMap;

      // Restore : ends a canvas definition
    } else if (_tokensMatch(tokens, "#X", "restore")) {
      tokenizedLines[0].tokens[0] = "PATCH";
      tokenizedLines[0].tokens[1] = currentPatch.id;
      return [tokenizedLines, patchTokenizedLinesMap];

      // A normal chunk to add to the current patch
    } else {
      patchTokenizedLinesMap[currentPatch.id].push(tokenizedLines.shift());
    }
  }

  return [tokenizedLines, patchTokenizedLinesMap];
};

const parseArrays = (
  tokenizedLines: Array<TokenizedLine>,
  arraysMap: { [globalId: string]: PdJson.PdArray } = {}
): [Array<TokenizedLine>, { [globalId: string]: PdJson.PdArray }] => {
  arraysMap = { ...arraysMap };
  tokenizedLines = [...tokenizedLines];
  const remainingTokenizedLines: Array<TokenizedLine> = [];

  // remind the last table for handling correctly
  // the table related instructions which might follow.
  let currentArray: PdJson.PdArray | null = null;

  while (tokenizedLines.length) {
    const { tokens } = tokenizedLines[0];

    // start of an array definition
    if (_tokensMatch(tokens, "#X", "array")) {
      currentArray = {
        id: `${Object.keys(arraysMap).length}`,
        ...HYDRATORS["#X array"](tokenizedLines[0]),
      };
      arraysMap[currentArray.id] = currentArray;
      remainingTokenizedLines.push({
        tokens: ["ARRAY", currentArray.id],
        lineAfterComma: "",
      });
      tokenizedLines.shift();

      // array data to add to the current array
    } else if (_tokensMatch(tokens, "#A")) {
      if (!currentArray) {
        throw new Error("got table data outside of a table.");
      }

      // reads in part of an array/table of data, starting at the index specified in this line
      // name of the array/table comes from the the '#X array' and '#X restore' matches above
      const indexOffset = parseFloat(tokens[1]);
      tokens.slice(2).forEach((rawVal, i) => {
        const val = parseFloat(rawVal);
        if (_isNumber(val)) {
          currentArray.data[indexOffset + i] = val;
        }
      });
      tokenizedLines.shift();

      // A normal chunk to add to the current patch
    } else {
      remainingTokenizedLines.push(tokenizedLines.shift());
    }
  }

  return [remainingTokenizedLines, arraysMap];
};

const recursParse = (
  tokenizedLines: Array<TokenizedLine>,
  patch: PdJson.Patch
) => {
  let idCounter = -1;
  const nextId = () => `${++idCounter}`;

  for (const tokenizedLine of tokenizedLines) {
    const { tokens, lineAfterComma } = tokenizedLine;

    if (_tokensMatch(tokens, "PATCH")) {
      const nodeId = nextId();
      patch.nodes[nodeId] = {
        id: nodeId,
        ...HYDRATORS["PATCH"](tokenizedLine),
      };
    } else if (_tokensMatch(tokens, "ARRAY")) {
      const nodeId = nextId();
      patch.nodes[nodeId] = {
        id: nodeId,
        ...HYDRATORS["ARRAY"](tokenizedLine),
      };
    } else if (_tokensMatch(tokens, "#X", "connect")) {
      patch.connections.push(HYDRATORS["#X connect"](tokenizedLine));

      // ---- NODES : object/control instantiation ---- //
    } else if (NODES.some((nodeType) => _tokensMatch(tokens, "#X", nodeType))) {
      const elementType = tokens[1];
      let proto; // the object name
      let args: Tokens; // the construction args for the object

      // 2 categories here :
      //  - elems whose name is `elementType`
      //  - elems whose name is `token[4]`
      if (elementType === "obj") {
        proto = tokens[4];
        args = tokens.slice(5);
      } else {
        proto = elementType;
        args = tokens.slice(4);
      }

      if (elementType === "text") {
        args = [tokens.slice(4).join(" ")];
      }

      const nodeId = nextId();
      const node: PdJson.Node = {
        id: nodeId,
        proto,
        layout: {
          x: parseNumberArg(tokens[2]),
          y: parseNumberArg(tokens[3]),
        },
        args: [],
      };

      // Handling controls' creation arguments
      if (Object.keys(ControlType).includes(node.proto)) {
        parseControls(node as PdJson.ControlNode, args);
      } else {
        node.args = args;
      }

      // Handling stuff after the comma
      // I have no idea what's the specification for this, so this is really reverse
      // engineering on what appears in pd files.
      if (lineAfterComma) {
        var afterCommaTokens = lineAfterComma.split(TOKENS_RE);
        while (afterCommaTokens.length) {
          var command = afterCommaTokens.shift();
          if (command === "f")
            node.layout.width = parseNumberArg(afterCommaTokens.shift());
        }
      }

      // Add the object to the graph
      node.args = node.args.map(parseArg);
      patch.nodes[nodeId] = node;

      // ---- coords : visual range of framsets ---- //
    } else if (_tokensMatch(tokens, "#X", "coords")) {
    } else throw new Error(`invalid chunk : ${tokens}`);
  }

  return patch;
};

// This is put here just for readability of the main `parse` function
const parseControls = (node: PdJson.ControlNode, args: Tokens): void => {
  if (node.proto === "floatatom" || node.proto === "symbolatom") {
    // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
    node.layout.width = parseNumberArg(args[0]);
    node.layout.labelPos = parseNumberArg(args[3]);
    node.layout.label = args[4];
    // <lower_limit> <upper_limit> <receive> <send>
    node.args = [args[1], args[2], args[5], args[6]];
  } else if (node.proto === "bng") {
    // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
    node.layout.size = parseNumberArg(args[0]);
    node.layout.hold = parseNumberArg(args[1]);
    node.layout.interrupt = parseNumberArg(args[2]);
    node.layout.label = args[6];
    node.layout.labelX = parseNumberArg(args[7]);
    node.layout.labelY = parseNumberArg(args[8]);
    node.layout.labelFont = args[9];
    node.layout.labelFontSize = parseNumberArg(args[10]);
    node.layout.bgColor = args[11];
    node.layout.fgColor = args[12];
    node.layout.labelColor = args[13];
    // <init> <send> <receive>
    node.args = [args[3], args[4], args[5]];
  } else if (node.proto === "tgl") {
    // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
    node.layout.size = parseNumberArg(args[0]);
    node.layout.label = args[4];
    node.layout.labelX = parseNumberArg(args[5]);
    node.layout.labelY = parseNumberArg(args[6]);
    node.layout.labelFont = args[7];
    node.layout.labelFontSize = parseNumberArg(args[8]);
    node.layout.bgColor = args[9];
    node.layout.fgColor = args[10];
    node.layout.labelColor = args[11];
    // <init> <send> <receive> <init_value> <default_value>
    node.args = [args[1], args[2], args[3], args[12], args[13]];
  } else if (node.proto === "nbx") {
    // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
    // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
    node.layout.size = parseNumberArg(args[0]);
    node.layout.height = parseNumberArg(args[1]);
    node.layout.log = parseNumberArg(args[4]);
    node.layout.label = args[8];
    node.layout.labelX = parseNumberArg(args[9]);
    node.layout.labelY = parseNumberArg(args[10]);
    node.layout.labelFont = args[11];
    node.layout.labelFontSize = parseNumberArg(args[12]);
    node.layout.bgColor = args[13];
    node.layout.fgColor = args[14];
    node.layout.labelColor = args[15];
    node.layout.logHeight = args[17];
    // <min> <max> <init> <send> <receive>
    node.args = [args[2], args[3], args[5], args[6], args[7], args[16]];
  } else if (node.proto === "vsl" || node.proto === "hsl") {
    // <width> <height> <bottom> <top> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
    node.layout.width = parseNumberArg(args[0]);
    node.layout.height = parseNumberArg(args[1]);
    node.layout.log = parseNumberArg(args[4]);
    node.layout.label = args[8];
    node.layout.labelX = parseNumberArg(args[9]);
    node.layout.labelY = parseNumberArg(args[10]);
    node.layout.labelFont = args[11];
    node.layout.labelFontSize = parseNumberArg(args[12]);
    node.layout.bgColor = args[13];
    node.layout.fgColor = args[14];
    node.layout.labelColor = args[15];
    node.layout.steadyOnClick = args[17];
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
    ];
  } else if (node.proto === "vradio" || node.proto === "hradio") {
    // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
    node.layout.size = parseNumberArg(args[0]);
    node.layout.label = args[6];
    node.layout.labelX = parseNumberArg(args[7]);
    node.layout.labelY = parseNumberArg(args[8]);
    node.layout.labelFont = args[9];
    node.layout.labelFontSize = parseNumberArg(args[10]);
    node.layout.bgColor = args[11];
    node.layout.fgColor = args[12];
    node.layout.labelColor = args[13];

    // <new_old> <init> <number> <send> <receive> <default_value>
    node.args = [args[1], args[2], args[3], args[4], args[5], args[14]];
  } else if (node.proto === "vu") {
    // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
    node.layout.width = parseNumberArg(args[0]);
    node.layout.height = parseNumberArg(args[1]);
    node.layout.label = args[3];
    node.layout.labelX = parseNumberArg(args[4]);
    node.layout.labelY = parseNumberArg(args[5]);
    node.layout.labelFont = args[6];
    node.layout.labelFontSize = parseNumberArg(args[7]);
    node.layout.bgColor = args[8];
    node.layout.labelColor = args[9];
    node.layout.log = parseNumberArg(args[10]);

    // <receive> <?>
    node.args = [args[2], args[11]];
  } else if (node.proto === "cnv") {
    // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
    node.layout.size = parseNumberArg(args[0]);
    node.layout.width = parseNumberArg(args[1]);
    node.layout.height = parseNumberArg(args[2]);
    node.layout.label = args[5];
    node.layout.labelX = parseNumberArg(args[6]);
    node.layout.labelY = parseNumberArg(args[7]);
    node.layout.labelFont = args[8];
    node.layout.labelFontSize = parseNumberArg(args[9]);
    node.layout.bgColor = args[10];
    node.layout.labelColor = args[11];
    // <send> <receive> <?>
    node.args = [args[3], args[4], args[12]];
  }
};
