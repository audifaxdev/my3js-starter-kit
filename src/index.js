import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Box3,
  Vector2,
  Vector3,
  AxesHelper,
  MeshStandardMaterial,
  Mesh,
  SphereGeometry,
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  sRGBEncoding,
  Clock,
  Uncharted2ToneMapping,
  SmoothShading,
  LinearEncoding,
  AnimationMixer,
  AnimationAction,
  QuaternionKeyframeTrack,
  AnimationClip,
  KeyframeTrack,
  HemisphereLight,
  AmbientLight,
  DirectionalLight,
  Raycaster,
  AnimationUtils,
} from 'three';
import FXAAShader from './PostProcessing/FXAAShader';
import OrbitControls from './controls/OrbitControls';
import PMREMGenerator from './Loaders/PMREMGenerator';
import PMREMCubeUVPacker from './Loaders/PMREMCubeUVPacker';
import UnrealBloomPass from './PostProcessing/UnrealBloomPass';
import BloomBlendPass from './PostProcessing/BloomBlendPass';
import EffectComposer, { RenderPass, ShaderPass, CopyShader } from 'three-effectcomposer-es6';
import loop from 'raf-loop';
import resize from 'brindille-resize';
import { TimelineMax } from 'gsap';
import preloader from './utils/preloader';
import manifest from './assets';
import Gui from "guigui";
import { find, cloneDeep, map } from "lodash";

const DEBUG = true;
const DEFAULT_CAMERA = '[default]';

const traverseMaterials = (object, callback) => {
  object.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    materials.forEach(callback);
  });
};

class Animation {
  constructor(args) {
    const {
      name,
      actions,
      prepare
    } = args;
    this.name = name || '';
    this.actions = [];
    this.prepare = prepare || ((action) => action);
    this.playing = false;
    this.actions = actions;
  }

  fadeIn(duration = 1) {
    this.actions.forEach((action) => this.prepare(action).fadeIn(duration).play());
    this.paused = false;
  }

  fadeOut(duration = 1) {
    this.actions.forEach((action) => this.prepare(action).fadeOut(duration).play());
    this.paused = false;
  }


  play() {
    this.actions.forEach((action) => this.prepare(action).play());
    this.paused = false;
  }
  stop() {
    this.actions.forEach((action) => action.stop());
    this.paused = true;
  }
  togglePause() {
    this.paused = !this.paused;
    this.actions.forEach((action) => action.paused = this.paused);
  }
}

class Application {
  constructor() {
    this.bloomParams = {
      // strength: .15,
      strength: .3,
      // radius: .1,
      radius: .3,
      // threshold: .85
      threshold: .85
    };

    this.state = {
      actionStates: {}
    };
    this.container = document.body;
    this.renderer = new WebGLRenderer({
      antialias: true,
    });
    this.renderer.setClearColor(0xcccccc);
    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    // this.renderer.toneMappingExposure = Uncharted2ToneMapping;-
    this.renderer.exposure = 1;
    this.container.style.overflow = 'hidden';
    this.container.style.margin = 0;
    this.container.appendChild(this.renderer.domElement);

    this.composer = null;
    this.scene = new Scene();
    this.defaultCamera = new PerspectiveCamera(50, resize.width / resize.height, 0.01, 10000);
    this.defaultCamera.position.set(10, 10, 10);
    this.defaultCamera.lookAt(0, 0, 0,);
    this.scene.add(this.defaultCamera);
    this.activeCamera = this.defaultCamera;
    this.mouse = new Vector2();
    this.raycaster = new Raycaster();
    this.mouseOverCube = false;
    this.clock = new Clock();
    this.animations = {};

    this.controls = new OrbitControls(this.defaultCamera, {
      element: this.renderer.domElement,
      parent: this.renderer.domElement,
      zoomSpeed: 0.01,
      phi: 1.6924580040804253,
      theta: 0.9016370915802706,
      damping: 0.25,
      distance: 30
    });


    if (DEBUG) {
      this.scene.add(new AxesHelper(5000));
      let ball = new Mesh( new SphereGeometry( 10, 32, 32 ), new MeshStandardMaterial({
        map: null,
        color: 0xffffff,
        metalness: 1,
        roughness: .2,
        bumpScale: -1,
        flatShading: true
      }) );
      ball.name = 'DaBall';
      ball.position.set(0, 100, 0);
      this.scene.add( ball );
    }

    window.addEventListener("resize", this.resize);
    window.addEventListener("mousemove", this.mouseMove);
    window.addEventListener("click", this.mouseClick);
    loop(this.render).start();
    this.resize();

    preloader.load(manifest, () => {
      this.setupHdrCubeRenderTarget(preloader.getHDRCubeMap('hdrCube'));
      const gltf = preloader.getObject3d('scene');
      const scene = gltf.scene || gltf.scenes[0] || [];
      const cameras = gltf.cameras || [];
      const clips = gltf.animations || [];
      this.setContent(scene, clips, cameras);

      let sorted = gltf.animations.sort((a, b) => a.name.localeCompare(b.name));

        console.log({sorted});
    });
  }

