// About: project, how the three sections work, data sources, credits, AI tools used.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Panel } from '@/components/ui'

export function AboutView() {
  return (
    <div className="grid max-w-5xl gap-4 px-4 pt-4 sm:px-8">
      <Panel title="About Fire Guardian">
        <div className="grid gap-3 text-sm leading-relaxed text-muted">
          <p>Fire Guardian is our entry to the <b className="text-ink">NASA Space Apps Challenge 2026</b>, challenge <i>“Harmonization of MODIS and VIIRS Hot Spots”</i>. It turns two generations of NASA fire sensors into one consistent record for Saudi Arabia, then uses that record, with live satellite detections and weather, to detect fires, flag high-risk areas and plan a drone response.</p>
          <p className="rounded-lg border border-ember/30 bg-ember-soft p-3 text-ink/90">Fire Guardian is a research and demonstration tool. It is not an official warning system and does not replace the Saudi Civil Defense. The drone fleet is a simulation; no hardware has been tested.</p>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="1 · Thermal space map">
          <ul className="grid gap-2 text-[13px] text-muted">
            <li><b className="text-red-400">Red</b>: active fires from NOAA-20/21 VIIRS (and optionally MODIS) via NASA FIRMS, with gas flares and industrial heat masked.</li>
            <li><b className="text-orange-300">Orange/yellow</b>: seasonal risk baseline, how often each 25 km cell burned in this calendar month over 2012–2025.</li>
            <li><b className="text-violet-300">Dashed cells (SW)</b>: the AI research index for tomorrow, coloured Low / Elevated / High.</li>
            <li><b className="text-emerald-300">Green</b>: cells with a fire history but low seasonal frequency.</li>
          </ul>
        </Panel>
        <Panel title="2 · Monitoring & prediction">
          <ul className="grid gap-2 text-[13px] text-muted">
            <li><b className="text-ink">AI Fire Prediction</b>: a teammate’s research model (logistic regression on NASA POWER weather) scores tomorrow for 29 cells in Jazan, Asir and Al Baha, as Low / Elevated / High with each level’s 2025 hit rate. It is roughly level with a seasonal baseline; see Analytics → AI model.</li>
            <li><b className="text-ink">Satellite thermal feed</b>: VIIRS shortwave-infrared imagery from NASA GIBS at each hotspot, with FIRMS pixel brightness temperature.</li>
            <li><b className="text-ink">Weather</b>: wind, humidity and temperature at the selected point from Meteomatics.</li>
          </ul>
        </Panel>
        <Panel title="3 · Drone fleet command">
          <ul className="grid gap-2 text-[13px] text-muted">
            <li>18 simulated drones at 12 regional bases. Squadron A attempts suppression on fires; Squadron B sprays preventive coolant on high-risk zones.</li>
            <li>Auto-response dispatches the nearest drones in range, sized by fire radiative power. You can also launch a squadron manually.</li>
            <li>Missions export as QGroundControl <code>.plan</code> files.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="Data sources">
        <ul className="grid gap-1.5 text-sm text-muted">
          <li><b className="text-ink">NASA FIRMS</b>: MODIS C6.1 and VIIRS C2 archive and NRT (historical record), NOAA-20/21 VIIRS and MODIS NRT through the Area API (live).</li>
          <li><b className="text-ink">NASA GIBS</b>: Blue Marble relief, daily VIIRS true-colour and SWIR imagery.</li>
          <li><b className="text-ink">GIHS v3.0</b>: global industrial heat sources used in the flare mask (Ma et al. 2024, CC BY 4.0).</li>
          <li><b className="text-ink">NASA POWER</b>: daily weather inputs for the AI research model.</li>
          <li><b className="text-ink">Meteomatics</b>: point weather. <b className="text-ink">Natural Earth</b>: boundaries.</li>
        </ul>
      </Panel>
      <Panel title="Credits & AI tools used">
        <div className="grid gap-2 text-sm text-muted">
          <p>Built on <b className="text-ink">SAFIRE</b>, a teammate’s Streamlit prototype for Saudi fire early warning. We fixed its VIIRS confidence codes (l/n/h), replaced its bounding box with the real Saudi border, and switched to WebGL map rendering.</p>
          <p>We used Claude (Anthropic) for planning and Claude Code to write code. Generated source files carry a short AI-assistance header comment, as the Space Apps rules require. The team reviewed every data-processing decision.</p>
        </div>
      </Panel>
    </div>
  )
}
