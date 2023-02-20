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

import assert from 'assert'
import tokenize, { tokenizeLine } from './tokenize'
import TEST_PATCHES from '@webpd/pd-json/test-patches'

describe('tokenize', () => {

    describe('default', () => {
        it('should tokenize correctly a simple patch', () => {
            const tokenizedLines = tokenize(TEST_PATCHES.simple)
            assert.deepStrictEqual(tokenizedLines, [
                {
                    lineAfterComma: undefined,
                    lineIndex: 0,
                    tokens: ['#N', 'canvas', '778', '17', '450', '300', '10'],
                },
                {
                    lineAfterComma: undefined,
                    lineIndex: 1,
                    tokens: ['#X', 'obj', '14', '13', 'loadbang'],
                },
                {
                    lineAfterComma: undefined,
                    lineIndex: 2,
                    tokens: ['#X', 'obj', '14', '34', 'print', 'bla'],
                },
                {
                    lineAfterComma: undefined,
                    lineIndex: 3,
                    tokens: ['#X', 'connect', '0', '0', '1', '0'],
                },
            ])
        })
    
        it('should tokenize correctly a message with special characters', () => {
            const tokenizedLines = tokenize(TEST_PATCHES.messageCommaSemicolon)
            assert.deepStrictEqual(tokenizedLines[1], {
                lineAfterComma: undefined,
                tokens: [
                    '#X',
                    'msg',
                    '41',
                    '39',
                    '1',
                    ',',
                    '2',
                    ',',
                    '3',
                    ';',
                    'my-receiver-name',
                    '100',
                    ',',
                    '200',
                    ',',
                    '300',
                    ';',
                    'another-receiver',
                    '-45',
                    ',',
                    '-12.5',
                ],
                lineIndex: 1,
            })
        })
    })

    describe('tokenizeLine', () => {
        it('should not cut escaped spaces, colons or commas', () => {
            assert.deepStrictEqual(
                tokenizeLine('#X msg 225 510 list bla\\ poi'), 
                ['#X', 'msg', '225', '510', 'list', 'bla\\ poi']
            )
            assert.deepStrictEqual(
                tokenizeLine('#X msg 225 510 list bla\\\\\\,poi'), 
                ['#X', 'msg', '225', '510', 'list', 'bla\\\\\\,poi']
            )
            assert.deepStrictEqual(
                tokenizeLine('#X msg 225 510 list bla\\\\\\;poi'),
                ['#X', 'msg', '225', '510', 'list', 'bla\\\\\\;poi']
            )
        })
    })
})
