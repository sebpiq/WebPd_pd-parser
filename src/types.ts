export type Tokens = Array<string>

export interface TokenizedLine {
    tokens: Tokens;
    lineAfterComma: string;
}

export enum ControlType {
    floatatom = 'floatatom',
    symbolatom = 'symbolatom',
    bng = 'bng',
    tgl = 'tgl',
    nbx = 'nbx',
    vsl = 'vsl',
    hsl = 'hsl',
    vradio = 'vradio',
    hradio = 'hradio',
    vu = 'vu',
    cnv = 'cnv',
}
