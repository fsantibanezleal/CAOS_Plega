"""Recheck sanitized trajectories with the pinned offline authoring simulator.

This command deliberately has separate dependencies. Routine tests and releases
compile committed geometry using only the Python standard library.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REVISION = 'f6d4fc6aaf4dfa2c82a8b5f7274c198498f4f122'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator',type=Path,required=True)
    parser.add_argument('--verify-upstream',action='store_true',help='Explicitly download and hash public logs without persisting them')
    args=parser.parse_args()
    checkout=args.simulator.resolve()
    revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=checkout,text=True).strip()
    if revision!=REVISION:raise SystemExit('Simulator must be at the documented pinned revision')
    import numpy
    if numpy.__version__!='2.2.6':raise SystemExit('Replay requires NumPy 2.2.6')
    sys.path.insert(0,str(checkout/'src'))
    from origami.origami import Origami
    count=0
    for path in sorted((ROOT/'data/guide/motion-sources').glob('*.json')):
        source=json.loads(path.read_bytes())
        if args.verify_upstream:
            with urlopen(source['sourceUrl'],timeout=60) as response:
                digest=hashlib.sha256(response.read()).hexdigest()
            if digest!=source['sourceSha256']:raise SystemExit('Upstream content changed: '+source['name'])
        sim=Origami();history=[]
        for action in source['actions']:
            before=json.loads(json.dumps(sim.export()))
            if before!=action['before']:raise SystemExit('Source state mismatch: '+path.name)
            p=action['params'];kind=action['function'];moving=[]
            if kind=='fold':moving=list(sim.fold(tuple(p['edge']),int(p['direction'])))
            elif kind=='unfold':
                edge=p.get('edge') or next(a['params']['edge'] for a in reversed(history) if a['function']=='fold')
                moving=list(sim.unfold(tuple(edge)))
            elif kind=='rotate':sim.rotate(float(p['angle']))
            elif kind=='flip':sim.flip(p['axis'])
            elif kind=='add_vertex':sim.add_vertex(tuple(p['edge']),float(p['position']))
            else:raise SystemExit('Unsupported source action')
            after=json.loads(json.dumps(sim.export()))
            if after!=action['after'] or set(moving)!=set(action['moving']):raise SystemExit('Replay mismatch: '+path.name)
            history.append(action);sim=Origami(after)
        count+=1;print('Exact replay:',source['name'],len(history),'actions')
    print(count,'sanitized sequences rechecked; no inference, raw logs or provider settings were published')


if __name__=='__main__':main()
