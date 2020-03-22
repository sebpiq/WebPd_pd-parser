import { TokenizedLine } from './types'
import { parseBoolArg } from './args'

export const HYDRATORS = {
    '#N canvas': ({ tokens }: TokenizedLine) => {
        const layout: PdJson.PatchLayout = {
            x: parseInt(tokens[2], 10),
            y: parseInt(tokens[3], 10),
            width: parseInt(tokens[4], 10),
            height: parseInt(tokens[5], 10),
        }
        const data = {
            layout,
            args: [tokens[6]],
        }
        if (typeof tokens[7] !== 'undefined') {
            data.layout.openOnLoad = parseBoolArg(tokens[7])
        }
        return data
    },

    PATCH: ({ tokens }: TokenizedLine) => {
        const canvasType = tokens[4]
        const args = []
        // add subpatch name
        if (canvasType === 'pd') {
            args.push(tokens[5])
        }

        return {
            proto: canvasType,
            refId: tokens[1],
            args,
            layout: {
                x: parseInt(tokens[2], 10),
                y: parseInt(tokens[3], 10),
            },
        }
    },

    ARRAY: ({ tokens }: TokenizedLine) => ({
        proto: 'array',
        refId: tokens[1],
        args: [] as Array<PdJson.ObjectArgument>,
    }),

    '#X array': ({ tokens }: TokenizedLine) => {
        const arrayName = tokens[2]
        const arraySize = parseFloat(tokens[3])
        return {
            args: [arrayName, arraySize],
            data: Array(arraySize).fill(0),
        }
    },

    '#X connect': ({ tokens }: TokenizedLine) => ({
        source: {
            id: tokens[2],
            port: parseInt(tokens[3], 10),
        },
        sink: {
            id: tokens[4],
            port: parseInt(tokens[5], 10),
        },
    }),
}
