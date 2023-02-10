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

import { PdJson } from '@webpd/pd-json'
import assert from 'assert'
import {
    parseBoolToken,
    parseFloatToken,
    parseArg,
    parseStringToken,
    ValueError,
} from './tokens'

describe('tokens', () => {
    describe('parseStringToken', () => {
        it('should unescape dollar vars', () => {
            assert.strictEqual(parseStringToken('\\$15'), '$15')
            assert.strictEqual(parseStringToken('\\$15-bla-\\$0'), '$15-bla-$0')
        })

        it('should unescape comas and semicolons', () => {
            assert.strictEqual(parseStringToken('\\,bla'), ',bla')
            assert.strictEqual(parseStringToken('lolo\\;\\,'), 'lolo;,')
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
