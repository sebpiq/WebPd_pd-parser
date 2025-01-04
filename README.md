WebPd .pd file parser
=========================

A .pd file parser implemented in TypeScript. Compatible with node.js and web browsers.

This is part of the [WebPd](https://github.com/sebpiq/WebPd) project, but can also be used as a standalone library.


Usage
---------

First install with : `npm i --save @webpd/pd-parser`.

Then import and use in your own module. Here is an example on node.js :

```js
// my-parser.mjs
import { readFileSync } from 'fs'
import parse from '@webpd/pd-parser'

// Read a pd file
const somePdFile = readFileSync('./some-pd-file.pd', { encoding: 'utf8' })

// Parse the pd file text to a javascript object you can directly work with
const result = parse(somePdFile)

// Print the result of the parsing operation
console.log('RESULT : ', result)

// Print the JS representation of the pd file
console.log('PATCH : ', result.pd)
```


Pd JS object structure
---------------------------

The JS representation of a Pd File is specified in [the following TypeScript file](./src/types.ts).


References
------------

See http://puredata.info/docs/developer/PdFileFormat for (incomplete and outdated) Pd file format reference.
