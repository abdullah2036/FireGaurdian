// The map. One view at a time, chosen by the user:
//   live     — fires seen by NASA satellites (pulsing flame icons); optional filtered industrial heat
//   forecast — where fires are common this month (glow) + tomorrow's AI index cells (southwest pilot)
//   danger   — only high-danger areas: fires now, places that burn most years this month, AI "high" cells
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

export function FireMap({ mode, showFlares = false, phone = false, className, onSelect, padding }: {
  mode: MapMode; showFlares?: boolean; phone?: boolean; className?: string
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
      for (const id of ['regions', 'season', 'flares', 'missions', 'ai']) m.addSource(id, { type: 'geojson', data: empty })
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
      m.addLayer({ id: 'flares', type: 'circle', source: 'flares', paint: { 'circle-radius': 3, 'circle-color': '#94a3b8', 'circle-opacity': 0.85, 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 1 } })
      m.addLayer({ id: 'missions', type: 'line', source: 'missions', paint: { 'line-color': ['match', ['get', 'kind'], 'cool', '#22d3ee', '#fb923c'], 'line-width': 1.4, 'line-dasharray': [2, 2], 'line-opacity': 0.85 } })
      setReady(true)
    })
    // selection: AI cell > danger zone > plain point (weather)
    m.on('click', (e) => {
      if (performance.now() - markerClickAt.current < 400) return
      const L = liveRef.current
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
    for (const id of ['ai-fill', 'season-high']) {
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
    const flares = (live.firms?.detections ?? []).filter((d) => d.static)
    ;(map.current!.getSource('flares') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: flares.map((d) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [d.lon, d.lat] } })),
    })
  }, [ready, live.firms])

  // ---- which layers each view shows ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const vis = (id: string, on: boolean) => m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    vis('season-heat', mode === 'forecast')
    vis('season-high', mode === 'danger')
    vis('season-high-heat', mode === 'danger')
    vis('season-high-line', mode === 'danger')
    vis('ai-fill', mode === 'forecast' || mode === 'danger')
    vis('ai-line', mode === 'forecast' || mode === 'danger')
    m.setFilter('ai-fill', mode === 'danger' ? ['==', ['get', 'level'], 'high'] : null)
    m.setFilter('ai-line', mode === 'danger' ? ['==', ['get', 'level'], 'high'] : null)
    vis('flares', mode === 'live' && showFlares)
    vis('missions', mode === 'drones')
    const firesOn = mode !== 'forecast'
    fireMarkers.current.forEach((mk) => (mk.getElement().style.display = firesOn ? '' : 'none'))
  }, [mode, showFlares, ready])

  // ---- fire markers (one per fire cluster) ----
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    fireMarkers.current.forEach((mk) => mk.remove())
    fireMarkers.current = live.clusters.slice(0, 40).map((c) => {
      const size = fireSize(c)
      const div = document.createElement('button')
      div.className = 'fg-fire'
      div.style.width = div.style.height = `${size}px`
      div.setAttribute('aria-label', `Fire ${c.id}`)
      div.innerHTML = `<span class="fg-fire-ring"></span><svg viewBox="0 0 24 24" width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9 9 9.5 10.5 10.5 11 10 7 12 4 12 2Zm0 20a7 7 0 0 1-7-7c0-2.4 1.1-4.2 2.4-5.6.3 1.6 1 2.7 2.1 3.4A6 6 0 0 0 12 22Z"/></svg>`
      div.style.display = mode === 'forecast' ? 'none' : ''
      div.addEventListener('click', (ev) => {
        ev.stopPropagation()
        markerClickAt.current = performance.now()
        liveRef.current.setFocus({ lat: c.lat, lon: c.lon, label: `Fire ${c.id}`, kind: 'fire', id: c.id })
        onSelectRef.current?.()
      })
      return new maplibregl.Marker({ element: div }).setLngLat([c.lon, c.lat]).addTo(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.clusters, ready])

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
