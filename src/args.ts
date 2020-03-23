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

import _isNumber from 'lodash.isnumber'
import isString from 'lodash.isstring'

// Regular expressions to detect escaped special chars.
const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g
const ESCAPED_COMMA_VAR_RE_GLOB = /\\,/g
const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\;/g

export const isNumber = (obj: number | string): obj is number =>
    _isNumber(obj) && !isNaN(obj)

// Parses a float from a .pd file. Returns the parsed float or NaN.
export const parseNumberArg = (val: PdJson.ObjectArgument): number => {
    if (isNumber(val)) {
        return val
    } else if (isString(val)) {
        return parseFloat(val)
    } else {
        return NaN
    }
}

// Parses argument to a string or a number.
// Needs to handle the case when the argument is already a number as in the process of gathering
// arguments we sometimes insert a number.
export const parseArg = (arg: PdJson.ObjectArgument): PdJson.ObjectArgument => {
    const parsed = parseNumberArg(arg)
    if (isNumber(parsed)) {
        return parsed
    } else if (isString(arg)) {
        arg = arg.substr(0)
        // Unescape special characters
        arg = arg.replace(ESCAPED_COMMA_VAR_RE_GLOB, ',')
        arg = arg.replace(ESCAPED_SEMICOLON_VAR_RE_GLOB, ';')
        let matched
        while ((matched = ESCAPED_DOLLAR_VAR_RE_GLOB.exec(arg))) {
            arg = arg.replace(matched[0], matched[1])
        }
        return arg
    } else {
        throw new Error("couldn't parse arg " + arg)
    }
}

// Parses a '0' or '1' from a .pd file. Returns the equivalent boolean.
export const parseBoolArg = (val: PdJson.ObjectArgument): boolean => {
    if (isNumber(val)) {
        return !!val
    } else if (isString(val)) {
        const num = parseInt(val, 10)
        if (!isNumber(num)) {
            throw new Error(`invalid number ${val}`)
        }
        return !!num
    } else {
        throw new Error(`invalid input ${val}`)
    }
}
