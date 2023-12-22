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
import tokenize, { tokenizeLine } from './tokenize'
import TEST_PATCHES from './test-patches'

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
