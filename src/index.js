import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  CameraHelper,
  PointLight,
  Vector2,
  AxesHelper,
  UnsignedByteType,
  MeshStandardMaterial,
  Mesh,
  SphereGeometry,
  Uncharted2ToneMapping,
  Clock,
  SmoothShading, AnimationMixer
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

const DEBUG = false;

const setupAnimation = (object, animation) => {
  Gui.add(object.mixer.clipAction( animation ), 'play', {label: `Start ${animation.name}`});
  Gui.add(object.mixer.clipAction( animation ), 'stop', {label: `Stop ${animation.name}`});
};

class Application {
  constructor() {
    this.bloomParams = {
      strength: .3,
      // strength: .5,
      radius: .25,
      // radius: .4,
      threshold: .85
      // threshold: .85
    };

    this.container = document.body;
    this.renderer = new WebGLRenderer({
      antialias: true
    });
    this.renderer.setClearColor(0x323232);
    // this.renderer.setClearColor(0xffffff);
    this.container.style.overflow = 'hidden';
    this.container.style.margin = 0;
    this.container.appendChild(this.renderer.domElement);

    this.composer = null;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(50, resize.width / resize.height, 0.1, 10000);
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0,);
    this.controls = null;
    this.mixers = [];
    this.clock = new Clock();

    // this.setupComposer();

    let sMaterial = new MeshStandardMaterial({
      map: null,
      color: 0xffffff,
      metalness: 1,
      roughness: .7,
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

    let hdrMaterials = [
      sMaterial,
      bMaterial
    ];

    function updateHdrMaterialEnvMap() {
      for (let i=0;i<hdrMaterials.length; i++) {
        let newEnvMap = hdrCubeRenderTarget ? hdrCubeRenderTarget.texture : null;
        if( newEnvMap !== hdrMaterials[i].envMap ) {
          hdrMaterials[i].envMap = newEnvMap;
          hdrMaterials[i].needsUpdate = true;
        }
      }
    }

    let hdrCubeRenderTarget = null;
    let hdrUrls = genCubeUrls( "./dist/textures/pisaHDR/", ".hdr" );
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
      this.controls = new OrbitControls(this.camera, {
        element: this.renderer.domElement,
        parent: this.renderer.domElement,
        zoomSpeed: 0.01,
        phi: 1.6924580040804253,
        theta: 0.9016370915802706,
        damping: 0.25,
        distance: 30
      });
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

    setInterval(() => {
      if ( this.mixers.length > 0 ) {
        for (let i=0;i<this.mixers.length;i++) {
          console.log('mixer', i , this.mixers[i]);
          this.mixers[ i ].update( this.clock.getDelta() );
          // this.camera.updateProjectionMatrix();
        }
      }
    }, 20);

    preloader.load(manifest, () => {
      const asset = preloader.getObject3d('myCube');
      console.log({asset});
      if (asset.scene) {
        asset.scene.traverse(object3d => {
          switch (object3d.name) {
            case "Cube":
              object3d.material = sMaterial;
              object3d.mixer = new AnimationMixer( object3d );
              this.mixers.push( object3d.mixer );
              setupAnimation(object3d, find(asset.animations, {name: 'Scale'}));
              setupAnimation(object3d, find(asset.animations, {name: 'Rotation'}));
              break;
            default:
              break;
          }
        });
      }
      let camera = asset.cameras[0];
      camera.mixer = new AnimationMixer( camera );
      this.mixers.push(camera.mixer);
      setupAnimation(camera, find(asset.animations, {name: 'CameraAction'}));
      asset.scene.remove(camera);
      this.setCamera(camera);
      this.scene.add(new CameraHelper( camera ) );
      this.scene.add(asset.scene);
    });
  }

  setCamera(camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = 50;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    // Gui.add(camera.rotation, 'x');
    Gui.add(camera.rotation, 'x', {min: -Math.PI/2, max: Math.PI/2});
    Gui.add(camera.rotation, 'y');
    Gui.add(camera.rotation, 'z');
    this.camera = camera;
    this.setupComposer();
    console.log('this.camera', this.camera);
  }

  setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    const copyShader = new ShaderPass(CopyShader);
    copyShader.renderToScreen = true;
    this.fxaaPass = new ShaderPass( FXAAShader );
    const bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      this.bloomParams.strength, this.bloomParams.radius, this.bloomParams.threshold
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.fxaaPass);
    this.composer.addPass(bloomPass);
    this.composer.addPass(copyShader);
    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.toneMappingExposure = Uncharted2ToneMapping;
    this.renderer.exposure = 1;
  }

  resize = () => {
    console.log('resize');
    if (this.fxaaPass) {
      this.fxaaPass.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };

  render = (dt) => {
    if (this.controls) {
      this.controls.update();
    }

    if (this.composer) {
      this.composer.render();
    } else {
      //   this.renderer.render(this.scene, this.camera);
    }
  };
}

new Application();