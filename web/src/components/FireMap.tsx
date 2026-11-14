// Thermal space map: NASA GIBS basemap + live FIRMS fires (red), seasonal risk zones (orange/yellow),
// low-risk "safe" cells (green), masked flares, and the simulated drone fleet.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson'
import { CalendarClock, ChevronDown, Crosshair, Layers, Minus, Plus, Satellite } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useLive, SOURCE_OPTIONS, droneState, FLEET, BASES, type Cluster } from '@/lib/live'
import type { RegionProps } from '@/lib/geo'
import { Popover, PopoverContent, PopoverTrigger } from './ui'
import { cn } from '@/lib/utils'

const yesterday = () => new Date(Date.now() - 86400e3).toISOString().slice(0, 10)
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const BASEMAPS = {
  bluemarble: { label: 'Blue Marble relief (NASA)', url: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, max: 8 },
  today: { label: `VIIRS true colour · ${yesterday()}`, url: `${GIBS}/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${yesterday()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, max: 9 },
} as const
type BasemapId = keyof typeof BASEMAPS

const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
const KSA_BOUNDS: [[number, number], [number, number]] = [[34.4, 16.2], [55.8, 32.3]]

function square(lat: number, lon: number, half: number): Polygon {
  return { type: 'Polygon', coordinates: [[[lon - half, lat - half], [lon + half, lat - half], [lon + half, lat + half], [lon - half, lat + half], [lon - half, lat - half]]] }
}

export function FireMap({ className }: { className?: string }) {
  const { region } = useApp()
  const live = useLive()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const [basemap, setBasemap] = useState<BasemapId>('bluemarble')
  const [show, setShow] = useState({ ai: true, risk: true, fires: true, flares: true, drones: true, safe: true })
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null)
  const clusterMarkers = useRef<Marker[]>([])
  const droneMarkers = useRef<Map<string, Marker>>(new Map())
  const userMoved = useRef(false)
  const fitRegion = useRef<((animate: boolean) => void) | null>(null)

  // ---- init ----
  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: {
          base: { type: 'raster', tiles: [BASEMAPS.bluemarble.url], tileSize: 256, maxzoom: 8, attribution: 'Imagery: NASA GIBS / EOSDIS' },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#04070f' } },
          { id: 'base', type: 'raster', source: 'base', paint: { 'raster-brightness-max': 0.72, 'raster-saturation': -0.15, 'raster-contrast': 0.08 } },
        ],
      },
      bounds: KSA_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      maxZoom: 11,
      minZoom: 3,
      attributionControl: { compact: true },
      dragRotate: false,
      cooperativeGestures: true,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    m.on('load', () => {
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
      for (const id of ['regions', 'risk', 'fires', 'flares', 'missions', 'ai']) m.addSource(id, { type: 'geojson', data: empty })
      m.addLayer({ id: 'safe', type: 'fill', source: 'risk', filter: ['==', ['get', 'level'], 'low'], paint: { 'fill-color': '#34d399', 'fill-opacity': 0.12 } })
      m.addLayer({
        id: 'risk-heat', type: 'heatmap', source: 'risk', filter: ['!=', ['get', 'level'], 'low'],
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'p'], 0.2, 0.25, 1, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 14, 6, 34, 9, 90],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 9, 1.6],
          'heatmap-opacity': 0.78,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.15, 'rgba(250,204,21,0.25)', 0.45, 'rgba(251,146,60,0.55)', 0.8, 'rgba(249,115,22,0.75)', 1, 'rgba(234,88,12,0.85)'],
        },
      })
      m.addLayer({ id: 'risk-hit', type: 'fill', source: 'risk', paint: { 'fill-color': '#000', 'fill-opacity': 0 } })
      m.addLayer({
        id: 'fire-heat', type: 'heatmap', source: 'fires',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'frp'], 1], 0, 0.4, 50, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 18, 7, 40, 10, 80],
          'heatmap-intensity': 1.4,
          'heatmap-opacity': 0.9,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.1, 'rgba(127,29,29,0.35)', 0.4, 'rgba(220,38,38,0.65)', 0.7, 'rgba(239,68,68,0.85)', 1, 'rgba(254,202,202,0.95)'],
        },
      })
      m.addLayer({
        id: 'ai-fill', type: 'fill', source: 'ai',
        paint: { 'fill-color': ['match', ['get', 'level'], 'high', '#ef4444', 'elevated', '#fbbf24', 'low', '#34d399', '#64748b'],
          'fill-opacity': ['match', ['get', 'level'], 'high', 0.42, 'elevated', 0.3, 'low', 0.1, 0.05] },
      })
      m.addLayer({ id: 'ai-line', type: 'line', source: 'ai', paint: { 'line-color': 'rgba(196,181,253,0.75)', 'line-width': 0.8, 'line-dasharray': [3, 2] } })
      m.addLayer({ id: 'provinces', type: 'line', source: 'regions', filter: ['==', ['get', 'kind'], 'province'], paint: { 'line-color': 'rgba(255,255,255,0.22)', 'line-width': 0.7 } })
      m.addLayer({ id: 'ksa-glow', type: 'line', source: 'regions', filter: ['==', ['get', 'id'], 'ksa'], paint: { 'line-color': 'rgba(255,255,255,0.25)', 'line-width': 5, 'line-blur': 4 } })
      m.addLayer({ id: 'ksa', type: 'line', source: 'regions', filter: ['==', ['get', 'id'], 'ksa'], paint: { 'line-color': 'rgba(255,255,255,0.75)', 'line-width': 1.2 } })
      m.addLayer({ id: 'flares', type: 'circle', source: 'flares', paint: { 'circle-radius': 2.5, 'circle-color': '#94a3b8', 'circle-opacity': 0.8, 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 0.5 } })
      m.addLayer({ id: 'fire-pts', type: 'circle', source: 'fires', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 9, 4], 'circle-color': '#fecaca', 'circle-opacity': 0.9 } })
      m.addLayer({ id: 'missions', type: 'line', source: 'missions', paint: { 'line-color': ['match', ['get', 'kind'], 'cool', '#22d3ee', '#fb923c'], 'line-width': 1.4, 'line-dasharray': [2, 2], 'line-opacity': 0.85 } })
      setReady(true)
    })
    const onMove = () => { const b = m.getBounds(); setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]) }
    // Keep the region framed when the container resizes, until the user pans/zooms themselves.
    const markUser = (e: { originalEvent?: unknown }) => { if (e.originalEvent) userMoved.current = true }
    m.on('dragstart', markUser)
    m.on('zoomstart', markUser)
    const ro = new ResizeObserver(() => { m.resize(); if (!userMoved.current) fitRegion.current?.(false) })
    ro.observe(el.current)
    m.on('moveend', onMove)
    m.on('load', onMove)

    const popup = new maplibregl.Popup({ closeButton: false, className: 'fg-popup', maxWidth: '260px' })
    m.on('click', 'risk-hit', (e) => {
      // The AI pilot layer sits on top; let its own handler answer clicks inside a pilot cell.
      if (m.getLayer('ai-fill') && m.queryRenderedFeatures(e.point, { layers: ['ai-fill'] }).length) return
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as { p: number; level: string }
      const name = p.level === 'high' ? 'High risk zone' : p.level === 'elevated' ? 'Elevated risk' : 'Low risk (safe)'
      popup.setLngLat(e.lngLat).setHTML(
        `<b>${name}</b><br/><span class="muted">Seasonal ignition frequency this month: <b>${Math.round(p.p * 100)}%</b> of years</span><br/><span class="faint">Historical baseline · AI model layer coming</span>`,
      ).addTo(m)
      live.setFocus({ lat: e.lngLat.lat, lon: e.lngLat.lng, label: `${name} · ${e.lngLat.lat.toFixed(2)}°N ${e.lngLat.lng.toFixed(2)}°E` })
    })
    m.on('click', 'ai-fill', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as { lat: number; lon: number; scoreIndex: number | null; label: string }
      popup.setLngLat(e.lngLat).setHTML(
        p.scoreIndex == null
          ? `<b>AI pilot cell</b><br/><span class="muted">No index: NASA data missing or outside the model range.</span>`
          : `<b>AI research index: ${Number(p.scoreIndex).toFixed(1)} / 100 · ${p.label}</b><br/><span class="muted">Cell ${p.lat}°N ${p.lon}°E (0.5° × 0.625°), tomorrow (Saudi time)</span><br/><span class="faint">Teammate's model on NASA POWER weather · not a wildfire probability</span>`,
      ).addTo(m)
      live.setFocus({ lat: p.lat, lon: p.lon, label: `AI pilot cell ${p.lat}°N ${p.lon}°E` })
    })
    m.on('mouseenter', 'ai-fill', () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', 'ai-fill', () => (m.getCanvas().style.cursor = ''))
    m.on('mouseenter', 'risk-hit', () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', 'risk-hit', () => (m.getCanvas().style.cursor = ''))
    map.current = m
    if (import.meta.env.DEV) (window as unknown as { __fgmap: MLMap }).__fgmap = m
    return () => { ro.disconnect(); m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- basemap switch ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const src = m.getSource('base') as maplibregl.RasterTileSource
    src.setTiles([BASEMAPS[basemap].url])
  }, [basemap, ready])

  // ---- data ----
  useEffect(() => {
    if (!ready || !live.regions) return
    ;(map.current!.getSource('regions') as GeoJSONSource).setData(live.regions)
  }, [ready, live.regions])

  const riskFC = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: live.risk.map((c) => ({ type: 'Feature', properties: { p: c.p, level: c.level }, geometry: square(c.lat, c.lon, 0.125) })),
  }), [live.risk])
  useEffect(() => {
    if (!ready) return
    ;(map.current!.getSource('risk') as GeoJSONSource).setData(riskFC)
  }, [ready, riskFC])

  useEffect(() => {
    if (!ready) return
    const dets = live.firms?.detections ?? []
    const fc = (arr: typeof dets): FeatureCollection => ({
      type: 'FeatureCollection',
      features: arr.map((d) => ({ type: 'Feature', properties: { frp: d.frp, static: d.static }, geometry: { type: 'Point', coordinates: [d.lon, d.lat] } })),
    })
    ;(map.current!.getSource('fires') as GeoJSONSource).setData(fc(dets.filter((d) => !d.static)))
    ;(map.current!.getSource('flares') as GeoJSONSource).setData(fc(dets.filter((d) => d.static)))
  }, [ready, live.firms])

  const aiFC = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (live.ai?.cells ?? []).map((c) => ({
      type: 'Feature',
      properties: { lat: c.lat, lon: c.lon, scoreIndex: c.scoreIndex, level: c.level ?? 'none', label: live.ai!.levels.find((l) => l.id === c.level)?.label ?? '—' },
      geometry: { type: 'Polygon', coordinates: [[[c.lon - 0.3125, c.lat - 0.25], [c.lon + 0.3125, c.lat - 0.25], [c.lon + 0.3125, c.lat + 0.25], [c.lon - 0.3125, c.lat + 0.25], [c.lon - 0.3125, c.lat - 0.25]]] },
    })),
  }), [live.ai])
  useEffect(() => {
    if (!ready) return
    ;(map.current!.getSource('ai') as GeoJSONSource).setData(aiFC)
  }, [ready, aiFC])

  // ---- layer visibility ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const vis = (ids: string[], on: boolean) => ids.forEach((id) => m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'))
    vis(['risk-heat', 'risk-hit'], show.risk)
    vis(['safe'], show.safe)
    vis(['ai-fill', 'ai-line'], show.ai)
    vis(['fire-heat', 'fire-pts'], show.fires)
    vis(['flares'], show.flares)
    vis(['missions'], show.drones)
    clusterMarkers.current.forEach((mk) => (mk.getElement().style.display = show.fires ? '' : 'none'))
    droneMarkers.current.forEach((mk) => (mk.getElement().style.display = show.drones ? '' : 'none'))
  }, [show, ready])

  // ---- cluster flame markers ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    clusterMarkers.current.forEach((mk) => mk.remove())
    clusterMarkers.current = live.clusters.slice(0, 25).map((c: Cluster) => {
      const big = c.frpSum >= 15
      const div = document.createElement('button')
      div.className = cn('fg-flame', big && 'fg-flame-big')
      div.setAttribute('aria-label', `Active fire ${c.id}: ${c.n} hotspots, FRP ${c.frpSum.toFixed(0)} MW`)
      div.innerHTML = `<svg viewBox="0 0 24 24" width="${big ? 16 : 12}" height="${big ? 16 : 12}" fill="currentColor"><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9 9 9.5 10.5 10.5 11 10 7 12 4 12 2Zm0 20a7 7 0 0 1-7-7c0-2.4 1.1-4.2 2.4-5.6.3 1.6 1 2.7 2.1 3.4A6 6 0 0 0 12 22Z"/></svg>`
      div.style.display = show.fires ? '' : 'none'
      div.onclick = () => live.setFocus({ lat: c.lat, lon: c.lon, label: `Hotspot ${c.id}${c.province ? ` · ${c.province}` : ''}` })
      const pop = new maplibregl.Popup({ closeButton: false, offset: 14, className: 'fg-popup' }).setHTML(
        `<b>Active fire · ${c.id}</b>${c.province ? ` <span class="muted">${c.province}</span>` : ''}<br/>` +
        `<span class="muted">${c.n} hotspot(s) · FRP ${c.frpSum.toFixed(1)} MW${c.maxBrightK ? ` · ${(c.maxBrightK - 273.15).toFixed(0)}°C` : ''}</span><br/>` +
        `<span class="faint">Latest ${esc(c.latest)} UTC</span>`)
      return new maplibregl.Marker({ element: div }).setLngLat([c.lon, c.lat]).setPopup(pop).addTo(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.clusters, ready])

  // ---- drones: animate markers + mission lines ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const lines: Feature<Geometry>[] = []
    for (const ds of live.drones) {
      if (ds.mission && ds.status !== 'Standby') lines.push({
        type: 'Feature', properties: { kind: ds.mission.kind },
        geometry: { type: 'LineString', coordinates: [[ds.drone.base.lon, ds.drone.base.lat], [ds.mission.target.lon, ds.mission.target.lat]] },
      })
    }
    ;(m.getSource('missions') as GeoJSONSource).setData({ type: 'FeatureCollection', features: lines })
  }, [live.drones, ready])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    let raf = 0
    const frame = () => {
      const now = live.simNow()
      for (const d of FLEET) {
        const s = droneState(d, live.missions, now)
        let mk = droneMarkers.current.get(d.id)
        if (s.status === 'Standby') { if (mk) { mk.remove(); droneMarkers.current.delete(d.id) } continue }
        if (!mk) {
          const div = document.createElement('div')
          div.className = cn('fg-drone', d.squadron === 'B' && 'fg-drone-b')
          div.innerHTML = `<span class="fg-drone-dot"></span><span class="fg-drone-label">${d.id}</span>`
          div.title = `${d.id} · ${d.model}`
          div.style.display = show.drones ? '' : 'none'
          mk = new maplibregl.Marker({ element: div }).setLngLat([s.lon, s.lat]).addTo(m)
          droneMarkers.current.set(d.id, mk)
        }
        mk.setLngLat([s.lon, s.lat])
        mk.getElement().dataset.status = s.status
      }
      raf = requestAnimationFrame(frame)
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) frame()
    else raf = requestAnimationFrame(frame)
    const t = reduce ? setInterval(frame, 2000) : 0
    return () => { cancelAnimationFrame(raf); if (t) clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.missions, ready, show.drones])

  // ---- base markers (static) ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const mks = BASES.map((b) => {
      const div = document.createElement('div')
      div.className = 'fg-base'
      div.title = `Drone base · ${b.name}`
      return new maplibregl.Marker({ element: div }).setLngLat([b.lon, b.lat]).addTo(m)
    })
    return () => mks.forEach((x) => x.remove())
  }, [ready])

  // ---- fit to region ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !live.regions) return
    const f = live.regions.features.find((f) => (f.properties as RegionProps).id === region)
    if (!f) return
    const [a, b, c, d] = (f.properties as RegionProps).bbox
    fitRegion.current = (animate) => m.fitBounds([[a, b], [c, d]], { padding: 28, duration: animate ? 900 : 0 })
    userMoved.current = false
    fitRegion.current(true)
  }, [region, ready, live.regions])

  const zoom = (dz: number) => map.current?.easeTo({ zoom: map.current.getZoom() + dz, duration: 250 })
  const recenter = () => { userMoved.current = false; fitRegion.current ? fitRegion.current(true) : map.current?.fitBounds(KSA_BOUNDS, { padding: 20, duration: 700 }) }
  const srcLabel = SOURCE_OPTIONS.find((s) => s.id === live.sources)?.label ?? 'VIIRS'
  const top = live.risk.filter((r) => r.level === 'high').sort((a, b) => b.p - a.p)[0]

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-line', className)}>
      <div ref={el} className="h-full w-full" aria-label="Map of Saudi Arabia with live fires, risk zones and drones" role="region" />

      {/* top-left: sensor */}
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="map-chip" aria-label="Choose satellite source"><Satellite size={15} /> {srcLabel} <ChevronDown size={14} className="text-muted" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-1.5">
            {SOURCE_OPTIONS.map((s) => (
              <button key={s.id} onClick={() => live.setSources(s.id)}
                className={cn('block w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/[0.06] cursor-pointer', s.id === live.sources && 'text-cyan')}>{s.label}</button>
            ))}
            <p className="px-2.5 pb-1 pt-2 text-[11px] text-faint">NASA FIRMS near-real-time. Suomi NPP ended 2 Nov 2026.</p>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button className="map-chip" aria-label="Map layers"><Layers size={15} /> Layers</button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] text-sm">
            <div className="label mb-1.5">Basemap</div>
            {(Object.keys(BASEMAPS) as BasemapId[]).map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 py-1"><input type="radio" name="bm" checked={basemap === b} onChange={() => setBasemap(b)} className="accent-cyan-400" />{BASEMAPS[b].label}</label>
            ))}
            <div className="label mb-1.5 mt-3">Overlays</div>
            {([['fires', 'Active fires (red)'], ['ai', 'AI research index · SW pilot'], ['risk', 'Seasonal risk baseline (orange/yellow)'], ['safe', 'Safe zones (green)'], ['drones', 'Drone fleet (simulation)'], ['flares', 'Masked flares / industry']] as const).map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 py-1"><input type="checkbox" checked={show[k]} onChange={(e) => setShow((s) => ({ ...s, [k]: e.target.checked }))} className="accent-cyan-400" />{l}</label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* top-right: time window */}
      <div className="absolute right-3 top-3 z-10">
        <Popover>
          <PopoverTrigger asChild>
            <button className="map-chip" aria-label="Choose time window">
              <CalendarClock size={15} />
              <span className="num text-[12px]">{live.firms ? new Date(live.firms.fetchedAt).toISOString().slice(0, 16).replace('T', ' · ') + ' UTC' : 'Loading…'}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[220px] p-1.5">
            {[1, 2, 3, 5].map((d) => (
              <button key={d} onClick={() => live.setDays(d)}
                className={cn('block w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/[0.06] cursor-pointer', d === live.days && 'text-cyan')}>
                Last {d === 1 ? '24 h (UTC today)' : `${d} days`}
              </button>
            ))}
            <button onClick={live.reload} className="mt-1 block w-full rounded-md px-2.5 py-2 text-left text-sm text-muted hover:bg-white/[0.06] cursor-pointer">Refresh now</button>
          </PopoverContent>
        </Popover>
      </div>

      {/* right: zoom */}
      <div className="absolute right-3 top-16 z-10 flex flex-col gap-2">
        <div className="map-ctl flex flex-col">
          <button onClick={() => zoom(1)} aria-label="Zoom in"><Plus size={16} /></button>
          <span className="mx-2 h-px bg-line" />
          <button onClick={() => zoom(-1)} aria-label="Zoom out"><Minus size={16} /></button>
        </div>
        <div className="map-ctl"><button onClick={recenter} aria-label="Recenter on Saudi Arabia"><Crosshair size={16} /></button></div>
      </div>

      {/* high-risk chip */}
      {top && show.risk && (
        <button
          onClick={() => { map.current?.flyTo({ center: [top.lon, top.lat], zoom: 7, duration: 1200 }); live.setFocus({ lat: top.lat, lon: top.lon, label: `High risk zone · ${top.lat.toFixed(2)}°N ${top.lon.toFixed(2)}°E` }) }}
          className="map-chip absolute left-1/2 top-3 z-10 -translate-x-1/2 hidden md:inline-flex"
        >
          <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_10px_2px_rgba(249,115,22,0.8)]" /> High risk zone · {Math.round(top.p * 100)}% <ChevronDown size={14} className="-rotate-90 text-muted" />
        </button>
      )}

      {/* legend */}
      <div className="map-ctl absolute bottom-3 left-3 z-10 w-[230px] p-2.5 text-[11px]">
        <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#34d399 0%,#facc15 35%,#f97316 65%,#dc2626 100%)' }} />
        <div className="mt-1 flex justify-between text-muted"><span>Safe</span><span>Risk</span><span>Active fire</span></div>
        <div className="mt-1.5 flex items-center gap-3 text-faint">
          <span className="inline-flex items-center gap-1"><span className="fg-base !static" />Base</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />Sqn A</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan" />Sqn B</span>
        </div>
        {show.ai && live.ai && (
          <div className="mt-1.5 flex items-center gap-2 text-faint">
            <span className="h-2.5 w-3.5 border border-dashed border-violet-300/80" />AI index:
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 bg-emerald-400/60" />Low</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 bg-amber-400/80" />Elev.</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 bg-red-500/80" />High</span>
          </div>
        )}
      </div>

      {/* mini map */}
      <MiniMap regions={live.regions} bounds={bounds} />

      {live.loading && <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 animate-pulse bg-cyan/70" />}
      {live.firms?.mock && <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-danger/50 bg-danger/15 px-3 py-1 text-[11px] text-danger">Mock fire data — FIRMS key missing or unavailable</div>}
    </div>
  )
}

