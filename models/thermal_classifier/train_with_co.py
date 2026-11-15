"""Train FIRMS-inferred source classifier with Saudi facility proximity and CAMS CO.

FIRMS type is not an independently verified ground-truth fire. CAMS CO may include
fire emissions estimated from satellite FRP; it is not independent confirmation.
"""
import argparse
import gzip
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from train import ksa_points


def xyz(lat, lon):
    lat, lon = np.deg2rad(lat), np.deg2rad(lon)
    return np.column_stack([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])


def gridkey(v):
    return np.floor(np.asarray(v) / .4 + .5 + 1e-9).astype(int)


def load_co(path):
    # Open-Meteo CSV: coordinate metadata, blank line, then hourly table.
    opener = gzip.open if str(path).endswith('.gz') else open
    with opener(path, 'rt', encoding='utf-8') as f:
        lines = f.readlines()
    divider = next(i for i, line in enumerate(lines) if not line.strip())
    from io import StringIO
    meta = pd.read_csv(StringIO(''.join(lines[:divider])))
    data = pd.read_csv(StringIO(''.join(lines[divider+1:])))
    data.columns = ['id', 'time', 'co']
    data['time'] = pd.to_datetime(data.time, format='%Y-%m-%dT%H:%M', utc=True)
    data['co'] = pd.to_numeric(data.co, errors='coerce')
    data = data.sort_values(['id', 'time'])
    data['co_prev72'] = data.groupby('id', sort=False)['co'].transform(lambda s: s.shift(1).rolling(72, min_periods=24).mean())
    meta['grid_lat'], meta['grid_lon'] = gridkey(meta.latitude), gridkey(meta.longitude)
    assert not meta.duplicated(['grid_lat','grid_lon']).any()
    return data.merge(meta[['location_id','grid_lat','grid_lon']], left_on='id', right_on='location_id', validate='many_to_one')


def metrics(y, score):
    bins = []
    for left in np.arange(0, 1, .1):
        sel = (score >= left) & ((score < left+.1) if left < .9 else (score <= 1))
        if sel.any():
            bins.append({'range': [round(float(left),1), round(float(left+.1),1)], 'n': int(sel.sum()),
                         'mean_model_index': round(float(score[sel].mean()),3),
                         'firms_type2_fraction': round(float(y[sel].mean()),3)})
    pred = score >= .5
    return {'n': len(y), 'firms_type0': int((y==0).sum()), 'firms_type2': int((y==1).sum()),
            'auc': round(float(roc_auc_score(y,score)),4),
            'brier': round(float(brier_score_loss(y,score)),4),
            'log_loss': round(float(log_loss(y,score)),4),
            'correct_at_half': round(float((pred == y).mean()),4),
            'type0_pred_type0':int(((y==0)&(~pred)).sum()), 'type0_pred_type2':int(((y==0)&pred).sum()),
            'type2_pred_type0':int(((y==1)&(~pred)).sum()), 'type2_pred_type2':int(((y==1)&pred).sum()),
            'calibration_bins': bins}


