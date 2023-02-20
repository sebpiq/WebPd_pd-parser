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

export type Tokens = Array<string>

export interface TokenizedLine {
    lineIndex: number
    tokens: Tokens
    lineAfterComma?: Tokens
}

// Regular expression to split tokens in a message.
// For groups 'semi' and 'colon', we capture as a separator only unescaped characters.
// A separator can be e.g. : " ,  " or "; "
export const TOKENS_RE = /(?<comma>((?<!\\)\s*)((?<!\\\\)\\,)((?<!\\)\s*))|(?<semi>((?<!\\)\s*)((?<!\\\\)\\;)((?<!\\)\s*))|((?<!\\)\s)+|\r\n?|\n/
export const AFTER_COMMA_RE = /,(?!\\)/

// Regular expression for finding valid lines of Pd in a file
export const LINES_RE = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/gi

// Helper function to reverse a string
const _reverseString = (s: string): string => s.split('').reverse().join('')

export default (pdString: PdJson.PdString): Array<TokenizedLine> => {
    const tokenizedLines: Array<TokenizedLine> = []

    // use our regular expression to match instances of valid Pd lines
    LINES_RE.lastIndex = 0 // reset lastIndex, in case the previous call threw an error

    let lineMatch: RegExpMatchArray | null = null
    while ((lineMatch = LINES_RE.exec(pdString))) {
        // In order to support object width, pd vanilla adds something like ", f 10" at the end
        // of the line. So we need to look for non-escaped comma, and get that part after it.
        // Doing that is annoying in JS since regexps have no look-behind assertions.
        // The hack is to reverse the string, and use a regexp look-forward assertion.
        const lineParts = _reverseString(lineMatch[1]!)
            .split(AFTER_COMMA_RE)
            .reverse()
            .map(_reverseString)

        const lineIndex = pdString.slice(0, lineMatch.index).split('\n').length - 1

        tokenizedLines.push({
            tokens: tokenizeLine(lineParts[0]!),
            lineAfterComma: lineParts[1]
                ? tokenizeLine(lineParts[1])
                : undefined,
            lineIndex
        })
    }

    return tokenizedLines
}

export const tokenizeLine = (line: string): Tokens => {
    const matches = Array.from(line.matchAll(new RegExp(TOKENS_RE, 'g')))
    const tokens: Tokens = []
    matches.forEach((match, i) => {
        const tokenStart =
            i === 0 ? 0 : matches[i - 1]!.index! + matches[i - 1]![0].length
        const tokenEnd = match.index
        const token = line.slice(tokenStart, tokenEnd)
        if (token.length) {
            tokens.push(token)
        }

        if (match.groups!['comma']) {
            tokens.push(',')
        } else if (match.groups!['semi']) {
            tokens.push(';')
        }
    })
    const lastMatch = matches.slice(-1)[0]
    if (lastMatch) {
        tokens.push(line.slice(lastMatch.index! + lastMatch[0].length))
    }

    return tokens
}
