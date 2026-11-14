import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {modelEntryFilter,readModelArchive,MAX_MODEL_BYTES} from '../web/model-archive.js';
test('ignores large images and counts only model data',()=>{
 const filter=modelEntryFilter();assert.equal(filter({name:'Metadata/preview.png',originalSize:500*1024**2}),false);
 assert.equal(filter({name:'3D/model.model',originalSize:160*1024**2}),true);
 assert.equal(filter({name:'3D/part.model',originalSize:140*1024**2}),true);
 assert.throws(()=>filter({name:'3D/extra.model',originalSize:1}),/300 MB/);
});
test('rejects an oversized model and invalid sizes',()=>{
 assert.throws(()=>modelEntryFilter()({name:'3D/model.model',originalSize:MAX_MODEL_BYTES+1}),/300 MB/);
 assert.throws(()=>modelEntryFilter()({name:'3D/model.model',originalSize:-1}),/无效/);
});
test('archive extraction preserves model files and omits attachments',()=>{
 const zip=zipSync({'3D/model.model':strToU8('<model/>'),'_rels/.rels':strToU8('<Relationships/>'),'Metadata/preview.png':new Uint8Array(100)});
 const files=readModelArchive(zip);assert.deepEqual(Object.keys(files),['3D/model.model','_rels/.rels']);assert.equal(new TextDecoder().decode(files['3D/model.model']),'<model/>');
});
import {read3mf} from '../web/three-mf.js';
function fixture(vertex,triangle,transform='1 0 0 0 1 0 0 0 1 10 0 0'){
 return zipSync({'3D/3dmodel.model':strToU8(`<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1"><mesh><vertices>${vertex}</vertices><triangles>${triangle}</triangles></mesh></object></resources><build><item objectid="1" transform="${transform}"/></build></model>`)});
}
const vs='<vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/>';
test('streaming model parser applies build transform',()=>{const root=read3mf(fixture(vs,'<triangle v1="0" v2="1" v3="2"/>'));assert.equal(root.children[0].geometry.attributes.position.getX(0),10);});
test('missing and invalid mesh attributes produce distinct errors',()=>{
 assert.throws(()=>read3mf(fixture(vs,'<triangle v1="0" v2="1" v3="9"/>')),/不存在的顶点/);
 assert.throws(()=>read3mf(fixture(vs,'<triangle v1="0" v2="1"/>')),/无效三角面索引/);
 assert.throws(()=>read3mf(fixture(vs.replace('x="0"','x="nan"'),'<triangle v1="0" v2="1" v3="2"/>')),/无效顶点坐标/);
});
