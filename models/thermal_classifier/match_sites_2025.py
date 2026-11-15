"""Reproduce nearest-facility matches for inferred FIRMS types 0/2 in Saudi Arabia.

Counts are individual detections (often repeated passes/pixels), not fire events.
Proximity alone does not prove the facility caused a detection.
"""
import argparse
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from train import ksa_points
from train_with_co import xyz

p = argparse.ArgumentParser()
p.add_argument('--archive', required=True)
p.add_argument('--boundary', required=True)
p.add_argument('--facilities', required=True)
p.add_argument('--output', required=True)
a = p.parse_args()
with zipfile.ZipFile(a.archive) as z:
    names = [n for n in z.namelist() if Path(n).name.startswith('fire_archive_') and n.endswith('.csv')]
    if len(names) != 1: raise ValueError('Expected one FIRMS archive')
    df = pd.read_csv(z.open(names[0]), usecols=['latitude','longitude','acq_date','type'])
df = df[df.acq_date.ge('2025-01-01') & df.acq_date.lt('2026-01-01') & df.type.isin([0,2])].copy()
geo = next(f['geometry'] for f in json.loads(Path(a.boundary).read_text())['features'] if f['properties'].get('id') == 'ksa')
df = df[ksa_points(geo, df[['longitude','latitude']].to_numpy())].copy()
sites = pd.read_csv(a.facilities)
chord, nearest = cKDTree(xyz(sites.latitude,sites.longitude)).query(xyz(df.latitude,df.longitude))
df['km'] = 12742*np.arcsin(np.minimum(1,chord/2))
df['nearest_id'] = sites.iloc[nearest].id.to_numpy()
near = df[df.km<=1]
table = near.groupby('nearest_id').agg(detections=('type','size'), firms_type2=('type',lambda s:(s==2).sum()),
                                      firms_type0=('type',lambda s:(s==0).sum()))
table = table.join(sites.set_index('id')[['name','type','latitude','longitude']]).sort_values('detections',ascending=False)
table.to_csv(a.output)
print(json.dumps({'detections_2025':len(df),'within_1km':len(near),'listed_site_records':len(table),
                  'within_5km':int((df.km<=5).sum())},indent=2))
