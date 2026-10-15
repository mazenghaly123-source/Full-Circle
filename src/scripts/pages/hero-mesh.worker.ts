// Builds the 3D hero mark's mesh off the main thread (see hero-mark.ts). Extruding the logo makes
// about 724,000 vertices, a second or more of work on a phone that would otherwise freeze the page.
// The logo's shapes arrive as JSON and the vertex arrays go back without copying. It is the same
// three.js code on the same numbers, so the mesh is identical to one built on the main thread.
// (Imported from three's source modules: the single-file build hardly tree-shakes, and would bring
// most of three.js into the worker as a second download.)
import { ExtrudeGeometry } from 'three/src/geometries/ExtrudeGeometry.js';
import { Shape } from 'three/src/extras/core/Shape.js';

export type MeshData = {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  groups: { start: number; count: number; materialIndex?: number }[];
};

self.onmessage = (e: MessageEvent<ReturnType<Shape['toJSON']>[]>) => {
  const shapes = e.data.map((json) => new Shape().fromJSON(json));
  const geo = new ExtrudeGeometry(shapes, { depth: 34, curveSegments: 10, bevelEnabled: true, bevelThickness: 4, bevelSize: 2.2, bevelOffset: 0, bevelSegments: 10 });
  geo.center(); geo.computeVertexNormals();
  const array = (name: string) => geo.getAttribute(name).array as Float32Array;
  const mesh: MeshData = { position: array('position'), normal: array('normal'), uv: array('uv'), groups: geo.groups };
  self.postMessage(mesh, { transfer: [mesh.position.buffer, mesh.normal.buffer, mesh.uv.buffer] });
};
