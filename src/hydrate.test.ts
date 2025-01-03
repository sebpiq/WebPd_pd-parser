/*
 * Copyright (c) 2022-2025 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
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
import { hydrateNodeControl, hydrateNodePatch } from './hydrate'
import { PdJson } from './types'

describe('hydrate', () => {
    describe('hydrateNodeControl - hsl/vsl', () => {
        it('should hydrate hsl log value correctly', () => {
            const node = hydrateNodeControl(
                'dummy',
                'hsl',
                [
                    '101',
                    '15',
                    '1',
                    '1000',
                    '1',
                    '1',
                    '',
                    '',
                    '',
                    '-2',
                    '-8',
                    '0',
                    '10',
                    '#fcfcfc',
                    '#000000',
                    '#000000',
                    '8300',
                    '1',
                ],
                {
                    x: 0,
                    y: 0,
                }
            )
            assert.deepStrictEqual<PdJson.SliderNode['args']>(node.args, [
                1,
                1000,
                1,
                309.02954325135886,
                '',
                '',
            ])
        })

        it('should hydrate vsl lin value correctly', () => {
            const node = hydrateNodeControl(
                'dummy',
                'vsl',
                [
                    '15',
                    '201',
                    '0',
                    '1000',
                    '0',
                    '0',
                    '',
                    '',
                    '',
                    '0',
                    '-9',
                    '0',
                    '10',
                    '#fcfcfc',
                    '#000000',
                    '#000000',
                    '16800',
                    '1',
                ],
                {
                    x: 0,
                    y: 0,
                }
            )
            assert.deepStrictEqual<PdJson.SliderNode['args']>(node.args, [
                0,
                1000,
                0,
                840,
                '',
                '',
            ])
        })

        it('should hydrate vsl log value correctly', () => {
            const node = hydrateNodeControl(
                'dummy',
                'vsl',
                [
                    '15',
                    '201',
                    '10',
                    '1000',
                    '1',
                    '1',
                    '',
                    '',
                    '',
                    '0',
                    '-9',
                    '0',
                    '10',
                    '#fcfcfc',
                    '#000000',
                    '#000000',
                    '16100',
                    '1',
                ],
                {
                    x: 0,
                    y: 0,
                }
            )
            assert.deepStrictEqual<PdJson.SliderNode['args']>(node.args, [
                10,
                1000,
                1,
                407.380277804113,
                '',
                '',
            ])
        })
    })

    describe('hydrateNodePatch', () => {
        it('should hydrate subpatch without name', () => {
            const node = hydrateNodePatch('pd_node_p1', {
                tokens: ['PATCH', 'p1', '269', '614', 'pd'],
                lineIndex: 0,
            })
            assert.deepStrictEqual<PdJson.SubpatchNode>(node, {
                id: 'pd_node_p1',
                patchId: 'p1',
                type: 'pd',
                nodeClass: 'subpatch',
                args: [],
                layout: {
                    x: 269,
                    y: 614,
                },
            })
        })
    })
})
