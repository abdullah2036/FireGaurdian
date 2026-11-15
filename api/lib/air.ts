// CAMS/Open-Meteo modelled regional surface CO. This is NOT a point sensor.
// Open-Meteo non-commercial terms and attribution apply; suitable for hackathon demo.
import { cached } from './http.js'
import { gridKey, type AirContext } from './heat.js'

export interface AirDetection { lat: number; lon: number; date: string; time: string; source: string }
interface Payload { hourly?: { time?: string[]; carbon_monoxide?: (number | null)[] } }

export async function airForDetections(detections: AirDetection[]): Promise<Map<string, AirContext>> {
  const counts = new Map<string, number>()
  for (const d of detections) if (d.source.startsWith('VIIRS_')) {
    const key = gridKey(d.lat,d.lon)
    counts.set(key,(counts.get(key) ?? 0)+1)
  }
  // Bounded request size; unrequested or unavailable cells use the no-CO model.
  const keys = [...counts].sort((a,b)=>b[1]-a[1]).slice(0,100).map(([k])=>k).sort()
  if (!keys.length) return new Map()
  const groups: string[][] = []
  for (let i=0;i<keys.length;i+=25) groups.push(keys.slice(i,i+25))
  const chunks = await Promise.all(groups.map(async (group) => {
    try {
      return (await cached(`air-co:${group.join(';')}`,900,async () => {
        const pairs = group.map((k) => k.split(',').map(Number))
        const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality')
        url.search = new URLSearchParams({latitude:pairs.map((p)=>(p[0]*.4).toFixed(1)).join(','),
          longitude:pairs.map((p)=>(p[1]*.4).toFixed(1)).join(','),
          hourly:'carbon_monoxide',domains:'cams_global',timezone:'GMT',past_days:'8',forecast_days:'1'}).toString()
        const controller = new AbortController()
        const timer = setTimeout(()=>controller.abort(),9000)
        try {
          const response = await fetch(url,{signal:controller.signal})
          if (!response.ok) throw new Error(`CO provider ${response.status}`)
          const data = await response.json() as Payload | Payload[]
          const list = Array.isArray(data)?data:[data]
          if (list.length!==group.length) throw new Error('CO location count mismatch')
          return list
        } finally { clearTimeout(timer) }
      })).value
    } catch { return [] as Payload[] }
  }))
  const result = new Map<string, AirContext>()
  chunks.forEach((chunk,g) => chunk.forEach((payload,i) => {
    const times=payload.hourly?.time ?? [], values=payload.hourly?.carbon_monoxide ?? []
    if (times.length!==values.length) return
    for (let j=0;j<times.length;j++) {
      const current=values[j]
      if (current==null || !Number.isFinite(current)) continue
      const prev=values.slice(Math.max(0,j-72),j).filter((v):v is number => v!=null && Number.isFinite(v))
      if (prev.length<24) continue
      result.set(`${groups[g][i]}|${times[j].slice(0,13)}`,{value:current,previous72:prev.reduce((a,b)=>a+b,0)/prev.length})
    }
  }))
  return result
}

export function airForDetection(d: AirDetection, data: Map<string,AirContext>) {
  const hour=(d.time ?? '').padStart(4,'0').slice(0,2)
  return data.get(`${gridKey(d.lat,d.lon)}|${d.date}T${hour}`) ?? null
}
