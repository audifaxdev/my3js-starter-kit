import {genCubeUrls} from "./utils/hdr";

export default [
  {type: 'GLTF', url: '/DamagedHelmet.gltf', id: 'helmet'},
  {type: 'GLTF', url: '/CompanionCube.gltf', id: 'scene'},
  {type: 'GLTF', url: '/test_01.gltf', id: 'myMask'},
  {type: 'HDRCubeMap', url: genCubeUrls( "./dist/textures/HollywoodBD/", ".hdr" ), id: 'hdrCube'}
];