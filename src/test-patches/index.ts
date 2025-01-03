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
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
const TEST_PATCHES_DIR = path.dirname(fileURLToPath(import.meta.url))

export default {
    subpatches: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'subpatches.pd'))
        .toString(),
    simple: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'simple.pd'))
        .toString(),
    nodeElems: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'node-elems.pd'))
        .toString(),
    arrays: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'arrays.pd'))
        .toString(),
    tables: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'tables.pd'))
        .toString(),
    graphs: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'graphs.pd'))
        .toString(),
    objectSizePdVanilla: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'object-size-pd-vanilla.pd'))
        .toString(),
    portletsOrder1: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'portlets-order1.pd'))
        .toString(),
    portletsOrder2: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'portlets-order2.pd'))
        .toString(),
    messageCommaSemicolon: fs
        .readFileSync(path.join(TEST_PATCHES_DIR, 'message-comma-semicolon.pd'))
        .toString(),
}
