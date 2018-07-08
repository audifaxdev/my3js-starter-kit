import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Box3,
  Vector2,
  Vector3,
  AxesHelper,
  UnsignedByteType,
  MeshStandardMaterial,
  Mesh,
  SphereGeometry,
  Uncharted2ToneMapping,
  LinearToneMapping,
  Clock,
  SmoothShading,
  AnimationMixer, HemisphereLight, AmbientLight, DirectionalLight,

} from 'three';
import FXAAShader from './PostProcessing/FXAAShader';
import OrbitControls from './controls/OrbitControls';
import HDRCubeTextureLoader from './HdrEnvMap/HDRCubeTextureLoader';
import PMREMGenerator from './HdrEnvMap/PMREMGenerator';
import PMREMCubeUVPacker from './HdrEnvMap/PMREMCubeUVPacker';
import UnrealBloomPass from './PostProcessing/UnrealBloomPass';
import EffectComposer, { RenderPass, ShaderPass, CopyShader } from 'three-effectcomposer-es6';
import {genCubeUrls} from './HdrEnvMap/hdr';
import loop from 'raf-loop';
import resize from 'brindille-resize';
import { TimelineMax } from 'gsap';
import preloader from './utils/preloader';
import manifest from './assets';
import Gui from "guigui";
import { forEach, find } from "lodash";

const DEBUG = true;
const DEFAULT_CAMERA = '[default]';

class Application {
  constructor() {
    this.bloomParams = {
      // strength: .15,
      strength: .5,
      // radius: .1,
      radius: .4,
      // threshold: .85
      threshold: .85
    };

    this.container = document.body;
    this.renderer = new WebGLRenderer({
      antialias: true,
    });
    this.renderer.setClearColor(0xcccccc);
    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.toneMappingExposure = Uncharted2ToneMapping;
    this.renderer.exposure = 0;
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
    this.mixer = null;
    this.clock = new Clock();

    this.controls = new OrbitControls(this.defaultCamera, {
      element: this.renderer.domElement,
      parent: this.renderer.domElement,
      zoomSpeed: 0.01,
      phi: 1.6924580040804253,
      theta: 0.9016370915802706,
      damping: 0.25,
      distance: 30
    });
    // this.setupFXComposer();

    let sMaterial = new MeshStandardMaterial({
      map: null,
      color: 0xcccccc,
      metalness: .1,
      roughness: 1,
      bumpScale: 0,
      flatShading: SmoothShading
    });
    let bMaterial = new MeshStandardMaterial({
      map: null,
      color: 0xffffff,
      metalness: 1,
      roughness: .2,
      bumpScale: -1,
    });

    this.hdrMaterials = [
      sMaterial,
      // bMaterial
    ];

    const updateHdrMaterialEnvMap = () => {
      for (let i=0;i<this.hdrMaterials.length; i++) {
        let newEnvMap = hdrCubeRenderTarget ? hdrCubeRenderTarget.texture : null;
        if( newEnvMap !== this.hdrMaterials[i].envMap ) {
          this.hdrMaterials[i].envMap = newEnvMap;
          this.hdrMaterials[i].needsUpdate = true;
        }
      }
    };

    let hdrCubeRenderTarget = null;
    let hdrUrls = genCubeUrls( "./dist/textures/HollywoodBD/", ".hdr" );
    new HDRCubeTextureLoader().load(
      UnsignedByteType, hdrUrls, ( hdrCubeMap ) => {
        let pmremGenerator = new PMREMGenerator( hdrCubeMap );
        pmremGenerator.update( this.renderer );
        let pmremCubeUVPacker = new PMREMCubeUVPacker( pmremGenerator.cubeLods );
        pmremCubeUVPacker.update( this.renderer );
        hdrCubeRenderTarget = pmremCubeUVPacker.CubeUVRenderTarget;
        updateHdrMaterialEnvMap();
      }
    );

    if (DEBUG) {
      let sGeometry = new SphereGeometry( 1, 32, 32 );
      this.scene.add(new AxesHelper(5000));
      let ball = new Mesh( sGeometry, bMaterial );
      ball.name = 'DaBall';
      ball.position.set(0, 10, 0);
      this.scene.add( ball );
    }

    window.addEventListener("resize", this.resize);
    loop(this.render).start();
    this.resize();

    preloader.load(manifest, () => {
      const gltf = preloader.getObject3d('myCube');
      console.log('gltf', gltf);
      const scene = gltf.scene || gltf.scenes[0];
      const cameras = gltf.cameras || [];
      const clips = gltf.animations || [];
      this.setContent(scene, clips, cameras);
    });
  }

  clear() {
    if ( !this.content ) return;
    this.scene.remove( this.content );
    this.content.traverse((node) => {
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

    object.traverse(child => {
      if (child.isMesh) {
        child.material = this.hdrMaterials[0];
      }
    });

    this.scene.add(object);
    this.content = object;

    if (cameras.length) {
      this.setCamera(cameras[0].name);
    }
    this.setClips(clips);
    this.addLights();
  }


  addLights () {
    const hemiLight = new HemisphereLight(0xFFFFFF, 0x000000, .1);
    hemiLight.name = 'hemi_light';
    // this.scene.add(hemiLight);

    const light1  = new AmbientLight(0xffffff, .3);
    light1.name = 'ambient_light';
    this.scene.add( light1 );
    //
    const light2  = new DirectionalLight(0xffffff, .8);
    light2.position.set(30, 30, 0); // ~60º
    light2.name = 'main_light';
    this.scene.add( light2 );
  }

  setClips ( clips ) {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }

    this.clips = clips;
    if (!clips.length) return;

    this.mixer = new AnimationMixer(this.content);

    forEach(this.clips, (clip) => this.setupClip(clip));
  }
  setupClip = (clip) => {
    let action = this.mixer.clipAction(clip);
    Gui.add(action, 'play', {label: `${clip.name} Play()`});
    Gui.add(action, 'stop', {label: `${clip.name} Stop()`});
  };
  setCamera(name) {
    console.log(`Setting camera : ${name}`);
    if (name === DEFAULT_CAMERA) {
      console.log('Setting default camera');
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

  setupFXComposer() {
    this.composer = new EffectComposer(this.renderer);
    const copyShader = new ShaderPass(CopyShader);
    const fxaaPass = new ShaderPass( FXAAShader );

    copyShader.renderToScreen = true;
    fxaaPass.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );

    this.composer.addPass(new RenderPass(this.scene, this.activeCamera));
    this.composer.addPass(fxaaPass);
    // this.composer.addPass(new UnrealBloomPass(
    //   new Vector2(window.innerWidth, window.innerHeight),
    //   this.bloomParams.strength, this.bloomParams.radius, this.bloomParams.threshold
    // ));
    this.composer.addPass(copyShader);
  }

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
    this.mixer && this.mixer.update( this.clock.getDelta() );
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.activeCamera);
    }
  };
}

new Application();