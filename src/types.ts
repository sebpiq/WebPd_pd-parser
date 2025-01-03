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
export const CONTROL_TYPE = {
    floatatom: 'floatatom',
    symbolatom: 'symbolatom',
    listbox: 'listbox',
    bng: 'bng',
    tgl: 'tgl',
    nbx: 'nbx',
    vsl: 'vsl',
    hsl: 'hsl',
    vradio: 'vradio',
    hradio: 'hradio',
    vu: 'vu',
    cnv: 'cnv',
    msg: 'msg',
}

export declare namespace PdJson {

    // ----------------------------- Base types ----------------------------- //
    // Pd file
    type PdString = string

    // In Pd some objects use a global namespace shared across all patches.
    // This is the case for example of arrays.
    type GlobalId = string

    // Other objects use a local namespace. In this case, it is therefore possible
    // for 2 different objects in distinct patches to have the same name without
    // interfering. This is the case for example of subpatches.
    type LocalId = string

    type NodeArg = string | number | undefined

    type NodeArgs = Array<NodeArg>

    type NodeType = string

    type PortletId = number

    type PortletType = 'message' | 'signal' | 'mixed'

    interface ConnectionEndpoint {
        nodeId: LocalId
        portletId: PortletId
    }

    interface Connection {
        source: ConnectionEndpoint
        sink: ConnectionEndpoint
    }

    interface Pd {
        patches: { [globalId: string]: Patch }
        arrays: { [globalId: string]: PdArray }
        rootPatchId: GlobalId
    }

    // ----------------------------- PdArray ----------------------------- //
    interface ArrayLayout {
        drawAs?: 'polygon' | 'points' | 'bezier'
    }

    interface PdArray {
        id: GlobalId

        /** Data contained in the array if that data is saved in the patch. */
        data: Array<number> | null

        /**
         * [arrayName, arraySize, saveContents]
         * - arraySize can be a dollar-string
         */
        args: [string, number | string, 0 | 1]

        layout: ArrayLayout
    }

    // ----------------------------- Patch ----------------------------- //
    interface PatchLayout {
        /**
         * if `1` then the window opens automatically when the parent patch
         * is opened by Pd.
         */
        openOnLoad?: 0 | 1

        /** X position of the window if {@link openOnLoad} is true */
        windowX?: number

        /** Y position of the window if {@link openOnLoad} is true */
        windowY?: number

        /** width of the window if {@link openOnLoad} is true */
        windowWidth?: number

        /** height of the window if {@link openOnLoad} is true */
        windowHeight?: number

        /**
         * If `1` then the parent patch displays a viewport to the
         * subpatch, allowing the subpatch to expose control elements
         * for GUI creation (instead of a simple object `[pd bla]`).
         */
        graphOnParent?: 0 | 1

        /**
         * Defined only when {@link graphOnParent} is `1`.
         * If `1` then the parent patch hides the name and arguments of the subpatch.
         */
        hideObjectNameAndArguments?: 0 | 1

        /** X offset of the viewport inside the subpatch canvas */
        viewportX?: number

        /** Y offset of the viewport inside the subpatch canvas */
        viewportY?: number

        /** Width of the viewport */
        viewportWidth?: number

        /** Height of the viewport */
        viewportHeight?: number
    }

    interface Patch {
        id: GlobalId

        /** true if this patch is not a subpatch of some other patch. */
        isRoot: boolean

        /**
         * Creation arguments of the patch.
         * Can be accessed by some objects at creation using for $ variables.
         * e.g. `[float $1]` creates a float box initialized with the first
         * arg of the patch.
         */
        args: NodeArgs
        nodes: { [localId: string]: Node }
        connections: Array<Connection>

        /**
         * Local ids of [inlet] / [inlet~] nodes.
         * Order of nodes ine the list corresponds with order of inlets of the patch.
         */
        inlets: Array<LocalId>

        /**
         * Local ids of [outlet] / [outlet~] nodes
         * Order of nodes ine the list corresponds with order of inlets of the patch.
         */
        outlets: Array<LocalId>

        layout: PatchLayout
    }

    // ----------------------------- Node ----------------------------- //
    interface BaseNodeLayoutPosition {
        x?: number
        y?: number
    }

    interface BaseNodeLayout extends BaseNodeLayoutPosition {
        width?: number
        height?: number
    }

    interface BaseNode {
        id: LocalId
        type: NodeType
        args: NodeArgs
        /**
         * Attribute used to distinguish between classes of nodes.
         * Mostly useful for typescript discriminated union.
         */
        nodeClass: 'generic' | 'control' | 'subpatch' | 'array' | 'text'
    }

    interface GenericNode extends BaseNode {
        nodeClass: 'generic'
        layout: BaseNodeLayout
    }

    interface TextNode extends BaseNode {
        nodeClass: 'text'
        type: 'text'
        layout: BaseNodeLayout
    }

