"""Compile sanitized geometric reconstructions into continuous Fold Spec lessons.

No network or simulator dependency is used by generate/verify. Source trajectories
retain the exact replayed geometry. Every admitted operation must preserve rigid
triangle lengths and hit its recorded endpoint; no generic interpolation fallback.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/guide/motion-sources'
PUBLIC = ROOT / 'frontend/public/lessons'
MANIFEST = ROOT / 'frontend/src/guide/lesson-manifest.json'
SCALE = 150
TOLERANCE = 0.002  # mm; normalized upstream endpoints are rounded to six decimals
MODELS = {
    'how-to-make-an-origami-heart': ('heart', 'Paper heart', 'Corazón de papel', 'decorations'),
    'easy_origami_cat_face': ('cat-face', 'Cat face', 'Cara de gato', 'animals'),
    'easy_origami_cat_instructions_for_kids': ('cat', 'Wide cat face', 'Cara ancha de gato', 'animals'),
    'easy_origami_gift_card_holder_instructions': ('gift-holder', 'Gift card holder', 'Portatarjeta de regalo', 'useful'),
    'easy_origami_rabbit_head_v1': ('rabbit', 'Rabbit head', 'Cabeza de conejo', 'animals'),
    'easy_origami_yacht_instructions': ('yacht', 'Sailing yacht', 'Velero', 'transport'),
    'how_to_make_an_easy_origami_car': ('car', 'Paper car', 'Coche de papel', 'transport'),
    'how_to_make_an_easy_origami_penguin': ('penguin', 'Penguin', 'Pingüino', 'animals'),
    'how_to_make_an_easy_origami_sunflower': ('sunflower', 'Sunflower', 'Girasol', 'plants'),
    'how_to_make_an_easy_origami_tulip': ('tulip', 'Tulip flower', 'Flor de tulipán', 'plants'),
    'how_to_make_an_easy_origami_tulip_stem': ('tulip-stem', 'Tulip stem and leaf', 'Tallo y hoja de tulipán', 'plants'),
    'how_to_make_an_origami_cup': ('cup', 'Paper cup', 'Vaso de papel', 'useful'),
    'how_to_make_an_origami_horse_head': ('horse', 'Horse head', 'Cabeza de caballo', 'animals'),
    'how_to_make_a_medieval_origami_shield': ('shield', 'Medieval shield', 'Escudo medieval', 'decorations'),
    'how_to_make_a_very_easy_origami_pig': ('pig', 'Pig face', 'Cara de cerdo', 'animals'),
    'very_easy_origami_sloth_instructions': ('sloth', 'Sloth', 'Perezoso', 'animals'),
}
PALETTE = {'animals': '#db855e', 'plants': '#5d9b79', 'useful': '#578da5',
           'transport': '#739fc0', 'decorations': '#ba718a'}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def point(xy):
    return [(xy[0] - .5) * SCALE, (xy[1] - .5) * SCALE, 0.0]


def rotate(p, axis, angle):
    a, b = axis
    d = [b[i] - a[i] for i in range(3)]
    length = math.sqrt(sum(x*x for x in d))
    if length < 1e-8:
        raise ValueError('Degenerate hinge')
    u = [x/length for x in d]
    v = [p[i] - a[i] for i in range(3)]
    cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
    dot = sum(u[i]*v[i] for i in range(3))
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    return [a[i]+v[i]*c+cross[i]*s+u[i]*dot*(1-c) for i in range(3)]


def area(points):
    a, b, c = points
    cross = [(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
             (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
             (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])]
    return math.sqrt(sum(x*x for x in cross))/2


def distance(a, b):
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))


def layer_ranks(raw):
    ranks = {}
    rank = 0
    for layer in raw.get('layers', []):
        for group in layer:
            for fid in group:
                ranks[str(fid)] = rank
            rank += 1
    return ranks


def location(xy, bounds):
    xmin, ymin, xmax, ymax = bounds
    x = (xy[0]-xmin)/max(xmax-xmin, 1e-9)
    y = (xy[1]-ymin)/max(ymax-ymin, 1e-9)
    horizontal = ('left', 'izquierda') if x < .4 else ('right', 'derecha') if x > .6 else ('central', 'central')
    vertical = ('lower', 'inferior') if y < .4 else ('upper', 'superior') if y > .6 else ('middle', 'media')
    return (f'{vertical[0]} {horizontal[0]}', f'{vertical[1]} {horizontal[1]}')


def instruction(action, axis, moving, positions):
    kind, params = action['function'], action['params']
    if kind == 'rotate':
        angle = float(params['angle'])
        direction = ('clockwise', 'en sentido horario') if angle > 0 else ('counterclockwise', 'en sentido antihorario')
        return ({'en': f'Turn the paper {abs(angle):g}° {direction[0]}',
                 'es': f'Gira el papel {abs(angle):g}° {direction[1]}'},
                {'en': 'Turn the entire model on the table without adding a crease. Keep the existing folded layers together.',
                 'es': 'Gira todo el modelo sobre la mesa sin añadir un pliegue. Mantén juntas las capas ya plegadas.'})
    if kind == 'flip':
        return ({'en': 'Turn the model over', 'es': 'Da la vuelta al modelo'},
                {'en': 'Lift the whole model and turn it over around the illustrated axis. The reverse color now faces you; retain every existing crease.',
                 'es': 'Levanta todo el modelo y dale la vuelta alrededor del eje ilustrado. Ahora ves el color del reverso; conserva todos los pliegues.'})
    xy = [p[:2] for p in positions]
    bounds = [min(p[0] for p in xy), min(p[1] for p in xy), max(p[0] for p in xy), max(p[1] for p in xy)]
    center = [sum(positions[i][j] for i in moving)/len(moving) for j in range(2)]
    region = location(center, bounds)
    dx, dy = axis[1][0]-axis[0][0], axis[1][1]-axis[0][1]
    line = ('horizontal', 'horizontal') if abs(dy) < .01 else ('vertical', 'vertical') if abs(dx) < .01 else ('diagonal', 'diagonal')
    verb = ('Open', 'Abre') if kind == 'unfold' else ('Fold', 'Pliega')
    return ({'en': f'{verb[0]} the {region[0]} flap', 'es': f'{verb[1]} la solapa {region[1]}'},
            {'en': f'{verb[0]} the highlighted {region[0]} region about the {line[0]} dashed crease. Follow the moving paper through its half-turn, leaving the unhighlighted region in place. Match the illustrated end position before continuing.',
             'es': f'{verb[1]} la zona {region[1]} resaltada sobre el pliegue {line[1]} discontinuo. Sigue el papel durante su media vuelta y deja fija la zona sin resaltar. Comprueba la posición final ilustrada antes de continuar.'})


def compile_model(source):
    identity, en, es, category = MODELS[source['name']]
    meshes, operations, steps, annotations, evidence = [], [], [], [], []
    previous_fold = None
    for action_index, action in enumerate(source['actions']):
        kind, params = action['function'], action['params']
        before, after = action['before'], action['after']
        if kind == 'add_vertex':
            for vid, xy in before['vertices'].items():
                if distance(point(xy), point(after['vertices'][vid])) > TOLERANCE:
                    raise ValueError('Subdivision displaced paper')
            continue
        n = len(operations)
        mesh_id, op_id = f'mesh-{n+1}', f'move-{n+1}'
        ids = sorted(after['vertices'], key=int)
        indices = {vid: i for i, vid in enumerate(ids)}
        moving_parents = set(map(str, action['moving']))
        faces = []
        moving_vertices = set()
        ranks = layer_ranks(after)
        start_ranks = layer_ranks(before)
        face_ranks, face_start_ranks = [], []
        for fid, polygon in after['faces'].items():
            poly = list(map(str, polygon))
            # Orient by material coordinates, not the flattened folded state.
            uv = [action['uv'][v] for v in poly]
            if sum(uv[i][0]*uv[(i+1)%len(uv)][1]-uv[(i+1)%len(uv)][0]*uv[i][1] for i in range(len(uv))) < 0:
                poly.reverse()
            for j in range(1, len(poly)-1):
                vertices = [indices[poly[0]], indices[poly[j]], indices[poly[j+1]]]
                if area([point(after['vertices'][ids[v]]) for v in vertices]) < 1e-8:
                    continue  # Collinear subdivision points do not make a paper triangle.
                faces.append({'id': f'{fid}:{j}', 'vertices': vertices})
                face_ranks.append(ranks.get(fid, 0))
                face_start_ranks.append(start_ranks.get(fid, ranks.get(fid, 0)))
                if fid in moving_parents:
                    moving_vertices.update(vertices)
        target = [point(after['vertices'][v]) for v in ids]
        if kind in {'fold', 'unfold'}:
            edge = params.get('edge') or previous_fold['edge']
            axis = [point(before['vertices'][str(v)]) for v in edge]
            direction = int(params['direction']) if kind == 'fold' else -int(previous_fold['direction'])
            angle = -180*direction
            start = [point(before['vertices'][v]) if v in before['vertices'] else
                     rotate(target[i], axis, -angle) if i in moving_vertices else target[i]
                     for i, v in enumerate(ids)]
            operation = {'kind': 'hinge', 'movingFaces': [f['id'] for f in faces if f['id'].split(':')[0] in moving_parents]}
            if kind == 'fold':
                previous_fold = params
        else:
            start = [point(before['vertices'][v]) for v in ids]
            if kind == 'rotate':
                center = [sum(p[i] for p in start)/len(start) for i in range(2)]
                axis = [[*center, 0], [*center, 1]]
                angle = -float(params['angle'])
            elif kind == 'flip':
                axes = {'x': [[0,-SCALE,0],[0,SCALE,0]], 'y': [[-SCALE,0,0],[SCALE,0,0]],
                        'y=x': [[-SCALE,-SCALE,0],[SCALE,SCALE,0]], 'y=-x+1': [[-SCALE,SCALE,0],[SCALE,-SCALE,0]]}
                axis, angle = axes[params['axis']], 180
            else:
                raise ValueError(f'Unsupported motion {kind}')
            moving_vertices = set(range(len(ids)))
            operation = {'kind': 'rigid', 'translationMm': [0,0,0], 'liftMm': 0}
        result = [rotate(p, axis, angle) if i in moving_vertices else p for i,p in enumerate(start)]
        error = max(distance(a,b) for a,b in zip(result,target))
        if error > TOLERANCE:
            raise ValueError(f'{identity} action {action_index}: endpoint error {error:g}mm')
        total_area = sum(area([start[v] for v in f['vertices']]) for f in faces)
        if abs(total_area - SCALE*SCALE) > .05:
            raise ValueError(f'{identity} action {action_index}: material area {total_area:g}')
        for fraction in [0,.125,.25,.5,.75,.875,1]:
            sampled = [rotate(p, axis, angle*fraction) if i in moving_vertices else p for i,p in enumerate(start)]
            for f in faces:
                a,b,c = f['vertices']
                for i,j in [(a,b),(b,c),(c,a)]:
                    if abs(distance(sampled[i],sampled[j])-distance(start[i],start[j])) > TOLERANCE:
                        raise ValueError('Motion stretches a rigid paper face')
        mesh = {'id': mesh_id, 'sheet': 'paper', 'vertices': [{'id':v,'uvMm':[(action['uv'][v][0]-.5)*SCALE,(action['uv'][v][1]-.5)*SCALE]} for v in ids], 'faces':faces}
        operation.update({'id':op_id,'mesh':mesh_id,'sheet':'paper','durationMs':1600 if kind in {'fold','unfold'} else 1000,
                          'startPositionsMm':start,'axisMm':axis,'angleDeg':angle,'easing':'smoothstep',
                          'creases':[],'layers':[], 'startLayerHint':{'axis':[0,0,1],'ranks':face_start_ranks},
                          'endLayerHint':{'axis':[0,0,1],'ranks':face_ranks}})
        title, body = instruction(action,axis,moving_vertices,start)
        steps.append({'id':f'step-{n+1}','title':title,'body':body,'kind':kind,'animation':'resolved','runs':[{'operation':op_id,'from':0,'to':1}],'pauseAfterMs':500})
        annotations.append({'step': f'step-{n+1}', 'axisMm':axis,'movingVertices':sorted(moving_vertices),'endPositionsMm':target,'sourceAction':action_index})
        evidence.append({'operation':op_id,'sourceAction':action_index,'maxEndpointErrorMm':error,'materialAreaMm2':total_area})
        meshes.append(mesh);operations.append(operation)
    if not operations:
        raise ValueError('Empty model')
    steps.insert(0, {'id':'prepare','title':{'en':'Start with a square','es':'Empieza con un cuadrado'},'body':{'en':f'Use a {SCALE} × {SCALE} mm square. Colored side up. This sequence makes the {en.lower()}.','es':f'Usa un cuadrado de {SCALE} × {SCALE} mm. Pon el lado de color hacia arriba. Esta secuencia forma: {es}.'},'kind':'hold','animation':'resolved','runs':[{'operation':operations[0]['id'],'from':0,'to':0}],'pauseAfterMs':1000})
    steps.append({'id':'finished','title':{'en':f'Completed {en.lower()}','es':f'Modelo terminado: {es}'},'body':{'en':'Compare your paper with the final silhouette. Rotate the 3D model to inspect both sides. Return to any step to replay its motion.','es':'Compara tu papel con la silueta final. Gira el modelo 3D para ver ambos lados. Vuelve a cualquier paso para repetir su movimiento.'},'kind':'hold','animation':'resolved','runs':[{'operation':operations[-1]['id'],'from':1,'to':1}],'pauseAfterMs':1000})
    all_positions = [p for o in operations for p in o['startPositionsMm']]
    xmin,xmax = min(p[0] for p in all_positions),max(p[0] for p in all_positions)
    ymin,ymax = min(p[1] for p in all_positions),max(p[1] for p in all_positions)
    center = [(xmin+xmax)/2,(ymin+ymax)/2,0]
    camera = {'projection':'orthographic','positionMm':[center[0]+160,center[1]-200,500],'targetMm':center,'up':[0,1,0],'verticalSpanMm':max(xmax-xmin,ymax-ymin)*1.35,'transitionMs':0}
    for step in steps:step['camera']=camera
    document = {'format':'fold-spec','specVersion':'1.0.0-draft.1','id':identity,'revision':1,'defaultLocale':'en','status':'resolved',
                'metadata':{'title':{'en':en,'es':es},'summary':{'en':f'Build the {en.lower()} with {len(operations)} continuous movements.','es':f'Construye este modelo con {len(operations)} movimientos continuos.'},'source':source['sourceUrl'],'license':'CC-BY-SA-4.0'},
                'sheets':[{'id':'paper','widthMm':SCALE,'heightMm':SCALE,'thicknessMm':.1,'front':{'color':PALETTE[category]},'back':{'color':'#fff6df'}}],
                'accessibility':{},'instructions':{'steps':steps},'geometry':{'status':'complete','meshes':meshes,'operations':operations},
                'assets':[],'narration':[],'history':[],'extensions':[],
                'plega':{'illustrations':annotations,'sourceSha256':source['sourceSha256'],'sourceLicense':'CC-BY-SA-4.0','evidence':evidence}}
    return document, {'id':identity,'title':{'en':en,'es':es},'category':category,'steps':len(steps),'movements':len(operations),
                      'difficulty':'beginner','url':f'/lessons/{identity}/{identity}.fold.json','source':source['sourceUrl'],'license':'CC-BY-SA-4.0'}


def outputs():
    crane = PUBLIC / 'crane/crane.fold.json'
    entries = [{'id':'crane','title':{'en':'Paper crane','es':'Grulla de papel'},'category':'animals','steps':44,'movements':40,'difficulty':'intermediate','url':'/lessons/crane/crane.fold.json','source':'https://github.com/FoldLab/fold-spec/tree/main/examples/crane','license':'MIT','sha256':hashlib.sha256(crane.read_bytes()).hexdigest()}]
    artifacts = {}
    crane_doc = json.loads(crane.read_bytes())
    op = crane_doc['geometry']['operations'][-1]
    if op['kind'] != 'sampled':raise ValueError('Pinned crane final pose changed')
    mesh = next(m for m in crane_doc['geometry']['meshes'] if m['id'] == op['mesh'])
    pose = op['keys'][-1]['positionsMm']
    camera = crane_doc['instructions']['steps'][-1]['camera']
    def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
    def unit(p):
        norm=sum(v*v for v in p)**.5
        return [v/norm for v in p]
    z=unit([camera['positionMm'][i]-camera['targetMm'][i] for i in range(3)])
    x=unit(cross(camera['up'],z));y=cross(z,x)
    projected=[[sum(p[i]*x[i] for i in range(3)),-sum(p[i]*y[i] for i in range(3))] for p in pose]
    xmin,xmax=min(p[0] for p in projected),max(p[0] for p in projected)
    ymin,ymax=min(p[1] for p in projected),max(p[1] for p in projected)
    margin=max(xmax-xmin,ymax-ymin)*.12
    polygons=[]
    for f in sorted(mesh['faces'],key=lambda f:sum(pose[v][i]*z[i] for v in f['vertices'] for i in range(3))):
        a,b,c=[pose[v] for v in f['vertices']]
        normal=cross([b[i]-a[i] for i in range(3)],[c[i]-a[i] for i in range(3)])
        color=crane_doc['sheets'][0]['front' if sum(normal[i]*z[i] for i in range(3))>0 else 'back']['color']
        points=' '.join(f'{projected[v][0]:.4f},{projected[v][1]:.4f}' for v in f['vertices'])
        polygons.append(f'<polygon points="{points}" fill="{color}" stroke="#443a34" stroke-width=".18" stroke-linejoin="round"/>')
    entries[0]['preview']='/lessons/crane/preview.svg'
    artifacts[PUBLIC/'crane/preview.svg']=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{xmin-margin} {ymin-margin} {xmax-xmin+2*margin} {ymax-ymin+2*margin}"><title>Paper crane</title>{"".join(polygons)}</svg>\n').encode('utf-8')
    for path in sorted(SOURCE.glob('*.json')):
        document, entry = compile_model(json.loads(path.read_bytes()))
        content = encoded(document)
        entry['sha256'] = hashlib.sha256(content).hexdigest()
        artifacts[ROOT / 'frontend/public' / entry['url'].lstrip('/')] = content
        # A recognizable preview of the actual final paper, never an external diagram.
        op, mesh = document['geometry']['operations'][-1], document['geometry']['meshes'][-1]
        final = document['plega']['illustrations'][-1]['endPositionsMm']
        xmin,xmax = min(p[0] for p in final),max(p[0] for p in final)
        ymin,ymax = min(p[1] for p in final),max(p[1] for p in final)
        margin = max(xmax-xmin,ymax-ymin)*.12
        polygons = []
        for index in sorted(range(len(mesh['faces'])), key=lambda i: op['endLayerHint']['ranks'][i]):
            face = mesh['faces'][index]
            points = [final[v] for v in face['vertices']]
            signed = sum(points[i][0]*points[(i+1)%3][1]-points[(i+1)%3][0]*points[i][1] for i in range(3))
            color = document['sheets'][0]['front' if signed > 0 else 'back']['color']
            coords = ' '.join(f'{p[0]:.4f},{-p[1]:.4f}' for p in points)
            polygons.append(f'<polygon points="{coords}" fill="{color}" stroke="#443a34" stroke-width=".25" stroke-linejoin="round"/>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{xmin-margin} {-ymax-margin} {xmax-xmin+2*margin} {ymax-ymin+2*margin}"><title>{entry["title"]["en"]}</title>{"".join(polygons)}</svg>\n'
        entry['preview'] = f'/lessons/{entry["id"]}/preview.svg'
        artifacts[ROOT / 'frontend/public' / entry['preview'].lstrip('/')] = svg.encode('utf-8')
        entries.append(entry)
    artifacts[MANIFEST] = (json.dumps(entries, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
    return artifacts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['generate','verify'])
    args = parser.parse_args()
    artifacts = outputs()
    for path, content in artifacts.items():
        if args.command == 'verify':
            if not path.exists() or path.read_bytes() != content:
                raise SystemExit(f'Stale motion artifact: {path.relative_to(ROOT)}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
    print(f'{args.command}: {len(json.loads(artifacts[MANIFEST]))} complete motion documents with source-bound previews')


if __name__ == '__main__':
    main()
