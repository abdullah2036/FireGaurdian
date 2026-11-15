// The map. One view at a time, chosen by the user:
//   live     — hotspots classified as vegetation fires (pulsing flames) + uncertain ones (amber "?")
//   sources  — hotspots classified as industrial / offshore heat (factory, power, flare icons) + known sites
//   forecast — where fires are common in the chosen month (glow); experimental day-ahead AI cells on request
//   danger   — only high-danger areas: fires now and places that burn most years this month
//   drones   — live fires + the simulated drone fleet (Drones page only)
// Tapping a fire, an area or empty ground selects it (weather and details follow the selection).
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Polygon } from 'geojson'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { useApp, type MapLayer } from '@/lib/store'
import { useLive, droneState, FLEET, BASES, type Cluster } from '@/lib/live'
import type { RegionProps } from '@/lib/geo'
import { cn } from '@/lib/utils'

export type MapMode = MapLayer | 'drones'

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const BASEMAP = `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`
const KSA_BOUNDS: [[number, number], [number, number]] = [[34.4, 16.2], [55.8, 32.3]]

const square = (lat: number, lon: number, hy: number, hx = hy): Polygon => ({
  type: 'Polygon', coordinates: [[[lon - hx, lat - hy], [lon + hx, lat - hy], [lon + hx, lat + hy], [lon - hx, lat + hy], [lon - hx, lat - hy]]],
})
const fireSize = (c: Cluster) => (c.frpSum >= 15 ? 34 : c.frpSum >= 3 ? 27 : 21)
const markerOn = (cat: string | undefined, mode: MapMode) =>
  cat === 'fire' ? mode === 'live' || mode === 'danger' || mode === 'drones' : cat === 'uncertain' ? mode === 'live' : mode === 'sources'

/** 24x24 icon paths: flame (fire), factory, bolt (power plant), flare stack (oil & gas), platform (offshore). */
export const ICON = {
  flame: 'M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9 9 9.5 10.5 10.5 11 10 7 12 4 12 2Zm0 20a7 7 0 0 1-7-7c0-2.4 1.1-4.2 2.4-5.6.3 1.6 1 2.7 2.1 3.4A6 6 0 0 0 12 22Z',
  factory: 'M2 21V10l6 3.5V10l6 3.5V4h3l1 9.5V21H2Zm4-3h2v-2H6v2Zm5 0h2v-2h-2v2Zm5 0h2v-2h-2v2Z',
  power: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  flare: 'M11 22V10h2v12h-2Zm-3 0 2-8h4l2 8H8ZM12 1c.7 2 2.5 3.2 2.5 5.5a2.5 2.5 0 0 1-5 0c0-1 .3-1.6.9-2.2-.1 1 .3 1.7.9 2 0-2.3.4-3.6.7-5.3Z',
  offshore: 'M4 20c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1v2c-1.5 0-1.5 1-3 1s-1.5-1-3-1-1.5 1-3 1-1.5-1-3-1-1.5 1-3 1v-2ZM6 17V9h12v8h-2v-3H8v3H6Zm4-10V3h4v4h-4Z',
} as const
export function iconFor(subtype: string | null | undefined): keyof typeof ICON {
  if (subtype === 'power') return 'power'
  if (subtype === 'flare' || subtype === 'oil_gas') return 'flare'
  if (subtype === 'offshore') return 'offshore'
  return 'factory'
}

