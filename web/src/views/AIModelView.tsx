// AI model validation: what the teammate's research model is, where it applies, and how it
// compares with a seasonal baseline on 2024 (calibration) and 2025 (retrospective test).
// Numbers come from pipeline/ai/results/metrics.json (copied to /data/ai-metrics.json).
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useJSON } from '@/lib/data'
import { useLive } from '@/lib/live'
import { Panel, StateBox } from '@/components/ui'
import { EChart, baseOption, axis, C } from '@/components/EChart'
import { AI_LEVEL_STYLE } from '@/components/ExperimentalForecast'
import { cn } from '@/lib/utils'

interface Split {
  model: Record<string, number>; baseline: Record<string, number>
  bins: { from: number; to: number; n: number; model_mean: number; observed: number; positives: number }[]
}
interface Metrics { training: string; calibration: string; retrospective_test: string; note: string; splits: Record<'calibration_2024' | 'test_2025', Split> }

const ROWS: { key: string; label: string; better: 'high' | 'low'; fmt: (v: number) => string }[] = [
  { key: 'average_precision', label: 'Average precision (PR-AUC)', better: 'high', fmt: (v) => v.toFixed(3) },
  { key: 'top_10_percent_positives', label: 'Detections caught in top 10 % of cell-days', better: 'high', fmt: (v) => String(v) },
  { key: 'brier', label: 'Brier score', better: 'low', fmt: (v) => v.toFixed(4) },
  { key: 'log_loss', label: 'Log loss', better: 'low', fmt: (v) => v.toFixed(4) },
]

interface HeatEval {
  test_period: string; label_cells_from: string; test_detections: number
  overall: { fire: Record<string, number>; industrial: Record<string, number>; accuracy_decided: number; uncertain_share: number }
  new_locations: { n: number; fire: Record<string, number> }
  thermal_model_on_noaa: { n: number; auc: number; accuracy_at_half: number }
  night_share: { nasa_fire_labels: number; nasa_industrial_labels: number; nasa_fire_labels_inside_gihs: number | null }
}

