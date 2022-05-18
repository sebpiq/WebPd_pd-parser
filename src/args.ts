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

import _isString from 'lodash.isstring'
import Type from '@webpd/shared/src/Type'

// Regular expressions to detect escaped special chars.
const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g
const ESCAPED_COMMA_VAR_RE_GLOB = /\\,/g
const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\;/g

// Parses argument to a string or a number.
// Needs to handle the case when the argument is already a number as in the process of gathering
// arguments we sometimes insert a number.
export const parseArg = (
    rawArg: PdSharedTypes.NodeArgument
): PdSharedTypes.NodeArgument => {
    // Try to parse arg as a number
    try {
        return parseNumberArg(rawArg)
    } catch (err) {
        if (!(err instanceof ValueError)) {
            throw err
        }
    }

    // Try to parse arg as a Type
    try {
        return parseTypeArg(rawArg)
    } catch (err) {
        if (!(err instanceof ValueError)) {
            throw err
        }
    }

    // Try to parse arg as a string
    try {
        return parseStringArg(rawArg)
    } catch (err) {
        if (!(err instanceof ValueError)) {
            throw err
        }
    }

    throw new ValueError(`Not a valid arg  ${rawArg}`)
}

// Parses a float from a .pd file. Returns the parsed float or throws ValueError.
export const parseNumberArg = (val: PdSharedTypes.NodeArgument): number => {
    if (isNumber(val)) {
        return val
    } else if (isString(val)) {
        const parsed = parseFloat(val)
        if (isNaN(parsed)) {
            throw new ValueError(`Not a valid number arg ${val}`)
        }
        return parsed
    } else {
        throw new ValueError(`Not a valid number arg ${val}`)
    }
}

// Parses a '0' or '1' from a .pd file. Returns the equivalent boolean.
export const parseBoolArg = (val: PdSharedTypes.NodeArgument): boolean => {
    if (isNumber(val)) {
        return !!val
    } else if (isString(val)) {
        const num = parseInt(val, 10)
        if (!isNumber(num)) {
            throw new ValueError(`Not a valid bool arg ${val}`)
        }
        return !!num
    } else {
        throw new ValueError(`Not a valid bool arg ${val}`)
    }
}

// Parses a type from a .pd file object definition. Returns the parsed Type or throws ValueError.
export const parseTypeArg = (val: PdSharedTypes.NodeArgument): Type => {
    if (val === 'b') {
        return new Type('bang')
    } else if (val === 'f') {
        return new Type('float')
    } else if (val === 's') {
        return new Type('symbol')
    } else if (val === 'a') {
        return new Type('anything')
    } else if (val === 'l') {
        return new Type('list')
    } else if (
        val === 'bang' ||
        val === 'float' ||
        val === 'symbol' ||
        val === 'anything' ||
        val === 'list'
    ) {
        return new Type(val)
    } else {
        throw new ValueError(`Not a valid type arg ${val}`)
    }
}

// Apply some operations to a string arg
export const parseStringArg = (val: PdSharedTypes.NodeArgument): string => {
    if (!isString(val)) {
        throw new ValueError(`Not a valid string arg ${val}`)
    }

    // Unescape special characters
    let arg = val
        .replace(ESCAPED_COMMA_VAR_RE_GLOB, ',')
        .replace(ESCAPED_SEMICOLON_VAR_RE_GLOB, ';')

    // Unescape dollars
    let matched
    while ((matched = ESCAPED_DOLLAR_VAR_RE_GLOB.exec(arg))) {
        arg = arg.replace(matched[0], matched[1])
    }

    return arg
}

export class ValueError extends Error {}

const isNumber = (obj: unknown): obj is number => Number.isFinite(obj)

const isString = (obj: unknown): obj is string => _isString(obj)