export function FireMap({ mode, phone = false, className, onSelect, padding }: {
  mode: MapMode; phone?: boolean; className?: string
  onSelect?: () => void; padding?: { top: number; bottom: number; left: number; right: number }
}) {
  const { region } = useApp()
  const live = useLive()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const fireMarkers = useRef<Marker[]>([])
  const droneMarkers = useRef<Map<string, Marker>>(new Map())
  const selMarker = useRef<Marker | null>(null)
  const userMoved = useRef(false)
  const fitRegion = useRef<((animate: boolean) => void) | null>(null)
  const markerClickAt = useRef(0)
  const liveRef = useRef(live)
  liveRef.current = live
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const pad = padding ?? (phone ? { top: 120, bottom: 170, left: 16, right: 16 } : { top: 30, bottom: 30, left: 30, right: 30 })

  // ---- init ----
  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: { base: { type: 'raster', tiles: [BASEMAP], tileSize: 256, maxzoom: 8, attribution: 'Imagery: NASA GIBS / EOSDIS' } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#04070f' } },
          { id: 'base', type: 'raster', source: 'base', paint: { 'raster-brightness-max': 0.7, 'raster-saturation': -0.2, 'raster-contrast': 0.08 } },
        ],
      },
      bounds: KSA_BOUNDS,
      fitBoundsOptions: { padding: pad },
      maxZoom: 11, minZoom: 3,
      attributionControl: { compact: true },
      dragRotate: false, pitchWithRotate: false,
      cooperativeGestures: !phone,
    })
    m.touchZoomRotate.disableRotation()
    m.on('load', () => {
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
      for (const id of ['regions', 'season', 'sites', 'missions', 'ai']) m.addSource(id, { type: 'geojson', data: empty })
      m.addLayer({
        id: 'season-heat', type: 'heatmap', source: 'season',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'p'], 0, 0.05, 0.2, 0.3, 1, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 14, 6, 34, 9, 90],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 9, 1.5],
          'heatmap-opacity': 0.8,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.15, 'rgba(253,224,71,0.22)', 0.45, 'rgba(251,191,36,0.5)', 0.8, 'rgba(249,115,22,0.72)', 1, 'rgba(234,88,12,0.85)'],
        },
      })
      m.addLayer({
        id: 'season-high-heat', type: 'heatmap', source: 'season', filter: ['==', ['get', 'level'], 'high'],
        paint: {
          'heatmap-weight': 1,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 22, 6, 40, 9, 90],
          'heatmap-intensity': 1.2, 'heatmap-opacity': 0.85,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, 'rgba(249,115,22,0.35)', 0.6, 'rgba(234,88,12,0.65)', 1, 'rgba(220,38,38,0.85)'],
        },
      })
      m.addLayer({ id: 'season-high', type: 'fill', source: 'season', filter: ['==', ['get', 'level'], 'high'], paint: { 'fill-color': '#f97316', 'fill-opacity': 0.5 } })
      m.addLayer({ id: 'season-high-line', type: 'line', source: 'season', filter: ['==', ['get', 'level'], 'high'], paint: { 'line-color': '#fdba74', 'line-width': 0.8 } })
      m.addLayer({
        id: 'ai-fill', type: 'fill', source: 'ai',
        paint: {
          'fill-color': ['match', ['get', 'level'], 'high', '#ef4444', 'elevated', '#fbbf24', 'low', '#34d399', '#64748b'],
          'fill-opacity': ['match', ['get', 'level'], 'high', 0.55, 'elevated', 0.4, 'low', 0.22, 0.05],
        },
      })
      m.addLayer({ id: 'ai-line', type: 'line', source: 'ai', paint: { 'line-color': 'rgba(255,255,255,0.7)', 'line-width': 1, 'line-dasharray': [2, 2] } })
      m.addLayer({ id: 'provinces', type: 'line', source: 'regions', filter: ['==', ['get', 'kind'], 'province'], paint: { 'line-color': 'rgba(255,255,255,0.2)', 'line-width': 0.7 } })
      m.addLayer({ id: 'ksa-glow', type: 'line', source: 'regions', filter: ['==', ['get', 'id'], 'ksa'], paint: { 'line-color': 'rgba(255,255,255,0.22)', 'line-width': 5, 'line-blur': 4 } })
      m.addLayer({ id: 'ksa', type: 'line', source: 'regions', filter: ['==', ['get', 'id'], 'ksa'], paint: { 'line-color': 'rgba(255,255,255,0.75)', 'line-width': 1.2 } })
      // known industrial heat sites (NASA type 2/3 detections, NOAA-20/21, clustered): context for the Heat sources view
      m.addLayer({ id: 'sites', type: 'circle', source: 'sites', paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'n'], 10, 3.5, 300, 6, 3000, 9],
        'circle-color': '#94a3b8', 'circle-opacity': 0.35, 'circle-stroke-color': '#cbd5e1', 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.6 } })
      m.addLayer({ id: 'missions', type: 'line', source: 'missions', paint: { 'line-color': ['match', ['get', 'kind'], 'cool', '#22d3ee', '#fb923c'], 'line-width': 1.4, 'line-dasharray': [2, 2], 'line-opacity': 0.85 } })
      setReady(true)
    })
    // selection: AI cell > danger zone > plain point (weather)
    m.on('click', (e) => {
      if (performance.now() - markerClickAt.current < 400) return
      const L = liveRef.current
      if (m.getLayer('sites') && m.getLayoutProperty('sites', 'visibility') !== 'none') {
        const hit = m.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ['sites'] })[0]
        if (hit) {
          const p = hit.properties as { lat: number; lon: number; idx: number }
          L.setFocus({ lat: p.lat, lon: p.lon, label: `Industrial site ${p.idx}`, kind: 'site', id: String(p.idx) })
          onSelectRef.current?.()
          return
        }
      }
      const layers = ['ai-fill', 'season-high'].filter((id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none')
      const f = layers.length ? m.queryRenderedFeatures(e.point, { layers })[0] : undefined
      if (f?.layer.id === 'ai-fill') {
        const p = f.properties as { lat: number; lon: number }
        L.setFocus({ lat: p.lat, lon: p.lon, label: `AI cell ${p.lat}, ${p.lon}`, kind: 'ai', id: `${p.lat},${p.lon}` })
      } else if (f?.layer.id === 'season-high') {
        const p = f.properties as { lat: number; lon: number }
        L.setFocus({ lat: p.lat, lon: p.lon, label: `Zone ${p.lat}, ${p.lon}`, kind: 'zone', id: `${p.lat},${p.lon}` })
      } else {
        L.setFocus({ lat: e.lngLat.lat, lon: e.lngLat.lng, label: `${e.lngLat.lat.toFixed(2)}, ${e.lngLat.lng.toFixed(2)}`, kind: 'point' })
      }
      onSelectRef.current?.()
    })
    for (const id of ['ai-fill', 'season-high', 'sites']) {
      m.on('mouseenter', id, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''))
    }
    const markUser = (e: { originalEvent?: unknown }) => { if (e.originalEvent) userMoved.current = true }
    m.on('dragstart', markUser)
    m.on('zoomstart', markUser)
    const ro = new ResizeObserver(() => { m.resize(); if (!userMoved.current) fitRegion.current?.(false) })
    ro.observe(el.current)
    map.current = m
    if (import.meta.env.DEV) (window as unknown as { __fgmap: MLMap }).__fgmap = m
    return () => { ro.disconnect(); m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- static data ----
  useEffect(() => {
    if (ready && live.regions) (map.current!.getSource('regions') as GeoJSONSource).setData(live.regions)
  }, [ready, live.regions])

  const seasonFC = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: live.risk.map((c) => ({ type: 'Feature', properties: { p: c.p, level: c.level, lat: c.lat, lon: c.lon }, geometry: square(c.lat, c.lon, 0.125) })),
  }), [live.risk])
  useEffect(() => { if (ready) (map.current!.getSource('season') as GeoJSONSource).setData(seasonFC) }, [ready, seasonFC])

  const aiFC = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (live.ai?.cells ?? []).map((c) => ({
      type: 'Feature', properties: { lat: c.lat, lon: c.lon, level: c.level ?? 'none' }, geometry: square(c.lat, c.lon, 0.25, 0.3125),
    })),
  }), [live.ai])
  useEffect(() => { if (ready) (map.current!.getSource('ai') as GeoJSONSource).setData(aiFC) }, [ready, aiFC])

  useEffect(() => {
    if (!ready) return
    ;(map.current!.getSource('sites') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: (live.heatSites ?? []).map((s, idx) => ({ type: 'Feature', properties: { lat: s.lat, lon: s.lon, n: s.n, idx }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })),
    })
  }, [ready, live.heatSites])

  // ---- which layers each view shows ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const vis = (id: string, on: boolean) => m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    vis('season-heat', mode === 'forecast')
    vis('season-high', mode === 'danger')
    vis('season-high-heat', mode === 'danger')
    vis('season-high-line', mode === 'danger')
    vis('ai-fill', mode === 'forecast' && live.aiOnMap)
    vis('ai-line', mode === 'forecast' && live.aiOnMap)
    vis('sites', mode === 'sources')
    vis('missions', mode === 'drones')
    fireMarkers.current.forEach((mk) => { mk.getElement().style.display = markerOn(mk.getElement().dataset.cat, mode) ? '' : 'none' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready, live.aiOnMap])

  // ---- markers: fires (red flame), uncertain (amber ?), industrial (slate icon by type) ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    fireMarkers.current.forEach((mk) => mk.remove())
    const all: { c: Cluster; cat: 'fire' | 'uncertain' | 'source' }[] = [
      ...live.clusters.slice(0, 60).map((c) => ({ c, cat: 'fire' as const })),
      ...live.uncertainClusters.slice(0, 40).map((c) => ({ c, cat: 'uncertain' as const })),
      ...live.staticClusters.slice(0, 120).map((c) => ({ c, cat: 'source' as const })),
    ]
    fireMarkers.current = all.map(({ c, cat }) => {
      const div = document.createElement('button')
      div.dataset.cat = cat
      if (cat === 'fire') {
        const size = fireSize(c)
        div.className = 'fg-fire'
        div.style.width = div.style.height = `${size}px`
        div.setAttribute('aria-label', `Fire ${c.id}`)
        div.innerHTML = `<span class="fg-fire-ring"></span><svg viewBox="0 0 24 24" width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" fill="currentColor" aria-hidden="true"><path d="${ICON.flame}"/></svg>`
      } else if (cat === 'uncertain') {
        div.className = 'fg-unc'
        div.setAttribute('aria-label', `Unconfirmed hotspot ${c.id}`)
        div.textContent = '?'
      } else {
        div.className = cn('fg-src', c.category === 'offshore' && 'fg-src-off')
        div.setAttribute('aria-label', `Industrial heat ${c.id}`)
        div.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="${ICON[iconFor(c.subtype)]}"/></svg>`
      }
      div.style.display = markerOn(cat, mode) ? '' : 'none'
      div.addEventListener('click', (ev) => {
        ev.stopPropagation()
        markerClickAt.current = performance.now()
        const kind = cat === 'fire' ? 'fire' : cat === 'uncertain' ? 'uncertain' : 'static'
        liveRef.current.setFocus({ lat: c.lat, lon: c.lon, label: `${kind} ${c.id}`, kind, id: c.id })
        onSelectRef.current?.()
      })
      return new maplibregl.Marker({ element: div }).setLngLat([c.lon, c.lat]).addTo(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.clusters, live.uncertainClusters, live.staticClusters, ready])

  // ---- selection ring ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !live.focus) return
    if (!selMarker.current) {
      const div = document.createElement('div')
      div.className = 'fg-sel'
      selMarker.current = new maplibregl.Marker({ element: div }).setLngLat([live.focus.lon, live.focus.lat]).addTo(m)
    }
    selMarker.current.setLngLat([live.focus.lon, live.focus.lat])
    selMarker.current.getElement().dataset.kind = live.focus.kind ?? 'point'
  }, [live.focus, ready])

  // ---- drones (Drones page only) ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    if (mode !== 'drones') {
      droneMarkers.current.forEach((mk) => mk.remove())
      droneMarkers.current.clear()
      return
    }
    ;(m.getSource('missions') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: live.drones.filter((d) => d.mission && d.status !== 'Standby').map((d) => ({
        type: 'Feature', properties: { kind: d.mission!.kind },
        geometry: { type: 'LineString', coordinates: [[d.drone.base.lon, d.drone.base.lat], [d.mission!.target.lon, d.mission!.target.lat]] },
      })),
    })
  }, [live.drones, ready, mode])

  useEffect(() => {
    const m = map.current
    if (!m || !ready || mode !== 'drones') return
    const bases = BASES.map((b) => {
      const div = document.createElement('div')
      div.className = 'fg-base'
      div.title = b.name
      return new maplibregl.Marker({ element: div }).setLngLat([b.lon, b.lat]).addTo(m)
    })
    let raf = 0
    const frame = () => {
      const now = liveRef.current.simNow()
      for (const d of FLEET) {
        const s = droneState(d, liveRef.current.missions, now)
        let mk = droneMarkers.current.get(d.id)
        if (s.status === 'Standby') { if (mk) { mk.remove(); droneMarkers.current.delete(d.id) } continue }
        if (!mk) {
          const div = document.createElement('div')
          div.className = cn('fg-drone', d.squadron === 'B' && 'fg-drone-b')
          div.innerHTML = `<span class="fg-drone-dot"></span><span class="fg-drone-label">${d.id}</span>`
          mk = new maplibregl.Marker({ element: div }).setLngLat([s.lon, s.lat]).addTo(m)
          droneMarkers.current.set(d.id, mk)
        }
        mk.setLngLat([s.lon, s.lat])
        mk.getElement().dataset.status = s.status
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); bases.forEach((b) => b.remove()) }
  }, [ready, mode])

  // ---- fit to region ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !live.regions) return
    const f = live.regions.features.find((f) => (f.properties as RegionProps).id === region)
    if (!f) return
    const [a, b, c, d] = (f.properties as RegionProps).bbox
    fitRegion.current = (animate) => m.fitBounds([[a, b], [c, d]], { padding: pad, duration: animate ? 900 : 0 })
    userMoved.current = false
    fitRegion.current(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, ready, live.regions])

  // bring the selection into view when it comes from a list (not from a map tap)
  const lastFocus = useRef<string>('')
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !live.focus) return
    const key = `${live.focus.kind}:${live.focus.id ?? ''}:${live.focus.lat.toFixed(3)}`
    if (key === lastFocus.current) return
    lastFocus.current = key
    if (!m.getBounds().contains([live.focus.lon, live.focus.lat])) m.easeTo({ center: [live.focus.lon, live.focus.lat], duration: 700 })
  }, [live.focus, ready])

  const zoom = (dz: number) => map.current?.easeTo({ zoom: map.current.getZoom() + dz, duration: 250 })
  const recenter = () => { userMoved.current = false; fitRegion.current ? fitRegion.current(true) : map.current?.fitBounds(KSA_BOUNDS, { padding: pad, duration: 700 }) }

  return (
    <div className={cn('relative overflow-hidden', !phone && 'rounded-2xl border border-line', className)}>
      <div ref={el} className="h-full w-full" role="region" aria-label="Map of Saudi Arabia" />
      <div className={cn('absolute end-3 z-10 flex flex-col gap-2', !phone && 'top-3')} style={phone ? { top: pad.top } : undefined}>
        {!phone && (
          <div className="map-ctl flex flex-col">
            <button onClick={() => zoom(1)} aria-label="Zoom in"><Plus size={16} /></button>
            <span className="mx-2 h-px bg-line" />
            <button onClick={() => zoom(-1)} aria-label="Zoom out"><Minus size={16} /></button>
          </div>
        )}
        <div className="map-ctl"><button onClick={recenter} aria-label="Recenter map" className={phone ? '!h-11 !w-11' : ''}><Crosshair size={phone ? 19 : 16} /></button></div>
      </div>
      {live.loading && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-cyan/70" />}
    </div>
  )
}
