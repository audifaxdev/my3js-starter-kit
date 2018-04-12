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
import {genCubeUrls} from './utils/hdr';
import FBXLoader from 'three-fbx-loader';

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
  phi: Math.PI * 0.5
});

/* Lights */
const frontLight = new PointLight(0xFFFFFF, 1);
const backLight = new PointLight(0xFFFFFF, 0.5);
scene.add(frontLight);
scene.add(backLight);

/* Materials */
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
});

let hdrMaterials = [sMaterial, bMaterial];
let hdrCubeRenderTarget = null;
let hdrUrls = genCubeUrls( "./dist/textures/pisaHDR/", ".hdr" );
let hdrCubeLoader = new HDRCubeTextureLoader().load(
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

scene.add(new AxesHelper(50));
let ball = new Mesh( sGeometry, bMaterial );
ball.position.set(0, 10, 0);
scene.add( ball );

loader.load('/sodaCan_01.fbx', function (object3d) {
  console.log('object3d', object3d);
  // centerGroupGeometries(object3d);
  object3d.traverse(function (child) {
    if (child.hasOwnProperty('material')) {

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
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);
controls.target.set(0,0,0);
loop(render).start();

resize.addListener(function () {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

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