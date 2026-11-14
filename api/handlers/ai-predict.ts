// GET /api/ai-predict?lat=<model-grid-center>&lon=<model-grid-center>
// GET /api/ai-predict?grid=1   — all 29 trained cells at once (Fire Guardian map layer and AI card)
// NASA POWER data are required. No simulated fallback is used.
import { cached, sendJSON, type Req, type Res } from '../lib/http.js'
import { MODEL, LEVELS, ForecastError, forecastDates, levelOf, modelCell, predict, requestPower, requestPowerGrid } from '../lib/ai-predict.js'

async function grid(res: Res) {
  const now = new Date(), dates = forecastDates(now)
  let weather: Map<string, Record<string, number>>
  try {
    weather = (await cached(`ai-grid:${dates.weatherUTC}`, 1800, () => requestPowerGrid(dates.weatherUTC))).value
  } catch (e) {
    const code = e instanceof ForecastError ? e.code : 'weather_unavailable'
    return sendJSON(res, 503, { code, error: 'No research index: NASA POWER data unavailable.', weatherDateUTC: dates.weatherUTC, targetDateUTC: dates.targetUTC })
  }
  const cells = (MODEL.locations as [number, number][]).map(([lat, lon]) => {
    const w = weather.get(`${lat},${lon}`) ?? {}
    try {
      const scoreIndex = predict({ LAT: lat, LON: lon, date_utc: dates.weatherUTC, target_date_utc: dates.targetUTC, ...w }) * 100
      return { lat, lon, scoreIndex, level: levelOf(scoreIndex).id, weather: w }
    } catch (e) {
      return { lat, lon, scoreIndex: null, level: null, weather: w, code: e instanceof ForecastError ? e.code : 'error' }
    }
  })
  if (!cells.some((c) => c.scoreIndex != null))
    return sendJSON(res, 503, { code: 'weather_unavailable', error: 'No research index: NASA data missing or outside model range for every cell.', weatherDateUTC: dates.weatherUTC, targetDateUTC: dates.targetUTC })
  return sendJSON(res, 200, {
    status: 'experimental', generatedAt: now.toISOString(), modelVersion: MODEL.version,
    weatherDateUTC: dates.weatherUTC, targetDateUTC: dates.targetUTC,
    targetStartSaudi: dates.targetStartSaudi, targetEndSaudi: dates.targetEndSaudi,
    cellSize: { lat: 0.5, lon: 0.625 }, levels: LEVELS, cells, source: 'NASA POWER', isMock: false,
    limitation: 'Satellite-detection index only; not a verified wildfire probability or an emergency warning.',
  }, 1800)
}

export default async function handler(req: Req, res: Res) {
  if (req.query.grid === '1') return grid(res)
  const latRaw = req.query.lat, lonRaw = req.query.lon
  if (typeof latRaw !== 'string' || typeof lonRaw !== 'string' || !latRaw.trim() || !lonRaw.trim())
    return sendJSON(res, 400, { code:'invalid_location', error:'lat and lon are required' })
  const lat=Number(latRaw), lon=Number(lonRaw)
  const cell=modelCell(lat,lon)
  // The client chooses and displays a trained grid centre; never silently claim other locations.
  if (!cell || cell.lat !== lat || cell.lon !== lon)
    return sendJSON(res, 422, { code:'outside_coverage', error:'Only the 29 trained grid centres are supported' })
  const now=new Date(), dates=forecastDates(now)
  try {
    const weather=(await cached(`ai:${cell.lat}:${cell.lon}:${dates.weatherUTC}`,1800,
      () => requestPower(cell.lat,cell.lon,dates.weatherUTC))).value
    const score=predict({LAT:lat,LON:lon,date_utc:dates.weatherUTC,target_date_utc:dates.targetUTC,...weather})
    return sendJSON(res,200,{
      status:'experimental', generatedAt:now.toISOString(), modelVersion:MODEL.version,
      scoreIndex:score*100, // Research index out of 100; NOT a calibrated probability of ignition.
      cell, weatherDateUTC:dates.weatherUTC, targetDateUTC:dates.targetUTC,
      targetStartSaudi:dates.targetStartSaudi, targetEndSaudi:dates.targetEndSaudi,
      source:'NASA POWER', weather, isMock:false,
      limitation:'Satellite-detection index only; not a verified wildfire probability or an emergency warning.',
    })
  } catch(e) {
    const code=e instanceof ForecastError ? e.code : 'weather_unavailable'
    return sendJSON(res,503,{code,error:'No research index: NASA data missing or outside model range.',
      weatherDateUTC:dates.weatherUTC,targetDateUTC:dates.targetUTC})
  }
}