function MiniMap({ regions, bounds }: { regions: FeatureCollection<Geometry, RegionProps> | null; bounds: [number, number, number, number] | null }) {
  const [x0, y0, x1, y1] = [34.4, 16.2, 55.8, 32.3]
  const W = 120, H = 92
  const px = (lon: number) => ((lon - x0) / (x1 - x0)) * W
  const py = (lat: number) => H - ((lat - y0) / (y1 - y0)) * H
  const path = useMemo(() => {
    const f = regions?.features.find((f) => f.properties.id === 'ksa')
    if (!f) return ''
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []
    return polys.map((p) => 'M' + (p[0] as number[][]).filter((_, i) => i % 3 === 0).map(([lon, lat]) => `${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join('L') + 'Z').join('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions])
  return (
    <div className="map-ctl absolute bottom-3 right-3 z-10 hidden p-1.5 sm:block" aria-hidden>
      <svg width={W} height={H}>
        <path d={path} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
        {bounds && (
          <rect x={Math.max(0, px(bounds[0]))} y={Math.max(0, py(bounds[3]))}
            width={Math.max(3, Math.min(W, px(bounds[2])) - Math.max(0, px(bounds[0])))}
            height={Math.max(3, Math.min(H, py(bounds[1])) - Math.max(0, py(bounds[3])))}
            fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth={1} />
        )}
      </svg>
    </div>
  )
}