    interface BaseControlNode extends BaseNode {
        /**
         * Attribute used to distinguish between classes of nodes.
         * Mostly useful for typescript discriminated union.
         */
        nodeClass: 'control'
        type: keyof typeof CONTROL_TYPE
    }

    interface SubpatchNode extends BaseNode {
        type: 'pd' | 'graph' | 'table'

        /**
         * In case the node is only the "outer shell" for a subpatch,
         * this `patchId` allows to recover said subpatch in the global Pd object.
         */
        patchId: GlobalId

        /**
         * Attribute used to distinguish between classes of nodes.
         * Mostly useful for typescript discriminated union.
         */
        nodeClass: 'subpatch'
        layout: BaseNodeLayout
    }

    interface ArrayNode extends BaseNode {
        type: 'array'

        /**
         * In case the node is only the "outer shell" for an array,
         * this `arrayId` allows to recover said array in the global Pd object.
         */
        arrayId: GlobalId

        /**
         * Attribute used to distinguish between classes of nodes.
         * Mostly useful for typescript discriminated union.
         */
        nodeClass: 'array'
        layout: BaseNodeLayout
    }

    type Node = GenericNode | SubpatchNode | ArrayNode | ControlNode | TextNode

    // ----------------------------- Specific types for controls ----------------------------- //
    type ControlNode =
        | AtomNode
        | MsgNode
        | BangNode
        | ToggleNode
        | NumberBoxNode
        | SliderNode
        | RadioNode
        | VuNode
        | CnvNode

    interface AtomLayout extends BaseNodeLayoutPosition {
        /** Width given in number of characters that fit horizontally in the box */
        widthInChars?: number
        label?: string
        labelPos?: number
    }

    interface AtomNode extends BaseControlNode {
        type: 'floatatom' | 'symbolatom' | 'listbox'
        layout: AtomLayout
        /** <min> <max> <receive> <send> */
        args: [number, number, string, string]
    }

    interface MsgLayout extends BaseNodeLayout {
        // Just to uniformize layout for all control nodes
        label?: undefined
    }

    interface MsgNode extends BaseControlNode {
        type: 'msg'
        args: NodeArgs
        layout: MsgLayout
    }

    interface BangLayout extends BaseNodeLayoutPosition {
        size?: number
        hold?: number
        interrupt?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        fgColor?: string
        labelColor?: string
    }

    interface BangNode extends BaseControlNode {
        type: 'bng'
        layout: BangLayout
        /** <init> <receive> <send> */
        args: [0 | 1, string, string]
    }

    interface ToggleLayout extends BaseNodeLayoutPosition {
        size?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        fgColor?: string
        labelColor?: string
    }

    interface ToggleNode extends BaseControlNode {
        type: 'tgl'
        layout: ToggleLayout
        /**
         * <on_value> <init> <init_value> <receive> <send>
         * - `on_value` is value when toggle is checked.
         * - `init_value` is value that is sent if init is on.
         */
        args: [number, 0 | 1, number, string, string]
    }

    interface NumberBoxLayout extends BaseNodeLayoutPosition {
        /** Width given in number of characters that fit horizontally in the box */
        widthInChars?: number
        height?: number
        log?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        fgColor?: string
        labelColor?: string
        logHeight?: string
    }

    interface NumberBoxNode extends BaseControlNode {
        type: 'nbx'
        layout: NumberBoxLayout
        /** <min> <max> <init> <init_value> <receive> <send> */
        args: [number, number, 0 | 1, number, string, string]
    }

    interface SliderLayout extends BaseNodeLayoutPosition {
        width?: number
        height?: number
        log?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        fgColor?: string
        labelColor?: string
        steadyOnClick?: string
    }

    interface SliderNode extends BaseControlNode {
        type: 'vsl' | 'hsl'
        layout: SliderLayout
        /** <min> <max> <init> <init_value> <receive> <send> */
        args: [number, number, 0 | 1, number, string, string]
    }

    interface RadioLayout extends BaseNodeLayoutPosition {
        size?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        fgColor?: string
        labelColor?: string
    }

    interface RadioNode extends BaseControlNode {
        type: 'vradio' | 'hradio'
        layout: RadioLayout
        /**
         * <number> <init> <init_value> <receive> <send> <new_old>
         * - `new_old`: send new and old valud or only new value (deprecated?)
         */
        args: [number, 0 | 1, number, string, string, 0 | 1]
    }

    interface VuLayout extends BaseNodeLayoutPosition {
        width?: number
        height?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        labelColor?: string
        log?: number
    }

    interface VuNode extends BaseControlNode {
        type: 'vu'
        layout: VuLayout
        /** <receive> <?> */
        args: [string, string]
    }

    interface CnvLayout extends BaseNodeLayoutPosition {
        size?: number
        width?: number
        height?: number
        label?: string
        labelX?: number
        labelY?: number
        labelFont?: string
        labelFontSize?: number
        bgColor?: string
        labelColor?: string
    }

    interface CnvNode extends BaseControlNode {
        type: 'cnv'
        layout: CnvLayout
        args: [string, string, string]
    }
}
