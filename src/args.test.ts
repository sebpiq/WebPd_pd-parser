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

import Type from '@webpd/shared/src/Type'
import assert from 'assert'
import {
    parseBoolArg,
    parseNumberArg,
    parseArg,
    parseStringArg,
    parseTypeArg,
    ValueError,
} from './args'

describe('args', () => {
    describe('parseStringArg', () => {
        it('should unescape dollar vars', () => {
            assert.equal(parseStringArg('\\$15'), '$15')
            assert.equal(parseStringArg('\\$15-bla-\\$0'), '$15-bla-$0')
        })

        it('should unescape comas and semicolons', () => {
            assert.equal(parseStringArg('\\,bla'), ',bla')
            assert.equal(parseStringArg('lolo\\;\\,'), 'lolo;,')
        })

        it('should throw an error if invalid input', () => {
            assert.throws(() => parseStringArg(null), ValueError)
        })
    })

    describe('parseBoolArg', () => {
        it('should parse strings correctly', () => {
            assert.strictEqual(parseBoolArg('0'), false)
            assert.strictEqual(parseBoolArg('1'), true)
            assert.strictEqual(parseBoolArg('18'), true)
        })

        it('should parse numbers correctly', () => {
            assert.strictEqual(parseBoolArg(0), false)
            assert.strictEqual(parseBoolArg(1), true)
            assert.strictEqual(parseBoolArg(18), true)
        })

        it('should throw error for non-number strings', () => {
            assert.throws(() => parseBoolArg('AAaarg'))
        })

        it('should throw error if nor a number, nor a string', () => {
            assert.throws(() => parseBoolArg({} as string))
        })
    })

    describe('parseNumberArg', () => {
        it('should parse floats rightly', () => {
            assert.strictEqual(parseNumberArg('789.9'), 789.9)
            assert.strictEqual(parseNumberArg('0'), 0)
            assert.strictEqual(parseNumberArg('0.'), 0)
            assert.strictEqual(parseNumberArg('-0.9'), -0.9)
            assert.strictEqual(parseNumberArg('-4e-2'), -0.04)
            assert.strictEqual(parseNumberArg('0.558e2'), 55.8)
        })

        it('should throw an error if invalid input', () => {
            assert.throws(() => parseNumberArg('bla'), ValueError)
            assert.throws(
                () => parseNumberArg(([1] as unknown) as number),
                ValueError
            )
        })
    })

    describe('parseTypeArg', () => {
        it('should parse correctly abbreviated types', () => {
            assert.strictEqual(parseTypeArg('b').typeString, 'bang')
            assert.strictEqual(parseTypeArg('f').typeString, 'float')
            assert.strictEqual(parseTypeArg('s').typeString, 'symbol')
            assert.strictEqual(parseTypeArg('a').typeString, 'anything')
            assert.strictEqual(parseTypeArg('l').typeString, 'list')
        })

        it('should parse correctly non-abbreviated types', () => {
            assert.strictEqual(parseTypeArg('bang').typeString, 'bang')
            assert.strictEqual(parseTypeArg('float').typeString, 'float')
            assert.strictEqual(parseTypeArg('symbol').typeString, 'symbol')
            assert.strictEqual(parseTypeArg('anything').typeString, 'anything')
            assert.strictEqual(parseTypeArg('list').typeString, 'list')
        })

        it('should throw an error if invalid input', () => {
            assert.throws(() => parseTypeArg('BAAAaaaaaang!'), ValueError)
            assert.throws(() => parseTypeArg(null), ValueError)
        })
    })

    describe('parseArg', () => {
        it('should parse numbers rightly', () => {
            assert.equal(parseArg(1), 1)
            assert.equal(parseArg(0.7e-2), 0.007)
            assert.equal(parseArg('1'), 1)
            assert.equal(parseArg('0.7e-2'), 0.007)
        })

        it('should parse strings rightly', () => {
            assert.equal(parseArg('bla'), 'bla')
            assert.equal(parseArg('\\$15'), '$15')
        })

        it('should parse types rightly', () => {
            assert.strictEqual((parseArg('f') as Type).typeString, 'float')
            assert.strictEqual(
                (parseArg('symbol') as Type).typeString,
                'symbol'
            )
        })

        it('should raise error with invalid args', () => {
            assert.throws(() => {
                parseArg(([1, 2] as unknown) as PdSharedTypes.NodeArgument)
            })
            assert.throws(() => {
                parseArg(null)
            })
        })
    })
})
