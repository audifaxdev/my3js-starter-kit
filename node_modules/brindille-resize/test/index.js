var expect = require('chai').expect;
var trigger = require('./tiny-trigger/');
var resize = require('../index');
resize.debounceDelay = 0;

var resizeIsTrigger = false;
var resizeDebounceIsTrigger = false;

describe('brindille-resize', function() {

  it('is initialized', function() {
    expect(resize.width).to.equal(window.innerWidth);
    expect(resize.height).to.equal(window.innerHeight);
    expect(resize.halfWidth).to.equal(0.5 * window.innerWidth);
    expect(resize.halfHeight).to.equal(0.5 * window.innerHeight);
  });

  it('has resize listener', function() {
    resize.addListener(callbackTestResize, true);
    expect(resize.hasListeners('resize')).to.equal(true);
  });

  it('has resizeDebounce listener', function() {
    resize.addListener(callbackTestResizeDebounce, false);
    expect(resize.hasListeners('resizeDebounce')).to.equal(true);
  });

  it('triggers events', function() {
    resize.removeAllListeners();
    resize.addListener(callbackTestResize, true);
    resize.addListener(callbackTestResizeDebounce, false);
    trigger(window, 'resize');

    expect(resizeIsTrigger).to.equal(true);
    expect(resizeDebounceIsTrigger).to.equal(true);
  });

  it('removes specific listener', function() {
    resize.removeListener(callbackTestResize);
    expect(resize.hasListeners('resize')).to.equal(false);
    resize.removeListener(callbackTestResizeDebounce);
    expect(resize.hasListeners('resizeDebounce')).to.equal(false);
  });

  it('removes all listeners', function() {
    resize.addListener(callbackTestResize, true);
    resize.addListener(callbackTestResizeDebounce, false);
    resize.removeAllListeners();
    expect(resize.hasListeners('resize')).to.equal(false);
    expect(resize.hasListeners('resizeDebounce')).to.equal(false);
  });

});

function callbackTestResize() {
  console.log('Call test callback for resize event');
  resizeIsTrigger = true;
}

function callbackTestResizeDebounce() {
  console.log('Call test callback for resize event debounced');
  resizeDebounceIsTrigger = true;
}