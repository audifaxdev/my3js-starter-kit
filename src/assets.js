import {genCubeUrls} from "./utils/hdr";

export default [
  {type: 'GLTF', url: '/CompanionCube.gltf', id: 'scene'},
  {type: 'HDRCubeMap', url: genCubeUrls( "./dist/textures/HollywoodBD/", ".hdr" ), id: 'hdrCube'}
];