/** Fire vs industrial heat: how the live classifier did on months it never saw. */
function HeatClassifierPanel() {
  const { data } = useJSON<HeatEval>('/data/heat-eval.json')
  if (!data) return null
  const o = data.overall, pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`
  const row = (label: string, r: Record<string, number>) => (
    <tr className="border-b border-line/60">
      <td className="py-1.5">{label} <span className="text-faint num">({r.n.toLocaleString()})</span></td>
      <td className="num">{pct(r.fire, r.n)}</td><td className="num">{pct(r.industrial, r.n)}</td><td className="num">{pct(r.uncertain, r.n)}</td>
    </tr>
  )
  return (
    <Panel title="Heat-source classifier: fire or industrial?" subtitle={`Every live hotspot is classified. Tested on ${data.test_detections.toLocaleString()} NOAA-20/21 detections in Saudi Arabia from ${data.test_period}, months the classifier never saw (location labels built from ${data.label_cells_from}).`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-start text-[13px]">
            <thead className="label"><tr className="border-b border-line">
              <th className="py-2 text-start font-normal">NASA label</th><th className="text-start font-normal">→ fire</th><th className="text-start font-normal">→ industrial</th><th className="text-start font-normal">→ uncertain</th>
            </tr></thead>
            <tbody>{row('Vegetation fire (type 0)', o.fire)}{row('Industrial / offshore (type 2/3)', o.industrial)}</tbody>
          </table>
          <p className="mt-2 text-[12.5px]">Accuracy on decided points: <b className="num text-cyan">{(o.accuracy_decided * 100).toFixed(1)}%</b> · uncertain: <span className="num">{(o.uncertain_share * 100).toFixed(1)}%</span></p>
        </div>
        <ul className="grid gap-1.5 text-[13px] text-muted">
          <li>• <b className="text-ink">Evidence, strongest first:</b> NASA’s own fire/industrial labels for that spot (NOAA-20/21 archive), GIHS industrial heat areas, NASA fire history, then the teammate’s thermal-signature model (I4/I5 brightness, FRP, pixel size, day/night, distance to the nearest plant).</li>
          <li>• <b className="text-ink">The thermal model transfers to NOAA-20/21:</b> AUC <span className="num">{data.thermal_model_on_noaa.auc}</span>, accuracy <span className="num">{(data.thermal_model_on_noaa.accuracy_at_half * 100).toFixed(1)}%</span> (it was trained on Suomi NPP).</li>
          <li>• <b className="text-ink">Carbon monoxide</b> (CAMS model) was tested by the teammate and did not improve the model (80.3% vs 80.9%), so the live site does not use it.</li>
          <li>• <b className="text-ink">NASA’s labels miss some flares:</b> fires labelled by NASA inside GIHS industrial areas were detected at night <span className="num">{Math.round((data.night_share.nasa_fire_labels_inside_gihs ?? 0) * 100)}%</span> of the time, versus <span className="num">{Math.round(data.night_share.nasa_fire_labels * 100)}%</span> for all NASA fires and <span className="num">{Math.round(data.night_share.nasa_industrial_labels * 100)}%</span> for industrial heat. So part of the “fire → industrial” share is likely correct.</li>
          <li>• Facility names (Climate TRACE, OpenStreetMap) only describe a source; they never decide the class.</li>
        </ul>
      </div>
    </Panel>
  )
}

export function AIModelView() {
  const { data, error, loading } = useJSON<Metrics>('/data/ai-metrics.json')
  const { ai } = useLive()
  if (loading) return <StateBox kind="loading" />
  if (error || !data) return <StateBox kind="error">{error}</StateBox>
  const t = data.splits.test_2025, c = data.splits.calibration_2024

  const calib = {
    ...baseOption,
    tooltip: { ...baseOption.tooltip, valueFormatter: (v: unknown) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—') },
    legend: { ...baseOption.legend, data: ['Model says (mean)', 'Observed 2025', 'Observed 2024'] },
    grid: { ...baseOption.grid, left: 52, bottom: 40 },
    xAxis: { ...axis(), type: 'category', data: t.bins.map((b) => `${(b.from * 100).toFixed(0)}–${(b.to * 100).toFixed(0)}`), name: 'index band', nameLocation: 'middle', nameGap: 26 },
    yAxis: { ...axis(), type: 'value', axisLabel: { color: C.muted, formatter: (v: number) => `${(v * 100).toFixed(0)}%` } },
    series: [
      { name: 'Model says (mean)', type: 'bar', data: t.bins.map((b) => b.model_mean), itemStyle: { color: C.violet }, barGap: '10%' },
      { name: 'Observed 2025', type: 'bar', data: t.bins.map((b) => b.observed), itemStyle: { color: C.ember } },
      { name: 'Observed 2024', type: 'bar', data: c.bins.map((b) => b.observed), itemStyle: { color: 'rgba(255,122,61,0.35)' } },
    ],
  }

  return (
    <div className="grid gap-4">
      <HeatClassifierPanel />
      <h2 className="mt-2 font-display text-[18px]">Experimental day-ahead model <span className="text-[13px] font-normal text-muted">· off the map by default: it is no better than the monthly pattern</span></h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="What the model is" className="lg:col-span-2">
          <ul className="grid gap-1.5 text-[13px] text-muted">
            <li>• <b className="text-ink">Logistic regression</b> built by a teammate, with a Platt calibration step. Inputs: NASA POWER daily mean and max temperature, humidity, wind and rain, plus location and season.</li>
            <li>• <b className="text-ink">Predicts</b> whether a 0.5° × 0.625° cell will have a flare-filtered VIIRS vegetation detection <b className="text-ink">tomorrow</b> (03:00–03:00 Saudi time), using weather from 3 days earlier because of NASA POWER’s publishing delay.</li>
            <li>• <b className="text-ink">Coverage:</b> 29 cells in parts of Jazan, Asir and Al Baha only. Trained on Suomi NPP detections 2020–2023, calibrated on 2024, tested on 2025.</li>
            <li>• <b className="text-ink">It is not</b> a wildfire ignition probability or a warning. A missing VIIRS detection does not prove there was no fire.</li>
          </ul>
        </Panel>
        <Panel title="Tomorrow’s pilot grid">
          {!ai ? <p className="text-sm text-muted">NASA POWER data not available right now.</p> : (
            <div className="grid gap-2 text-[13px]">
              {ai.levels.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className={cn('w-20 rounded-full border px-2 py-0.5 text-center text-[11px]', AI_LEVEL_STYLE[l.id].pill)}>{l.label}</span>
                  <span className="num w-6 text-right">{ai.cells.filter((x) => x.level === l.id).length}</span>
                  <span className="text-muted">cells · 2025 hit rate {(l.observed2025 * 100).toFixed(1)}%</span>
                </div>
              ))}
              <p className="text-[11px] text-faint">Index ≥ 5 = High, ≥ 1 = Elevated. Weather day {ai.weatherDateUTC} UTC → target {ai.targetDateUTC}.</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Model vs seasonal baseline" subtitle="The baseline is each cell’s historical detection rate for the calendar month (2020–2023). The better value in each row is highlighted.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead className="label"><tr className="border-b border-line">
              <th className="py-2 font-normal">Metric</th>
              <th className="font-normal">2024 model</th><th className="font-normal">2024 baseline</th>
              <th className="font-normal">2025 model</th><th className="font-normal">2025 baseline</th>
            </tr></thead>
            <tbody>
              {ROWS.map((r) => {
                const cell = (s: Split, who: 'model' | 'baseline') => {
                  const v = s[who][r.key], o = s[who === 'model' ? 'baseline' : 'model'][r.key]
                  const win = r.better === 'high' ? v > o : v < o
                  return <td className={cn('num', win ? 'text-cyan' : 'text-muted')}>{r.fmt(v)}</td>
                }
                return (
                  <tr key={r.key} className="border-b border-line/60">
                    <td className="py-1.5">{r.label}</td>
                    {cell(c, 'model')}{cell(c, 'baseline')}{cell(t, 'model')}{cell(t, 'baseline')}
                  </tr>
                )
              })}
              <tr><td className="py-1.5 text-muted">Cell-days / detections</td>
                <td className="num text-faint" colSpan={2}>{c.model.rows.toLocaleString()} / {c.model.positives}</td>
                <td className="num text-faint" colSpan={2}>{t.model.rows.toLocaleString()} / {t.model.positives}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-lg border border-line px-3 py-2 text-[12px] leading-relaxed text-muted">
          <b className="text-ink">Honest reading:</b> the model is roughly level with the seasonal baseline. In 2025 it scores slightly better on average precision, Brier score and log loss, and slightly worse at ranking (52 vs 57 detections in its top 10 %). Its value is that it reacts to recent observed weather day by day, where the baseline stays fixed for a whole month. {data.note}
        </p>
      </Panel>

      <Panel title="Calibration: does the index mean what it says?" subtitle="For each index band, the mean model score vs the share of cell-days that actually had a detection.">
        <EChart option={calib} height={280} label="Calibration bars: model mean vs observed detection rate per index band" />
        <p className="mt-2 text-[12px] text-muted">Low and mid bands track the observed rates. The top bands overstate in 2025, which is why the site shows relative levels with their observed 2025 rates instead of a probability.</p>
      </Panel>
    </div>
  )
}
