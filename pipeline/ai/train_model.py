"""Fit a three-day-lag experimental satellite-detection model.

The previous project panel uses UTC target = weather UTC day + 2. This script
reuses its labels, but pairs weather with target UTC day + 3 to accommodate the
observed NASA POWER near-real-time delay. The target remains VIIRS detection,
not independently confirmed ignition. No 2025 records are fitted.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
PANEL = Path(os.environ.get('RESEARCH_PANEL', ROOT.parent / 'FireGuardian_AI_Research/data/research_panel.csv'))
OUT = ROOT / 'results'
OUT.mkdir(exist_ok=True)
CONT = ['LAT', 'LON', 'T2M', 'T2M_MAX', 'RH2M', 'WS10M', 'PRECTOTCORR', 'season_sin', 'season_cos']

def continuous(frame):
    day = frame.target_date_utc.dt.dayofyear.to_numpy()
    angle = 2*np.pi*(day-1)/365.25
    return np.column_stack([*[frame[k].to_numpy() for k in CONT[:7]],np.sin(angle),np.cos(angle)])

def indicator(frame, locs):
    return ((frame.LAT.to_numpy()[:,None] == locs[:,0]) & (frame.LON.to_numpy()[:,None] == locs[:,1])).astype(float)

def metrics(y, p):
    k=math.ceil(len(y)*.1)
    pick=np.argsort(-p,kind='stable')[:k]
    return {'rows':len(y),'positives':int(y.sum()), 'observed_rate':float(y.mean()),
            'mean_score':float(p.mean()),'brier':float(brier_score_loss(y,p)),
            'log_loss':float(log_loss(y,p)),'average_precision':float(average_precision_score(y,p)),
            'top_10_percent_selected':k,'top_10_percent_positives':int(y[pick].sum())}

def main():
    old=pd.read_csv(PANEL,parse_dates=['date_utc','target_date_utc'])
    labels=old[['LAT','LON','target_date_utc','target']].copy()
    weather=old.drop(columns=['target_date_utc','target','detections']).copy()
    weather['target_date_utc']=weather.date_utc+pd.Timedelta(days=3)
    # Drop only years outside the label panel; inner join does not manufacture negatives.
    data=weather.merge(labels,on=['LAT','LON','target_date_utc'],how='inner',validate='one_to_one')
    assert (data.target_date_utc-data.date_utc==pd.Timedelta(days=3)).all()
    year=data.target_date_utc.dt.year
    train,valid,test=(data[year.between(2020,2023)].copy(),data[year.eq(2024)].copy(),data[year.eq(2025)].copy())
    locs=train[['LAT','LON']].drop_duplicates().sort_values(['LAT','LON']).to_numpy()
    assert len(locs)==29 and (indicator(data,locs).sum(axis=1)==1).all()
    assert train.target_date_utc.max() < valid.target_date_utc.min() < test.target_date_utc.min()
    scaler=StandardScaler().fit(continuous(train))
    def X(df): return np.column_stack([scaler.transform(continuous(df)),indicator(df,locs)])
    model=LogisticRegression(C=.3,max_iter=3000,solver='lbfgs').fit(X(train),train.target)
    calibrator=LogisticRegression(C=1e6,max_iter=1000).fit(model.decision_function(X(valid)).reshape(-1,1),valid.target)
    def predict(df): return calibrator.predict_proba(model.decision_function(X(df)).reshape(-1,1))[:,1]
    train['month']=train.target_date_utc.dt.month
    regional=train.groupby('month').target.mean()
    cells=train.groupby(['LAT','LON','month']).target.agg(['sum','count'])
    cells['rate']=[(row['sum']+100*regional.loc[ix[2]])/(row['count']+100) for ix,row in cells.iterrows()]
    def baseline(df):
        ix=pd.MultiIndex.from_arrays([df.LAT,df.LON,df.target_date_utc.dt.month],names=['LAT','LON','month'])
        values=cells.rate.reindex(ix).to_numpy(); assert np.isfinite(values).all(); return values
    results={'training':'2020–2023','calibration':'2024','retrospective_test':'2025',
             'weather_utc_day_to_target_utc_day':3,
             'note':'2025 was inspected in previous research. This is a retrospective research evaluation, not a new pristine final test. No ground-confirmed non-fire labels.',
             'splits':{}}
    for name,df in [('calibration_2024',valid),('test_2025',test)]:
        y=df.target.to_numpy(); p=predict(df); q=baseline(df)
        results['splits'][name]={'model':metrics(y,p),'baseline':metrics(y,q)}
        edges=[0,.01,.02,.05,.1,.2,1.001]
        results['splits'][name]['bins']=[{'from':lo,'to':min(1,hi),'n':int(sel.sum()),
          'model_mean':float(p[sel].mean()),'observed':float(y[sel].mean()),'positives':int(y[sel].sum())}
          for lo,hi in zip(edges[:-1],edges[1:]) if (sel:=(p>=lo)&(p<hi)).any()]
    trained={'version':'lag3-research-1','feature_order_continuous':CONT,
             'standard_scaler_mean':scaler.mean_.tolist(),'standard_scaler_scale':scaler.scale_.tolist(),
             'locations':locs.tolist(),'coefficients':model.coef_[0].tolist(),'intercept':float(model.intercept_[0]),
             'platt_a':float(calibrator.coef_[0,0]),'platt_b':float(calibrator.intercept_[0]),
             'training_ranges':{k:[float(train[k].min()),float(train[k].max())] for k in CONT[:7]},
             'weather_utc_day_to_target_utc_day':3,
             'purpose':'Experimental output for retained VIIRS detections, not a calibrated wildfire ignition probability.'}
    (OUT/'model.json').write_text(json.dumps(trained,indent=2),encoding='utf-8')
    (OUT/'metrics.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    pick=test.iloc[[0,1000,3000,5000,9000]][['date_utc','target_date_utc']+CONT[:7]].copy()
    pick['expected_score']=predict(test.iloc[[0,1000,3000,5000,9000]])
    pick['date_utc']=pick.date_utc.dt.strftime('%Y-%m-%d')
    pick['target_date_utc']=pick.target_date_utc.dt.strftime('%Y-%m-%d')
    (OUT/'reference_examples.json').write_text(pick.to_json(orient='records',indent=2,double_precision=15),encoding='utf-8')
    print(json.dumps(results,indent=2))

if __name__=='__main__': main()