  setupHdrCubeRenderTarget(hdrCubeMap) {
    let pmremGenerator = new PMREMGenerator( hdrCubeMap );
    pmremGenerator.update( this.renderer );
    let pmremCubeUVPacker = new PMREMCubeUVPacker( pmremGenerator.cubeLods );
    pmremCubeUVPacker.update( this.renderer );
    this.hdrCubeRenderTarget = pmremCubeUVPacker.CubeUVRenderTarget;
  }

  updateHdrMaterialEnvMap() {
    let newEnvMap = this.hdrCubeRenderTarget ? this.hdrCubeRenderTarget.texture : null;
    if (!newEnvMap) return;
    traverseMaterials(this.scene, (material) => {
      switch (material.name) {
        case "Cube Main":
        case "Center Strip":
          return;
        default:
          break;
      }
      if (material.isMeshStandardMaterial || material.isGLTFSpecularGlossinessMaterial) {
        material.envMap = newEnvMap;
        material.needsUpdate = true;
      }
    });
  };

  setupFXComposer() {
    this.composer = new EffectComposer(this.renderer);
    const copyShader = new ShaderPass(CopyShader);
    const fxaaPass = new ShaderPass(FXAAShader);

    copyShader.renderToScreen = true;
    fxaaPass.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );

    this.composer.addPass(new RenderPass(this.scene, this.activeCamera));
    this.composer.addPass(fxaaPass);
    this.composer.addPass(new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      this.bloomParams.strength, this.bloomParams.radius, this.bloomParams.threshold
    ));
    // this.composer.addPass(new BloomBlendPass(2.0, .3, new Vector2(window.innerWidth, window.innerHeight)));
    this.composer.addPass(copyShader);
  }

  clear() {
    if ( !this.content ) return;
    this.scene.remove( this.content );
    this.scene.traverse((node) => {
      if ( !node.isMesh ) return;
      node.geometry.dispose();
    });
  }

  setContent ( object, clips, cameras ) {

    this.clear();

    object.updateMatrixWorld();
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3()).length();
    const center = box.getCenter(new Vector3());

    this.controls.reset();
    object.position.x += (object.position.x - center.x);
    object.position.y += (object.position.y - center.y);
    object.position.z += (object.position.z - center.z);
    this.controls.maxDistance = size * 10;
    this.defaultCamera.near = size / 100;
    this.defaultCamera.far = size * 100;
    this.defaultCamera.updateProjectionMatrix();

    this.defaultCamera.position.copy(center);
    this.defaultCamera.position.x += size / 2.0;
    this.defaultCamera.position.y += size / 5.0;
    this.defaultCamera.position.z += size / 2.0;
    this.defaultCamera.lookAt(center);

    this.scene.add(object);
    this.content = object;

    // if (cameras.length) {
    //   this.setCamera(cameras[0].name);
    // } else {
    this.setCamera(DEFAULT_CAMERA);
    // }
    this.setClips(clips);
    this.addLights();
    this.updateHdrMaterialEnvMap();
    this.updateGeometries();
    this.updateMaterials();

    this.addGUI();

    // this.playAllClips();
  }

  addLights () {
    const hemiLight = new HemisphereLight(0xFFFFFF, 0x000000, .1);
    hemiLight.name = 'hemi_light';
    // this.scene.add(hemiLight);

    const light1  = new AmbientLight(0xffffff, .1);
    light1.name = 'ambient_light';
    this.scene.add( light1 );

    const light2  = new DirectionalLight(0xffffff, .1);
    light2.position.set(0, 1, 0); // ~60º
    light2.name = 'main_light';
    this.scene.add( light2 );
  }

  addAnimation(name, actions, prepare) {
    this.animations[name] = new Animation({
      name, actions, prepare
    });
  }

  setClips ( clips ) {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }

    this.mixer = new AnimationMixer(this.content);

    this.clips = clips;
    if (!clips.length) return;

    let cornerAnimations = this.clips.filter((clip) =>
      clip.name.startsWith('3-Side_corner')||clip.name.startsWith('2-Side_corner'));

    let floatingAnimation = cornerAnimations.filter((clip) => clip.name.includes('float'));
    let mainAnimation = cornerAnimations.filter((clip) => clip.name.includes('main'));

    // console.log({floatingAnimation, mainAnimation});

    this.addAnimation(
      'float', map(floatingAnimation, (clip) => this.mixer.clipAction(clip)), (action) => {
        return action.reset().setEffectiveTimeScale(.2).setLoop(LoopRepeat);
    });
    this.addAnimation(
      'main', map(mainAnimation, (clip) => this.mixer.clipAction(clip)), (action) => {
        return action.reset().setEffectiveTimeScale(.5).setLoop(LoopRepeat);
    });
  }

  setCamera(name) {
    console.log(`Setting camera : ${name}`);
    if (name === DEFAULT_CAMERA) {
      this.controls.enabled = true;
      this.activeCamera = this.defaultCamera;
    } else {
      this.controls.enabled = false;
      let found = false;
      this.content.traverse((node) => {
        if (node.isCamera && node.name === name) {
          found = true;
          this.activeCamera = node;
        }
      });
      if (!found) {
        console.log(`Camera ${name} not found!`);
      }
    }
    this.activeCamera.aspect = window.innerWidth / window.innerHeight;
    this.activeCamera.fov = 50;
    this.activeCamera.far = 10000;
    this.activeCamera.updateProjectionMatrix();
    this.composer && this.composer.reset();
    this.setupFXComposer();
  }

  updateGeometries() {
    this.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.computeVertexNormals();
    });
  }

  updateMaterials () {
    const encoding = sRGBEncoding;
    traverseMaterials(this.scene, (material) => {
      if (material.map) material.map.encoding = encoding;
      if (material.emissiveMap) material.emissiveMap.encoding = encoding;
      if (material.flatShading) material.shading = false;
      material.needsUpdate = true;
    });
  }

  addGUI() {
    Object.entries(this.animations).forEach((action) => {
      Gui.add(action[1], 'play', {label: `${action[0]}.play()`});
      Gui.add(action[1], 'fadeIn', {label: `${action[0]}.fadeIn()`});
      Gui.add(action[1], 'fadeOut', {label: `${action[0]}.fadeOut()`});
      Gui.add(action[1], 'togglePause', {label: `${action[0]}.togglePause()`});
      Gui.add(action[1], 'stop', {label: `${action[0]}.stop()`});
    });
  }

  mouseMove = (event) => {
    if (!this.clips || !Array.isArray(this.clips)) return;
    this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
  };

  mouseClick = (event) => {
    this.raycaster.setFromCamera( this.mouse, this.activeCamera );
    let intersects = this.raycaster.intersectObjects( this.scene.children, true );
    if (Array.isArray(intersects) && intersects.length) {
      console.log(intersects);
      if (!this.mouseOverCube) {
        //start animation
        // this.fadeInAllClips();
      }
      this.mouseOverCube = true;
    } else {
      if (this.mouseOverCube) {
        //stop animation
        // this.fadeOutAllClips();
      }
      this.mouseOverCube = false;
    }
  };

  resize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.defaultCamera.aspect = window.innerWidth / window.innerHeight;
    this.defaultCamera.updateProjectionMatrix();
    this.activeCamera.aspect = window.innerWidth / window.innerHeight;
    this.activeCamera.updateProjectionMatrix();
    this.composer && this.composer.reset();
    this.setupFXComposer();
  };

  render = (dt) => {
    this.controls && this.controls.update();
    this.mixer && this.mixer.update(this.clock.getDelta());
    // if (this.animations) {
    //   Object.entries(this.animations).forEach((anim) => {
    //     anim[1].mixer.update(anim[1].clock.getDelta());
    //   });
    // }

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.activeCamera);
    }
  };

}

document.addEventListener("DOMContentLoaded", () => new Application());