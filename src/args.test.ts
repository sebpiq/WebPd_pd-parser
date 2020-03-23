import assert from 'assert'
import { parseBoolArg, parseNumberArg, parseArg } from './args'

describe('args', () => {
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

        it('return NaN if invalid float', () => {
            assert.ok(isNaN(parseNumberArg('bla')))
            assert.ok(isNaN(parseNumberArg(([1] as unknown) as number)))
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
        })

        it('should unescape dollar vars', () => {
            assert.equal(parseArg('\\$15'), '$15')
            assert.equal(parseArg('\\$15-bla-\\$0'), '$15-bla-$0')
        })

        it('should unescape comas and semicolons', () => {
            assert.equal(parseArg('\\,bla'), ',bla')
            assert.equal(parseArg('lolo\\;\\,'), 'lolo;,')
        })

        it('should raise error with invalid args', () => {
            assert.throws(() => {
                parseArg(([1, 2] as unknown) as PdJson.ObjectArgument)
            })
            assert.throws(() => {
                parseArg(null)
            })
        })
    })
})
