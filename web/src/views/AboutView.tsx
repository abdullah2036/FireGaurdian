// About: project, credits, AI tools used.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Panel } from '@/components/ui'

export function AboutView() {
  return (
    <div className="grid max-w-4xl gap-3">
      <Panel title="About NovaShift">
        <div className="grid gap-3 text-sm leading-relaxed text-muted">
          <p>NovaShift is our entry to the <b className="text-ink">NASA Space Apps Challenge 2026</b>, challenge <i>“Harmonization of MODIS and VIIRS Hot Spots”</i>. It merges two generations of NASA fire sensors into one consistent monthly record for Saudi Arabia, so the satellite a hotspot came from no longer changes the story the data tells.</p>
          <p>The app builds on <b className="text-ink">SAFIRE</b>, a teammate’s Streamlit prototype for Saudi fire early warning: its FIRMS fetch, CSV export and honest limitations text are carried into this stack, with fixes for VIIRS confidence codes (l/n/h), the real Saudi border instead of a bounding box, and fast WebGL rendering instead of one marker per point.</p>
          <p className="rounded-lg border border-ember/30 bg-ember-soft p-3 text-ink/90">NovaShift is a research and demonstration tool. It is not an official warning system and does not replace the Saudi Civil Defense or ground-based monitoring.</p>
        </div>
      </Panel>
      <Panel title="AI tools used">
        <p className="text-sm text-muted">We used Claude (Anthropic) for planning and Claude Code to write code. Generated source files carry a short header comment noting AI assistance, as the Space Apps rules require. All data-processing choices were reviewed by the team, and results are validated in the Method &amp; Data view.</p>
      </Panel>
    </div>
  )
}
