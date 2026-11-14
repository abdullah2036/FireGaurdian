// Experimental NASA-POWER-to-VIIRS detection index; not a wildfire ignition forecast.
import { AI_MODEL } from '../data/ai-model.js'

export const MODEL = AI_MODEL
export const PARAMS = ['T2M', 'T2M_MAX', 'RH2M', 'WS10M', 'PRECTOTCORR']
const MS_DAY = 86400_000

export class ForecastError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ForecastError('invalid_date', 'Expected YYYY-MM-DD UTC')
  const d = new Date(value + 'T00:00:00.000Z')
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new ForecastError('invalid_date', 'Invalid calendar date')
  return d
}

export function plusDays(date, days) {
  return new Date(dateParts(date).getTime() + days * MS_DAY).toISOString().slice(0, 10)
}

export function forecastDates(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new ForecastError('invalid_date', 'Invalid current time')
  const todaySaudi = new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0,10)
  const targetUTC = plusDays(todaySaudi, 1)
  return { todaySaudi, targetUTC, weatherUTC: plusDays(targetUTC,-3),
    targetStartSaudi: `${targetUTC} 03:00`, targetEndSaudi: `${plusDays(targetUTC,1)} 03:00` }
}

export function modelCell(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const latCenter = Math.floor(lat / .5 + .5) * .5
  const lonCenter = Math.floor(lon / .625 + .5) * .625
  const location = MODEL.locations.find(([a,b]) => a === latCenter && b === lonCenter)
  return location ? { lat: location[0], lon: location[1] } : null
}

function sigmoid(z) { return z >= 0 ? 1/(1+Math.exp(-z)) : Math.exp(z)/(1+Math.exp(z)) }

export function predict(input, model = MODEL) {
  const target = dateParts(input.target_date_utc)
  if (plusDays(input.date_utc,3) !== input.target_date_utc) throw new ForecastError('bad_horizon','Weather must be 3 UTC days before target')
  for (const name of ['LAT','LON',...PARAMS]) {
    const x = input[name], range = model.training_ranges[name]
    if (typeof x !== 'number' || !Number.isFinite(x)) throw new ForecastError('missing_weather', `Missing ${name}`)
    if (x < range[0] || x > range[1]) throw new ForecastError('out_of_range', `${name} outside training range`)
  }
  const cell = model.locations.findIndex(([a,b]) => a === input.LAT && b === input.LON)
  if (cell < 0) throw new ForecastError('outside_coverage', 'Cell outside trained area')
  const doy = 1 + (target.getTime() - Date.UTC(target.getUTCFullYear(),0,1))/MS_DAY
  const angle = 2*Math.PI*(doy-1)/365.25
  const values = [input.LAT,input.LON,...PARAMS.map(name => input[name]),Math.sin(angle),Math.cos(angle)]
  let raw = model.intercept
  for (let i=0; i<values.length; i++) raw += (values[i]-model.standard_scaler_mean[i])/model.standard_scaler_scale[i]*model.coefficients[i]
  raw += model.coefficients[values.length+cell]
  return sigmoid(model.platt_a*raw+model.platt_b)
}

export function parsePower(body, weatherDate) {
  const key = weatherDate.replaceAll('-','')
  const p = body?.properties?.parameter
  const result = {}
  for (const name of PARAMS) {
    const value=p?.[name]?.[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= -900) throw new ForecastError('weather_unavailable', `NASA POWER has no valid ${name} for ${weatherDate}`)
    result[name]=value
  }
  return result
}

export async function requestPower(lat, lon, weatherDate, fetchImpl = fetch) {
  const compact=weatherDate.replaceAll('-','')
  dateParts(weatherDate)
  const params=new URLSearchParams({ parameters: PARAMS.join(','), community:'AG', longitude:String(lon), latitude:String(lat),
    start:compact, end:compact, format:'JSON', 'time-standard':'UTC' })
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),12_000)
  try {
    const response=await fetchImpl(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`, {signal:controller.signal})
    if (!response.ok) throw new ForecastError('weather_unavailable', `NASA POWER HTTP ${response.status}`)
    return parsePower(await response.json(),weatherDate)
  } catch(e) {
    if (e instanceof ForecastError) throw e
    throw new ForecastError('weather_unavailable','NASA POWER unavailable or timed out')
  } finally { clearTimeout(timer) }
}

// ---- Fire Guardian additions: whole pilot grid in one go + relative levels ----

/**
 * Relative levels on the model's own scale (index = score × 100). Thresholds follow the
 * calibration bins in pipeline/ai/results/metrics.json. `observed2025` is how often cell-days in
 * that band actually had a retained VIIRS detection in the 2025 retrospective test — the honest
 * uncertainty statement for each level (Low 63/7396, Elevated 80/2818, High 28/371).
 */
export const LEVELS = [
  { id: 'low', label: 'Low', min: 0, observed2025: 63 / 7396 },
  { id: 'elevated', label: 'Elevated', min: 1, observed2025: 80 / 2818 },
  { id: 'high', label: 'High', min: 5, observed2025: 28 / 371 },
]
export function levelOf(index) {
  return [...LEVELS].reverse().find((l) => index >= l.min) ?? LEVELS[0]
}

/**
 * NASA POWER weather for all 29 trained cells for one UTC day. The regional endpoint accepts one
 * parameter per request, so this makes 5 requests instead of 29 point requests. Its 0.5° × 0.625°
 * grid nodes coincide with the model's cell centres.
 */
export async function requestPowerGrid(weatherDate, fetchImpl = fetch) {
  const compact = weatherDate.replaceAll('-', '')
  dateParts(weatherDate)
  const lats = MODEL.locations.map((l) => l[0]), lons = MODEL.locations.map((l) => l[1])
  const box = { 'latitude-min': Math.min(...lats), 'latitude-max': Math.max(...lats), 'longitude-min': Math.min(...lons), 'longitude-max': Math.max(...lons) }
  const out = new Map(MODEL.locations.map(([a, b]) => [`${a},${b}`, {}]))
  await Promise.all(PARAMS.map(async (name) => {
    const params = new URLSearchParams({ parameters: name, community: 'AG', ...Object.fromEntries(Object.entries(box).map(([k, v]) => [k, String(v)])),
      start: compact, end: compact, format: 'JSON', 'time-standard': 'UTC' })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetchImpl(`https://power.larc.nasa.gov/api/temporal/daily/regional?${params}`, { signal: controller.signal })
      if (!response.ok) throw new ForecastError('weather_unavailable', `NASA POWER regional HTTP ${response.status}`)
      const body = await response.json()
      for (const f of body?.features ?? []) {
        const [lon, lat] = f.geometry.coordinates
        const cell = out.get(`${lat},${lon}`)
        const value = f.properties?.parameter?.[name]?.[compact]
        if (cell && typeof value === 'number' && Number.isFinite(value) && value > -900) cell[name] = value
      }
    } catch (e) {
      if (e instanceof ForecastError) throw e
      throw new ForecastError('weather_unavailable', 'NASA POWER regional unavailable or timed out')
    } finally { clearTimeout(timer) }
  }))
  return out
}
