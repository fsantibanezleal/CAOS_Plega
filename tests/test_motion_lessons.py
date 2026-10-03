"""Independent invariants for every admitted lesson and source privacy boundary."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('motion', ROOT/'data-pipeline/build_motion_lessons.py')
motion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(motion)


class MotionLessonTests(unittest.TestCase):
    def test_artifact_precision_rejects_nonfinite_and_normalizes_libm_noise(self):
        self.assertEqual(motion.encoded({'p': [1.2345678900000001, -1e-15]}),
                         motion.encoded({'p': [1.23456789, 0.0]}))
        for value in [float('nan'), float('inf'), -float('inf')]:
            with self.assertRaisesRegex(ValueError, 'Non-finite'):
                motion.encoded({'coordinate': value})

    def test_all_outputs_are_reproducible_and_source_bound(self):
        for path, expected in motion.outputs().items():
            self.assertEqual(path.read_bytes(),expected,str(path))
        manifest = json.loads(motion.MANIFEST.read_bytes())
        self.assertEqual(len({m['id'] for m in manifest}),len(manifest))
        self.assertEqual(len({m['sha256'] for m in manifest}),len(manifest))
        for item in manifest:
            data=(ROOT/'frontend/public'/item['url'].lstrip('/')).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(),item['sha256'])
            doc=json.loads(data)
            self.assertEqual(len(doc['instructions']['steps']),item['steps'])
            self.assertEqual(len(doc['geometry']['operations']),item['movements'])
            self.assertEqual(doc['geometry']['status'],'complete')
            for step in doc['instructions']['steps']:
                self.assertTrue(step['title']['en']);self.assertTrue(step['title']['es'])
                self.assertTrue(step['body']['en']);self.assertTrue(step['body']['es'])

    def test_sanitized_data_has_only_geometric_source_fields(self):
        allowed={'name','sourceUrl','sourceSha256','license','actions','endpointError'}
        for path in motion.SOURCE.glob('*.json'):
            source=json.loads(path.read_bytes())
            self.assertEqual(set(source),allowed)
            self.assertRegex(source['sourceSha256'],r'^[a-f0-9]{64}$')
            for action in source['actions']:
                self.assertEqual(set(action),{'function','params','before','after','moving','uv'})
                self.assertTrue(set(action['params']) <= {'edge','direction','target','angle','axis','position'})
                for state in [action['before'],action['after']]:
                    self.assertEqual(set(state),{'vertices','faces','faces_orientations','edges','layers'})
            serialized=path.read_text(encoding='utf-8').lower()
            for forbidden in ['api_key','work_dir','thinking','critic_analysis','localhost','c:\\\\','d:\\\\']:
                self.assertNotIn(forbidden,serialized,path.name)

    def test_mismatched_fold_endpoint_fails_admission(self):
        source=json.loads((motion.SOURCE/'how-to-make-an-origami-heart.json').read_bytes())
        action=next(a for a in source['actions'] if a['function']=='fold')
        action['after']['vertices']['1'][0]+=.05
        with self.assertRaisesRegex(ValueError,'endpoint error|material area'):
            motion.compile_model(source)

    def test_each_triangle_keeps_its_area_during_actual_rotation(self):
        # Independent cross-product area evaluation at irregular motion fractions.
        for path in motion.SOURCE.glob('*.json'):
            doc,_=motion.compile_model(json.loads(path.read_bytes()))
            for op,mesh in zip(doc['geometry']['operations'],doc['geometry']['meshes']):
                moving=set(range(len(mesh['vertices']))) if op['kind']=='rigid' else {v for f in mesh['faces'] if f['id'] in op['movingFaces'] for v in f['vertices']}
                for fraction in [.19,.43,.67,.91]:
                    points=[motion.rotate(p,op['axisMm'],op['angleDeg']*fraction) if i in moving else p for i,p in enumerate(op['startPositionsMm'])]
                    area=0
                    for face in mesh['faces']:
                        a,b,c=[points[v] for v in face['vertices']]
                        u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
                        cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
                        triangle=sum(x*x for x in cross)**.5/2
                        self.assertGreater(triangle,0)
                        area+=triangle
                    self.assertAlmostEqual(area,22500,delta=.05)


if __name__=='__main__':unittest.main()
