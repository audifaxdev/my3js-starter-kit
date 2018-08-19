'use strict';

var Emitter = require('component-emitter');
var debounce = require('debounce');

var resize = module.exports;

// Make resize an event emitter
Emitter(resize);

resize.debounceDelay = 50;

resize.onGlobalResize = function() {
  this.width = window.innerWidth;
  this.height = window.innerHeight;
  this.halfWidth = 0.5 * this.width;
  this.halfHeight = 0.5 * this.height;

  this.applyResize();
  if (this.debounceDelay > 0) {
    this.debounceResize();
  } else {
    this.applyResizeDebounce();
  }
};

resize.applyResizeDebounce = function() {
  this.emit('resizeDebounce');
};

resize.applyResize = function() {
  this.emit('resize');
};

resize.addListener = function(listener, noDebounce) {
  this.on(noDebounce ? 'resize' : 'resizeDebounce', listener);
};

resize.removeListener = function(listener) {
  if (listener) {
    this.off('resize', listener);
    this.off('resizeDebounce', listener);
  }
};

resize.debounceResize = debounce(resize.applyResizeDebounce.bind(resize), resize.debounceDelay);

// first call to init values
resize.onGlobalResize();

window.addEventListener('resize', resize.onGlobalResize.bind(resize));