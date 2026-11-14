import unittest,tempfile,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cad'))
import convert as c
import trimesh,numpy as np
class ConversionTests(unittest.TestCase):
 def test_all_six_directions_and_units(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=Path(tmp);mesh=trimesh.creation.box(extents=[10,20,30]);mesh.export(d/'a.stl');c.write_3mf([mesh],d/'a.3mf');c.meshes_step([mesh],d/'a.step')
   for source in ('stl','3mf','step'):
    for target in ('stl','3mf','step'):
     if source==target:continue
     with self.subTest(source=source,target=target):
      out=d/f'{source}.{target}';meta=c.convert(d/f'a.{source}',source,target,out)
      self.assertGreater(out.stat().st_size,100);self.assertEqual(meta['parts'],1)
      meshes=c.step_meshes(out,.1) if target=='step' else c.read_meshes(out,target,'millimeter')
      np.testing.assert_allclose(meshes[0].extents,[10,20,30],atol=1e-4)
   scaled=c.read_meshes(d/'a.stl','stl','inch')[0];np.testing.assert_allclose(scaled.extents,[254,508,762])
 def test_open_mesh_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   m=trimesh.creation.box();m.update_faces(np.arange(len(m.faces)-1))
   with self.assertRaisesRegex(ValueError,'不闭合'):c.meshes_step([m],Path(tmp)/'bad.step')
   m.export(Path(tmp)/'open.stl')
   with self.assertRaisesRegex(ValueError,'不闭合'):c.convert(Path(tmp)/'open.stl','stl','step',Path(tmp)/'bad.step')
 def test_real_3mf(self):
  p=Path(__file__).resolve().parents[2]/'坐姿矫正(单色版).3mf'
  if not p.exists():self.skipTest('用户样本不存在')
  meshes=c.read_3mf(p);self.assertEqual(len(meshes),9);self.assertEqual(sum(len(m.faces) for m in meshes),86232)
if __name__=='__main__':unittest.main()
