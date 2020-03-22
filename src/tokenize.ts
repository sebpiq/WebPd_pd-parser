export type Tokens = Array<string>

export interface TokenizedLine {
    tokens: Tokens;
    lineAfterComma: string;
}

// Regular expression to split tokens in a message.
export const TOKENS_RE = / |\r\n?|\n/
export const AFTER_COMMA_RE = /,(?!\\)/

// Regular expression for finding valid lines of Pd in a file
export const LINES_RE = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/gi

// Helper function to reverse a string
const _reverseString = (s: string): string => s.split('').reverse().join('')

export default (pdString: Pd.PdString): Array<TokenizedLine> => {
    const tokenizedLines: Array<TokenizedLine> = []

    // use our regular expression to match instances of valid Pd lines
    LINES_RE.lastIndex = 0 // reset lastIndex, in case the previous call threw an error

    // let line: RegExpMatchArray
    let lineMatch
    while ((lineMatch = LINES_RE.exec(pdString))) {
        // In order to support object width, pd vanilla adds something like ", f 10" at the end
        // of the line. So we need to look for non-escaped comma, and get that part after it.
        // Doing that is annoying in JS since regexps have no look-behind assertions.
        // The hack is to reverse the string, and use a regexp look-forward assertion.
        const lineParts = _reverseString(lineMatch[1])
            .split(AFTER_COMMA_RE)
            .reverse()
            .map(_reverseString)
        const tokens = lineParts[0].split(TOKENS_RE)
        const lineAfterComma = lineParts[1]
        tokenizedLines.push({ tokens, lineAfterComma })
    }

    return tokenizedLines
}
