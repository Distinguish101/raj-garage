// Shrinks the downloaded Sketchfab cars so they fit on the page.
// Usage: node tools/compress.mjs            (all cars)
//        node tools/compress.mjs supra      (one car)
// Output: models/cars/<id>.b64.txt  (Draco GLB as base64; the artifact host won't serve .glb)
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO, PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, prune, weld, simplify, textureCompress, draco} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

// ratio = share of triangles kept; error = max simplification error (fraction of mesh size)
const CARS = {
  supra:  {src: 'toyota_gr_supra.glb',                ratio: .18, error: .002},
  gtr:    {src: 'gtr-r34.glb',                         ratio: .22, error: .002},
  m3:     {src: 'free_bmw_m3_e30.glb',                 ratio: 1,   error: .001},
  jesko:  {src: '2021_koenigsegg_jesko_absolut.glb',   ratio: .75, error: .001},
  huayra: {src: 'pagani_huayra_r.glb',                 ratio: .75, error: .001},
  apollo: {src: '2022_apollo_project_evo.glb',         ratio: 1,   error: .001},
  trx:    {src: '2021_ram_1500_trx.glb',               ratio: .75, error: .001},
};

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await MeshoptSimplifier.ready;
fs.mkdirSync(path.join(root, 'models/cars'), {recursive: true});
fs.mkdirSync(path.join(root, 'tools/out'), {recursive: true});

const tris = doc => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) =>
  b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);

for (const [id, c] of Object.entries(CARS)) {
  if (process.argv[2] && process.argv[2] !== id) continue;
  const src = path.join(root, 'new-cars', c.src);
  const doc = await io.read(src);
  const before = tris(doc);
  await doc.transform(
    // keep materials separate: the page finds paint, tyres and calipers by material name
    dedup({propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE]}),
    prune(),
    weld(),
    ...(c.ratio < 1 ? [simplify({simplifier: MeshoptSimplifier, ratio: c.ratio, error: c.error})] : []),
    textureCompress({encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82}),
    draco({quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12}),
  );
  const glb = await io.writeBinary(doc);
  fs.writeFileSync(path.join(root, 'tools/out', id + '.glb'), glb);
  fs.writeFileSync(path.join(root, 'models/cars', id + '.b64.txt'), Buffer.from(glb).toString('base64'));
  console.log(id.padEnd(7), (fs.statSync(src).size / 1e6).toFixed(1) + 'MB ->', (glb.byteLength / 1e6).toFixed(2) + 'MB',
    '| tris', Math.round(before), '->', Math.round(tris(doc)));
}
