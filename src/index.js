import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  PointLight,
  Vector2,
  AxesHelper,
  UnsignedByteType,
  MeshStandardMaterial,
  Mesh,
  SphereGeometry,
  TextureLoader
} from 'three';

import loop from 'raf-loop';
import EffectComposer, { RenderPass, ShaderPass, CopyShader } from 'three-effectcomposer-es6';
import HDRCubeTextureLoader from './HDRCubeTextureLoader';
import PMREMGenerator from './PMREMGenerator';
import PMREMCubeUVPacker from './PMREMCubeUVPacker';
import UnrealBloomPass from './UnrealBloomPass';
import resize from 'brindille-resize';
import OrbitControls from './controls/OrbitControls';
import {gui} from './utils/debug';
import FBXLoader from 'three-fbx-loader';

const loader = new FBXLoader();
/* Custom settings */
const SETTINGS = {
  useComposer: false
};

/* Init renderer and canvas */
const container = document.body;
const renderer = new WebGLRenderer({
  antialias: true
});
renderer.setClearColor(0x323232);
container.style.overflow = 'visible';
container.style.margin = 0;
container.appendChild(renderer.domElement);

/* Main scene and camera */
const scene = new Scene();
const camera = new PerspectiveCamera(50, resize.width / resize.height, 0.1, 1000);
const controls = new OrbitControls(camera, {
  element: renderer.domElement,
  parent: renderer.domElement,
  phi: Math.PI * 0.5
});

/* Lights */
const frontLight = new PointLight(0xFFFFFF, 1);
const backLight = new PointLight(0xFFFFFF, 0.5);
scene.add(frontLight);
scene.add(backLight);
frontLight.position.x = 20;
backLight.position.x = 100;
backLight.position.y = 100;

let genCubeUrls = function( prefix, postfix ) {
  return [
    prefix + 'px' + postfix, prefix + 'nx' + postfix,
    prefix + 'py' + postfix, prefix + 'ny' + postfix,
    prefix + 'pz' + postfix, prefix + 'nz' + postfix
  ];
};

let hdrCubeRenderTarget = null;
//Ball
let sGeometry = new SphereGeometry( 1, 32, 32 );

let sMaterial = new MeshStandardMaterial({
  map: null,
  color: 0xffffff,
  metalness: 1
});

let bMaterial = new MeshStandardMaterial({
  map: null,
  color: 0xffffff,
  metalness: 1
});

sMaterial.roughness = 0;
sMaterial.bumpScale = -0.05;

let hdrMaterials = [sMaterial, bMaterial];

let textureLoader = new TextureLoader();
textureLoader.load( "/mpm_vol.09_p35_can_red_diff.JPG", ( map ) => {
  // map.wrapS = THREE.RepeatWrapping;
  // map.wrapT = THREE.RepeatWrapping;
  // map.repeat.set( 9, 2 );
  map.anisotropy = 4;
  for (let i=0;i<hdrMaterials.length; i++) {
    hdrMaterials[i].roughnessMap = map;
    hdrMaterials[i].bumpMap = map;
    hdrMaterials[i].needsUpdate = true;
  }
} );

let hdrUrls = genCubeUrls( "./dist/textures/pisaHDR/", ".hdr" );
let hdrCubeLoader = new HDRCubeTextureLoader().load( UnsignedByteType, hdrUrls, ( hdrCubeMap ) => {
  let pmremGenerator = new PMREMGenerator( hdrCubeMap );
  pmremGenerator.update( renderer );
  let pmremCubeUVPacker = new PMREMCubeUVPacker( pmremGenerator.cubeLods );
  pmremCubeUVPacker.update( renderer );
  hdrCubeRenderTarget = pmremCubeUVPacker.CubeUVRenderTarget;
});

const renderPass = new RenderPass(scene, camera);
let copyShader = new ShaderPass(CopyShader);
copyShader.renderToScreen = true;
const bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 1.5, .4, 0.85);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
// composer.addPass(bloomPass);
composer.addPass(copyShader);
renderer.gammaInput = true;
renderer.gammaOutput = true;

/* Various event listeners */
resize.addListener(onResize);

scene.add(new AxesHelper(50));
let ball = new Mesh( sGeometry, bMaterial );

ball.position.set(0, 10, 0);

scene.add( ball );

function centerGroupGeometries(group) {
  if (!group || !group.hasOwnProperty('children')) {
    return;
  }
  for (let i=0;i<group.children.length;i++) {
    let el = group.children[i];
    if (el.hasOwnProperty('geometry')) {
      el.geometry.center();
    } else if (el.hasOwnProperty('children')) {
      centerGroupGeometries(el);
    }
  }
}

loader.load('/sodaCan_01.fbx', function (object3d) {
  console.log('object3d', object3d);
  centerGroupGeometries(object3d);
  object3d.traverse(function (child) {
    if (child.hasOwnProperty('material')) {
      console.log('child', child);
      // child.material = [sMaterial];
    }
  });
  object3d.rotation.y = Math.PI;
  scene.add(object3d);
  loop(render).start();
});

/* some stuff with gui */
// gui.add(SETTINGS, 'useComposer');

/* -------------------------------------------------------------------------------- */

/**
 Resize canvas
 */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(resize.width, resize.height);
  composer.setSize(resize.width, resize.height);
}

/**
 Render loop
 */
function render(dt) {
  controls.update();
  if (composer) {
    for (let i=0;i<hdrMaterials.length; i++) {
      let newEnvMap = hdrCubeRenderTarget ? hdrCubeRenderTarget.texture : null;
      if( newEnvMap !== hdrMaterials[i].envMap ) {
        hdrMaterials[i].envMap = newEnvMap;
        hdrMaterials[i].needsUpdate = true;
      }
    }
    composer.render();
  }
}
