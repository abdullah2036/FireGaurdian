import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as nodeModule from 'node:module'

const ROOT = path.resolve(process.env.SAFIRE_ROOT ?? '../SAFIRE')
const core = await import(pathToFileURL(path.join(ROOT,'api/lib/ai-predict.js')).href)
const refs = JSON.parse(await readFile(new URL('./results/reference_examples.json',import.meta.url)))
for (const row of refs) assert.ok(Math.abs(core.predict(row)-row.expected_score)<1e-12)
assert.deepEqual(core.forecastDates(new Date('2026-11-14T20:59:59Z')),{
  todaySaudi:'2026-11-14',targetUTC:'2026-11-15',weatherUTC:'2026-11-12',
  targetStartSaudi:'2026-11-15 03:00',targetEndSaudi:'2026-11-16 03:00',
})
assert.equal(core.forecastDates(new Date('2026-11-14T21:00:00Z')).targetUTC,'2026-11-16')
assert.equal(core.plusDays('2024-02-28',1),'2024-02-29')
assert.throws(()=>core.plusDays('2025-02-29',1))
assert.deepEqual(core.modelCell(18.52,42.51),{lat:18.5,lon:42.5})
assert.equal(core.modelCell(24.7,46.7),null)
assert.throws(()=>core.predict({...refs[0], RH2M: null}))
assert.throws(()=>core.predict({...refs[0], target_date_utc:'2025-12-31'}))
assert.throws(()=>core.parsePower({properties:{parameter:{}}},'2026-11-12'))

// Fixture transcribed from the actual NASA POWER response checked on 14 November 2026.
const values={T2M:20.31,T2M_MAX:27.49,RH2M:59.96,WS10M:2.96,PRECTOTCORR:2.03}
const body={properties:{parameter:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{'20261112':v}]))}}
const parsed=core.parsePower(body,'2026-11-12')
assert.deepEqual(parsed,values)
const score=core.predict({LAT:18.5,LON:42.5,date_utc:'2026-11-12',target_date_utc:'2026-11-15',...values})
assert.ok(Number.isFinite(score) && score>=0 && score<=1)
// The website's initial Al Baha focus maps to the supported (20, 41.25) centre.
assert.deepEqual(core.modelCell(20.01,41.47),{lat:20,lon:41.25})
const defaultScore=core.predict({LAT:20,LON:41.25,date_utc:'2026-11-12',target_date_utc:'2026-11-15',
  T2M:24.39,T2M_MAX:30.65,RH2M:56.68,WS10M:2.22,PRECTOTCORR:1.41})
assert.ok(Number.isFinite(defaultScore) && defaultScore>=0 && defaultScore<=1)
let urlSeen=''
assert.deepEqual(await core.requestPower(18.5,42.5,'2026-11-12',async (url)=>{
  urlSeen=String(url); return {ok:true,json:async()=>body}
}),values)
const url=new URL(urlSeen)
assert.equal(url.hostname,'power.larc.nasa.gov')
assert.equal(url.searchParams.get('start'),'20261112')
assert.equal(url.searchParams.get('end'),'20261112')
assert.equal(url.searchParams.get('time-standard'),'UTC')
await assert.rejects(core.requestPower(18.5,42.5,'2026-11-12',async()=>({ok:false,status:503})))
await assert.rejects(core.requestPower(18.5,42.5,'2026-11-12',async()=>({ok:true,json:async()=>({})})))

// On Node 23+, run the real handler with TypeScript annotations stripped in an isolated temp directory.
if (typeof nodeModule.stripTypeScriptTypes !== 'function') {
  console.log(`PASS: ${refs.length} Python/JS comparisons and core NASA/weather checks. Handler test needs Node 23+.`)
  process.exit(0)
}
const tmp=await mkdtemp(path.join(tmpdir(),'safire-ai-test-'))
await mkdir(path.join(tmp,'handlers'),{recursive:true})
await mkdir(path.join(tmp,'lib'),{recursive:true})
await mkdir(path.join(tmp,'data'),{recursive:true})
await writeFile(path.join(tmp,'package.json'),'{"type":"module"}')
for(const [source,target] of [['api/lib/http.ts','lib/http.js'],['api/handlers/ai-predict.ts','handlers/ai-predict.js']]) {
  const ts=await readFile(path.join(ROOT,source),'utf8')
  await writeFile(path.join(tmp,target),nodeModule.stripTypeScriptTypes(ts,{mode:'strip'}))
}
await copyFile(path.join(ROOT,'api/lib/ai-predict.js'),path.join(tmp,'lib/ai-predict.js'))
await copyFile(path.join(ROOT,'api/data/ai-model.js'),path.join(tmp,'data/ai-model.js'))
const {default:handler}=await import(pathToFileURL(path.join(tmp,'handlers/ai-predict.js')).href)
const RealDate=globalThis.Date, realFetch=globalThis.fetch
class FrozenDate extends RealDate { constructor(...args) { super(...(args.length?args:['2026-11-14T16:15:00Z'])) } static now(){ return new RealDate('2026-11-14T16:15:00Z').getTime() } }
globalThis.Date=FrozenDate
globalThis.fetch=async()=>({ok:true,json:async()=>body})
function response(){return {code:0,headers:{},body:null,status(c){this.code=c;return this},setHeader(k,v){this.headers[k]=v},send(s){this.body=JSON.parse(s)}}}
try {
  let res=response(); await handler({query:{lat:'18.5',lon:'42.5'}},res)
  assert.equal(res.code,200); assert.equal(res.body.status,'experimental'); assert.equal(res.body.isMock,false)
  assert.equal(res.body.weatherDateUTC,'2026-11-12'); assert.equal(res.body.targetDateUTC,'2026-11-15')
  assert.ok(Math.abs(res.body.scoreIndex-score*100)<1e-12)
  res=response(); await handler({query:{lat:'24.7',lon:'46.7'}},res); assert.equal(res.code,422);assert.equal(res.body.code,'outside_coverage')
  res=response(); await handler({query:{lat:'',lon:'42.5'}},res); assert.equal(res.code,400)
  globalThis.fetch=async()=>({ok:true,json:async()=>({})})
  res=response(); await handler({query:{lat:'18',lon:'42.5'}},res);assert.equal(res.code,503);assert.equal(res.body.code,'weather_unavailable');assert.equal(res.body.scoreIndex,undefined)
} finally {globalThis.Date=RealDate;globalThis.fetch=realFetch}
console.log(`PASS: ${refs.length} Python/JS comparisons; timezone and grid checks; actual NASA fixture; handler success and fail-closed paths.`)
console.log(`NASA fixture research score: ${(score*100).toFixed(3)} / 100 (not a wildfire probability).`)
