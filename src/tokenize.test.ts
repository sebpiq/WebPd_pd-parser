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
import tokenize from './tokenize'
import TEST_PATCHES from '@webpd/pd-json/test-patches'

describe('tokenize', () => {
    it('should parse simple patch', () => {
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
        })
    })
})
