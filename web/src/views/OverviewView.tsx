// Overview: the three-column mission dashboard.
//   Left   — AI prediction slot (seasonal baseline for now), satellite thermal feed, weather
//   Centre — thermal space map: active fires (red), risk zones (orange/yellow), safe zones (green)
//   Right  — drone fleet command (simulation), drone feed, response controls, alerts
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { FireMap } from '@/components/FireMap'
import {
  AIPredictionCard, AlertsCard, ControlsCard, DroneFeedCard, EmergencyBar, FleetCard, ThermalFeedCard, WeatherCard,
} from '@/components/panels'

export function OverviewView() {
  return (
    <div className="grid gap-4 px-4 sm:px-8">
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_330px] lg:grid-cols-[290px_minmax(0,1fr)]">
        <div className="grid content-start gap-4 fade-up">
          <AIPredictionCard />
          <ThermalFeedCard />
          <WeatherCard />
        </div>
        <FireMap className="h-[560px] lg:h-auto lg:min-h-[680px] fade-up" />
        <div className="grid content-start gap-4 fade-up lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
          <FleetCard />
          <DroneFeedCard />
          <ControlsCard />
          <AlertsCard />
        </div>
      </div>
      <EmergencyBar />
    </div>
  )
}