def export_model(model, calibration, features):
    return {'features': features, 'baseline': float(model._baseline_prediction[0,0]),
            'calibrationSlope': float(calibration.coef_[0,0]), 'calibrationIntercept': float(calibration.intercept_[0]),
            'trees': [[[int(n['feature_idx']), float(n['num_threshold']), int(n['left']), int(n['right']),
                        float(n['value']), int(n['is_leaf'])] for n in tree[0].nodes] for tree in model._predictors]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--archive', required=True); p.add_argument('--boundary', required=True)
    p.add_argument('--co-csv', required=True); p.add_argument('--facilities', required=True)
    p.add_argument('--output', required=True); p.add_argument('--fixtures', required=True)
    a = p.parse_args()
    with zipfile.ZipFile(a.archive) as z:
        names = [n for n in z.namelist() if Path(n).name.startswith('fire_archive_') and n.endswith('.csv')]
        if len(names) != 1: raise ValueError('Expected one FIRMS archive')
        df = pd.read_csv(z.open(names[0]), dtype={'acq_time': str})
    df = df[df.type.isin([0,2]) & df.acq_date.ge('2024-01-01') & df.acq_date.lt('2026-03-01')].copy()
    for col in ['brightness','bright_t31','frp','scan','track','latitude','longitude']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    valid = (df.brightness.between(250,500) & df.bright_t31.between(200,400) & df.frp.between(0,10000) &
             df.scan.between(.1,5) & df.track.between(.1,5) & df.daynight.isin(['D','N']) & df.confidence.isin(['l','n','h']))
    df = df[valid].copy()
    geo = next(f['geometry'] for f in json.loads(Path(a.boundary).read_text())['features'] if f['properties'].get('id') == 'ksa')
    df = df[ksa_points(geo, df[['longitude','latitude']].to_numpy())].copy()
    df['grid_lat'], df['grid_lon'] = gridkey(df.latitude), gridkey(df.longitude)
    t = df.acq_time.fillna('').astype(str).str.zfill(4)
    df['time'] = pd.to_datetime(df.acq_date+'T'+t.str[:2]+':00', errors='coerce', utc=True)
    co = load_co(a.co_csv)
    df = df.merge(co[['grid_lat','grid_lon','time','co','co_prev72']], how='inner', on=['grid_lat','grid_lon','time'], validate='many_to_one')
    df = df[df.co.notna() & df.co_prev72.notna() & df.time.notna()].copy()
    catalog = pd.read_csv(a.facilities)
    tree = cKDTree(xyz(catalog.latitude, catalog.longitude))
    chord, nearest = tree.query(xyz(df.latitude,df.longitude), k=1)
    df['distance_km'] = 12742 * np.arcsin(np.minimum(1, chord/2))
    df['nearest_id'] = catalog.iloc[nearest].id.to_numpy()
    df['channelDelta'] = df.brightness-df.bright_t31
    df['logFrp'] = np.log1p(df.frp)
    df['night'] = df.daynight.eq('N').astype(int)
    df['confLow'], df['confHigh'] = df.confidence.eq('l').astype(int), df.confidence.eq('h').astype(int)
    df['logDistance'] = np.log1p(df.distance_km.clip(upper=250))
    df['coDelta'] = df.co-df.co_prev72
    base = ['brightness','bright_t31','channelDelta','logFrp','scan','track','night','confLow','confHigh','logDistance']
    full = base+['co','coDelta']
    y = (df.type.to_numpy()==2).astype(int)
    year = df.time.dt.year.to_numpy()
    latblock = np.floor(df.latitude.to_numpy()*2).astype(int)
    lonblock = np.floor(df.longitude.to_numpy()*2).astype(int)
    hold = (latblock+7*lonblock)%5==0
    train = (year==2024)&~hold
    # Calibrate using 2025 from spatially held-out blocks, then test 2026 in the same blocks.
    # The 2026 evaluation is out-of-year, but not a fresh set of locations from calibration.
    cal = (year==2025)&hold
    tests = {'2025_training_regions':(year==2025)&~hold, '2026_jan_feb_geographic_holdout':(year==2026)&hold}
    result, predictions = {}, {}
    for name, cols in [('with_co',full),('without_co',base)]:
        X = df[cols].to_numpy(float)
        model = HistGradientBoostingClassifier(max_iter=120,max_leaf_nodes=15,learning_rate=.05,l2_regularization=5,random_state=42)
        model.fit(X[train], y[train])
        calibrator = LogisticRegression(C=1000, max_iter=1000).fit(model.decision_function(X[cal]).reshape(-1,1),y[cal])
        report = {key:metrics(y[mask],calibrator.predict_proba(model.decision_function(X[mask]).reshape(-1,1))[:,1]) for key,mask in tests.items()}
        result[name] = {'model': export_model(model,calibrator,cols), 'report':report}
        predictions[name] = calibrator.predict_proba(model.decision_function(X).reshape(-1,1))[:,1]
    testmask = tests['2026_jan_feb_geographic_holdout']
    samples=[]
    for i in np.flatnonzero(testmask)[:12]:
        row = df.iloc[i]
        samples.append({'features': {k:float(row[k]) for k in full},
                        'expectedStaticProbability': float(predictions['with_co'][i]),
                        'expectedStaticProbabilityNoCO':float(predictions['without_co'][i])})
    result['description'] = {'training_rows': int(train.sum()),'calibration_rows':int(cal.sum()),
      'matched_rows_all':len(df), 'co_cells':int(co.id.nunique()),'facilities':len(catalog),
      'training':'2024 non-held-out spatial blocks','calibration':'2025 held-out spatial blocks',
      'test':'2026 Jan-Feb in held-out blocks; these blocks were seen in calibration',
      'target':'NASA FIRMS inferred type 0 vs type 2, not verified ground truth',
      'notes':['2025 facility inventory used retrospectively during 2024 training: potential look-ahead',
        'CAMS CO ~0.4 degree model not local measured gas and can include satellite fire-emission inputs',
        'S-NPP calibration only; NOAA-20/21 deployment unvalidated',
        'Top 80 grid cells selected from 2024 hotspot density; coverage not all Saudi Arabia',
        'A nearest named facility is not necessarily the source of a hotspot']}
    Path(a.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(a.fixtures).write_text(json.dumps(samples,indent=2)+'\n')
    print(json.dumps({'description':result['description'],'results':{k:v['report'] for k,v in result.items() if k in ('with_co','without_co')}},indent=2))

if __name__ == '__main__': main()
