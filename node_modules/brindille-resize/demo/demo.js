var domready = require('domready');
var resize = require('../index.js');

domready(function() {

  var sizeRed = window.innerHeight * 0.25;
  var sizeBlue = window.innerHeight * 0.25;

  var $instructions = document.createElement('h1');
  $instructions.innerHTML = 'Resize window height'
  $instructions.style.margin = '20px';
  document.body.appendChild($instructions);

  var $redblock = createBlock('#FF0000', 'debounce', sizeRed);
  document.body.appendChild($redblock);

  var $blueblock = createBlock('#0000FF', 'no debounce', sizeBlue);
  document.body.appendChild($blueblock);

  resize.addListener(redResizeHandler);
  resize.addListener(blueResizeHandler, true);

  function redResizeHandler() {
    sizeRed = window.innerHeight * 0.25;
    $redblock.style.width = $redblock.style.height = sizeRed + 'px';
  }
  function blueResizeHandler() {
    sizeBlue = window.innerHeight * 0.25;
    $blueblock.style.width = $blueblock.style.height = sizeBlue + 'px';
  }
});

function createBlock(bgColor, text, size) {
  var $block = document.createElement('div');
  $block.style.width = size + 'px';
  $block.style.height = size + 'px';
  $block.style.color = 'white';
  $block.style.background = bgColor;
  $block.style.margin = '20px';
  $block.style.padding = '20px';
  $block.style.float = 'left';
  $block.innerHTML = text;
  return $block;
}