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
import HDRCubeTextureLoader from './HdrEnvMap/HDRCubeTextureLoader';
import PMREMGenerator from './HdrEnvMap/PMREMGenerator';
import PMREMCubeUVPacker from './HdrEnvMap/PMREMCubeUVPacker';
import UnrealBloomPass from './UnrealBloomPass/UnrealBloomPass';
import resize from 'brindille-resize';
import OrbitControls from './controls/OrbitControls';
import {genCubeUrls} from './HdrEnvMap/hdr';
import FBXLoader from 'three-fbx-loader';
import Gui from 'guigui';


//1.5, .4, .95 is quite shiny
let params = {
  strength: .5,
  radius: .4,
  threshold: .85
};

const loader = new FBXLoader();
const container = document.body;
const renderer = new WebGLRenderer({
  antialias: true
});
renderer.setClearColor(0x323232);
container.style.overflow = 'visible';
container.style.margin = 0;
container.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(50, resize.width / resize.height, 0.1, 1000);
const controls = new OrbitControls(camera, {
  element: renderer.domElement,
  parent: renderer.domElement,
  zoomSpeed: 0.0075,
  phi: 1.6924580040804253,
  theta: 0.9016370915802706,
  damping: 0.25,
  distance: 9.789999999999997
});

const frontLight = new PointLight(0xFFFFFF, 1);
const backLight = new PointLight(0xFFFFFF, 1);
scene.add(frontLight);
scene.add(backLight);

let sGeometry = new SphereGeometry( 1, 32, 32 );
let sMaterial = new MeshStandardMaterial({
  map: null,
  color: 0xffffff,
  metalness: .5,
  roughness: 0,
  bumpScale: -0.05
});
let bMaterial = new MeshStandardMaterial({
  map: null,
  color: 0xffffff,
  metalness: 1
});
let hdrMaterials = [sMaterial, bMaterial];

let textureLoader = new TextureLoader();
textureLoader.load( "/mpm_vol.09_p35_can_red_diff.JPG", ( map ) => {
  // map.wrapS = THREE.RepeatWrapping;
  // map.wrapT = THREE.RepeatWrapping;
  // map.repeat.set( 9, 2 );
  map.anisotropy = 4;
  for (let i=0;i<hdrMaterials.length; i++) {
    // hdrMaterials[i].roughnessMap = map;
    sMaterial.bumpMap = map;
    sMaterial.needsUpdate = true;
    sMaterial.map = map;
  }
});

let hdrCubeRenderTarget = null;
let hdrUrls = genCubeUrls( "./dist/textures/pisaHDR/", ".hdr" );
new HDRCubeTextureLoader().load(
  UnsignedByteType, hdrUrls, ( hdrCubeMap ) => {
    let pmremGenerator = new PMREMGenerator( hdrCubeMap );
    pmremGenerator.update( renderer );
    let pmremCubeUVPacker = new PMREMCubeUVPacker( pmremGenerator.cubeLods );
    pmremCubeUVPacker.update( renderer );
    hdrCubeRenderTarget = pmremCubeUVPacker.CubeUVRenderTarget;
});

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const copyShader = new ShaderPass(CopyShader);
copyShader.renderToScreen = true;

const bloomPass = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  params.strength, params.radius, params.threshold
);

composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(copyShader);
renderer.gammaInput = true;
renderer.gammaOutput = true;

// scene.add(new AxesHelper(50));
// let ball = new Mesh( sGeometry, bMaterial );
// ball.position.set(0, 10, 0);
// scene.add( ball );

loader.load('/sodaCan_01.fbx', function (object3d) {
  object3d.traverse(function (child) {
    if (child.hasOwnProperty('material')) {
      console.log('child', child);
      child.material[0] = sMaterial;
      child.material[1] = sMaterial;

    }
    if (child.hasOwnProperty('geometry')) {
      child.geometry.center();
    }
  });
  object3d.rotation.y = Math.PI;
  scene.add(object3d);
});

frontLight.position.x = 20;
backLight.position.x = 100;
backLight.position.y = 100;


const gui = Gui.addPanel('BloomPass');
gui.add(params, 'strength', {
  min:      0, // default is 0
  max:      10, // default is 100
  step:   0.1, // default is 1
  label: 'Strenght', // default is target property's name (here "a")
  watch: true // default is false
}).on('update', value => {
  // do something with value
  bloomPass.strength = value;
});
gui.add(params, 'radius', {
  min:      -Math.PI, // default is 0
  max:      Math.PI, // default is 100
  step:   0.01, // default is 1
  label: 'Radius', // default is target property's name (here "a")
  watch: true // default is false
}).on('update', value => {
  // do something with value
  bloomPass.radius = value;
});
gui.add(params, 'threshold', {
  min:      0, // default is 0
  max:      1, // default is 100
  step:   0.01, // default is 1
  label: 'threshold', // default is target property's name (here "a")
  watch: true // default is false
}).on('update', value => {
  // do something with value
  bloomPass.threshold = value;
});

const guiMaterial = Gui.addPanel('Material');
guiMaterial.add(sMaterial, 'roughness', {
  min:      0, // default is 0
  max:      1, // default is 100
  step:   0.01, // default is 1
  label: 'Roughness', // default is target property's name (here "a")
  watch: true // default is false
});
guiMaterial.add(sMaterial, 'metalness', {
  min:      0, // default is 0
  max:      1, // default is 100
  step:   0.01, // default is 1
  label: 'Metalness', // default is target property's name (here "a")
  watch: true // default is false
});
guiMaterial.add(sMaterial, 'bumpScale', {
  min:      -1, // default is 0
  max:      1, // default is 100
  step:   0.01, // default is 1
  label: 'Bump scale', // default is target property's name (here "a")
  watch: true // default is false
});

loop(render).start();

resize.addListener(function () {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function render(dt) {
  controls.update();
  console.log('controls', controls);
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