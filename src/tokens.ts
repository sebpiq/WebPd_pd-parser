/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd 
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { PdJson } from './types'

// Regular expressions to detect escaped special chars.
const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g
const ESCAPED_COMMA_VAR_RE_GLOB = /\\\\\\,/g
const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\\\\\;/g

/**
 * Parses token to a node arg (string or a number).
 * Needs to handle the case when the token is already a number as in the process of gathering
 * arguments we sometimes insert a number.
 */
export const parseArg = (
    rawArg: PdJson.NodeArg | undefined
): NonNullable<PdJson.NodeArg> => {
    // Try to parse arg as a number
    try {
        return parseFloatToken(rawArg)
    } catch (err) {
        if (!(err instanceof ValueError)) {
            throw err
        }
    }

    // Try to parse arg as a string
    try {
        return parseStringToken(rawArg)
    } catch (err) {
        if (!(err instanceof ValueError)) {
            throw err
        }
    }

    throw new ValueError(`Not a valid arg ${rawArg}`)
}

/** Parses a float from a .pd file. Returns the parsed float or throws ValueError. */
export const parseFloatToken = (val: PdJson.NodeArg | undefined): number => {
    if (isNumber(val)) {
        return val
    } else if (isString(val)) {
        // `Number` is better than `parseFloat` for example
        // which is too flexible.
        // REF : https://stackoverflow.com/questions/3257112/is-it-possible-to-parsefloat-the-whole-string
        const parsed = Number(val)
        if (isNaN(parsed)) {
            throw new ValueError(`Not a valid number arg ${val}`)
        }
        return parsed
    } else {
        throw new ValueError(`Not a valid number arg ${val}`)
    }
}

/** Parses an int from a .pd file. Returns the parsed int or throws ValueError. */
export const parseIntToken = (token: string | undefined) => {
    if (token === undefined) {
        throw new ValueError(`Received undefined`)
    }
    const parsed = parseInt(token, 10)
    if (isNaN(parsed)) {
        throw new ValueError(`Invalid int received`)
    }
    return parsed
}

/** Parses a '0' or '1' from a .pd file. */
export const parseBoolToken = (val: PdJson.NodeArg | undefined): 0 | 1 => {
    const parsed = parseFloatToken(val)
    if (parsed === 0 || parsed === 1) {
        return parsed
    }
    throw new ValueError(`Should be 0 or 1`)
}

/** Unescape string args. */
export const parseStringToken = (
    val: PdJson.NodeArg | undefined,
    emptyValue: string | null = null
): string => {
    if (!isString(val)) {
        throw new ValueError(`Not a valid string arg ${val}`)
    }

    // If empty value, make real empty string
    if (emptyValue !== null && val === emptyValue) {
        return ''
    }

    // Unescape special characters
    let arg = val
        .replace(ESCAPED_COMMA_VAR_RE_GLOB, ',')
        .replace(ESCAPED_SEMICOLON_VAR_RE_GLOB, ';')

    // Unescape dollars
    let matched
    while ((matched = ESCAPED_DOLLAR_VAR_RE_GLOB.exec(arg))) {
        arg = arg.replace(matched[0], matched[1]!)
    }

    return arg
}

export class ValueError extends Error {}

const isNumber = (obj: unknown): obj is number => Number.isFinite(obj)

const isString = (obj: unknown): obj is string => typeof obj === 'string'
