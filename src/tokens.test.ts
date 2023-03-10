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

import assert from 'assert'
import {
    parseBoolToken,
    parseFloatToken,
    parseArg,
    parseStringToken,
    ValueError,
} from './tokens'
import { PdJson } from './types'

describe('tokens', () => {
    describe('parseStringToken', () => {
        it('should unescape dollar vars', () => {
            assert.strictEqual(parseStringToken('\\$15'), '$15')
            assert.strictEqual(parseStringToken('\\$15-bla-\\$0'), '$15-bla-$0')
        })

        it('should unescape comas and semicolons', () => {
            assert.strictEqual(parseStringToken('lolo\\\\\\;\\\\\\,'), 'lolo;,')
        })

        it('should return empty string if empty value', () => {
            assert.strictEqual(parseStringToken('empty', 'empty'), '')
        })

        it('should throw an error if invalid input', () => {
            assert.throws(() => parseStringToken(undefined), ValueError)
        })
    })

    describe('parseBoolToken', () => {
        it('should parse strings correctly', () => {
            assert.strictEqual(parseBoolToken('0'), 0)
            assert.strictEqual(parseBoolToken('1'), 1)
        })

        it('should parse numbers correctly', () => {
            assert.strictEqual(parseBoolToken(0), 0)
            assert.strictEqual(parseBoolToken(1), 1)
        })

        it('should throw error for non-number strings', () => {
            assert.throws(() => parseBoolToken('AAaarg'))
        })

        it('should throw error if nor a number, nor a string', () => {
            assert.throws(() => parseBoolToken({} as string))
        })

        it('should throw error for non 0 or 1 numers', () => {
            assert.throws(() => parseBoolToken('23'))
        })
    })

    describe('parseFloatToken', () => {
        it('should parse floats rightly', () => {
            assert.strictEqual(parseFloatToken('789.9'), 789.9)
            assert.strictEqual(parseFloatToken('0'), 0)
            assert.strictEqual(parseFloatToken('0.'), 0)
            assert.strictEqual(parseFloatToken('-0.9'), -0.9)
            assert.strictEqual(parseFloatToken('-4e-2'), -0.04)
            assert.strictEqual(parseFloatToken('0.558e2'), 55.8)
        })

        it('should throw an error if invalid input', () => {
            assert.throws(() => parseFloatToken('bla'), ValueError)
            assert.throws(() => parseFloatToken('100)'), ValueError)
            assert.throws(
                () => parseFloatToken([1] as unknown as number),
                ValueError
            )
        })
    })

    describe('parseArg', () => {
        it('should parse numbers rightly', () => {
            assert.strictEqual(parseArg(1), 1)
            assert.strictEqual(parseArg(0.7e-2), 0.007)
            assert.strictEqual(parseArg('1'), 1)
            assert.strictEqual(parseArg('0.7e-2'), 0.007)
        })

        it('should parse strings rightly', () => {
            assert.strictEqual(parseArg('bla'), 'bla')
            assert.strictEqual(parseArg('\\$15'), '$15')
        })

        it('should raise error with invalid args', () => {
            assert.throws(() => {
                parseArg([1, 2] as unknown as PdJson.NodeArg)
            })
            assert.throws(() => {
                parseArg(undefined)
            })
        })
    })
})
