"""Experimental SNPP VIIRS hotspot classifier; labels are FIRMS inferences, not ground truth."""
import argparse
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib.path import Path as PolygonPath
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import confusion_matrix, roc_auc_score, average_precision_score


def ksa_points(geometry, xy):
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    result = np.zeros(len(xy), dtype=bool)
    for polygon in polygons:
        outer = np.asarray(polygon[0])
        candidate = (xy[:, 0] >= outer[:, 0].min()) & (xy[:, 0] <= outer[:, 0].max()) & (xy[:, 1] >= outer[:, 1].min()) & (xy[:, 1] <= outer[:, 1].max())
        ii = np.flatnonzero(candidate)
        if not len(ii):
            continue
        inside = PolygonPath(outer).contains_points(xy[ii])
        for hole in polygon[1:]:
            inside &= ~PolygonPath(np.asarray(hole)).contains_points(xy[ii])
        result[ii] |= inside
    return result


def features(df):
    return np.column_stack([
        df.brightness, df.bright_t31, df.brightness - df.bright_t31,
        np.log1p(df.frp), df.scan, df.track,
        df.daynight.eq('N').astype(float), df.confidence.eq('l').astype(float),
        df.confidence.eq('h').astype(float),
    ]).astype(float)


def metrics(y, scores):
    out = {'n': len(y), 'type0': int((y == 0).sum()), 'type2': int((y == 1).sum()),
           'auc': round(float(roc_auc_score(y, scores)), 4),
           'average_precision_type2': round(float(average_precision_score(y, scores)), 4)}
    for lo, hi in [(0.1, 0.9), (0.2, 0.8), (0.3, 0.7), (0.4, 0.6)]:
        decided = (scores <= lo) | (scores >= hi)
        pred = (scores[decided] >= hi).astype(int)
        cm = confusion_matrix(y[decided], pred, labels=[0, 1]) if decided.any() else np.zeros((2, 2), dtype=int)
        a, b, c, d = [int(x) for x in cm.ravel()]
        out[f'{lo}-{hi}'] = {'coverage': round(float(decided.mean()), 4),
                             'label_type0_pred_type0': a, 'label_type0_pred_type2': b,
                             'label_type2_pred_type0': c, 'label_type2_pred_type2': d,
                             'precision_type0': round(a / (a + c), 4) if a + c else None,
                             'precision_type2': round(d / (b + d), 4) if b + d else None}
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--archive', required=True)
    p.add_argument('--boundary', required=True)
    p.add_argument('--output', default='model.json')
    p.add_argument('--fixtures', help='Optional real held-out sample rows for cross-language tests')
    a = p.parse_args()
    with zipfile.ZipFile(a.archive) as z:
        names = [n for n in z.namelist() if Path(n).name.startswith('fire_archive_') and n.endswith('.csv')]
        if len(names) != 1: raise ValueError('Expected exactly one FIRMS archive CSV')
        df = pd.read_csv(z.open(names[0]))
    df = df[df.type.isin([0, 2]) & df.acq_date.ge('2020-01-01') & df.acq_date.lt('2026-03-01')].copy()
    for col in ['brightness', 'bright_t31', 'frp', 'scan', 'track', 'latitude', 'longitude']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    valid = (df.brightness.between(250, 500) & df.bright_t31.between(200, 400) & df.frp.between(0, 10000) &
             df.scan.between(0.1, 5) & df.track.between(0.1, 5) & df.daynight.isin(['D', 'N']) &
             df.confidence.isin(['l', 'n', 'h']))
    df = df[valid].copy()
    geo = next(f['geometry'] for f in json.loads(Path(a.boundary).read_text())['features'] if f['properties'].get('id') == 'ksa')
    df = df[ksa_points(geo, df[['longitude', 'latitude']].to_numpy())].copy()
    year = df.acq_date.str[:4].astype(int).to_numpy()
    latblock = np.floor(df.latitude.to_numpy() * 2).astype(int)
    lonblock = np.floor(df.longitude.to_numpy() * 2).astype(int)
    held = (latblock + 7 * lonblock) % 5 == 0
    X = features(df)
    y = (df.type.to_numpy() == 2).astype(int)
    train = (year <= 2023) & ~held
    validation = (year == 2024) & held
    development = (year == 2025) & held
    test = (year == 2026) & held
    scaler = StandardScaler().fit(X[train])
    classifier = HistGradientBoostingClassifier(max_iter=120, max_leaf_nodes=15, learning_rate=0.05,
        l2_regularization=5, class_weight='balanced', random_state=42).fit(scaler.transform(X[train]), y[train])
    report = {'training_rows': int(train.sum()), 'training_type0': int((train & (y == 0)).sum()),
              'training_type2': int((train & (y == 1)).sum()),
              'validation_2024': metrics(y[validation], classifier.predict_proba(scaler.transform(X[validation]))[:, 1]),
              'development_2025': metrics(y[development], classifier.predict_proba(scaler.transform(X[development]))[:, 1]),
              'exploratory_test_jan_feb_2026': metrics(y[test], classifier.predict_proba(scaler.transform(X[test]))[:, 1])}
    result = {'features': ['brightnessK', 'brightI5K', 'channelDifferenceK', 'log1pFRP', 'scan', 'track', 'night', 'confidenceLow', 'confidenceHigh'],
              'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(),
              'baseline': float(classifier._baseline_prediction[0, 0]),
              # Node format: [feature index, numeric threshold, left, right, leaf value, is leaf].
              'trees': [[[int(n['feature_idx']), float(n['num_threshold']), int(n['left']), int(n['right']),
                          float(n['value']), int(n['is_leaf'])] for n in tree[0].nodes] for tree in classifier._predictors],
              'report': report}
    Path(a.output).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    if a.fixtures:
        indices = np.flatnonzero(test)
        scores = classifier.predict_proba(scaler.transform(X[test]))[:, 1]
        samples = []
        for label, mask in [('vegetation_like', scores <= .3), ('uncertain', (scores > .3) & (scores < .7)), ('static_like', scores >= .7)]:
            for pos in np.flatnonzero(mask)[:3]:
                row = df.iloc[indices[pos]]
                samples.append({'expectedPattern': label, 'pythonScore': float(scores[pos]), 'input': {
                    'source': 'VIIRS_SNPP_NRT', 'brightK': float(row.brightness), 'brightI5K': float(row.bright_t31),
                    'frp': float(row.frp), 'scan': float(row.scan), 'track': float(row.track),
                    'daynight': row.daynight, 'conf': row.confidence, 'static': None, 'reportedType': None}})
        Path(a.fixtures).write_text(json.dumps(samples, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__': main()
