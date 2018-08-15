[![Build Status](https://travis-ci.org/brindille/brindille-resize.svg?branch=master)](https://travis-ci.org/brindille/brindille-resize)

# brindille-resize
Resize handler that uses debounce.

## Install

With [npm](http://npmjs.org) do:

```bash
$ npm install brindille-resize --save
```

## Usage

```js
var resize = require('brindille-resize');
// add listener
resize.addListener(handler);
// add listener without debounce
resize.addListener(noDebounceHandler, true);
// remove listener
resize.removeListener(handler);
// get properties
var w = resize.width;
var w2 = resize.halfWidth;
var h = resize.height;
var h2 = resize.halfHeight;
```

## License

MIT
