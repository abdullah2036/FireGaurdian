// Run with Node >=22.18 from the repo root. No npm packages required.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'

const repo=process.cwd(), dir=await mkdtemp(join(tmpdir(),'heat-co-test-'))
try {
  await writeFile(join(dir,'package.json'),'{"type":"module"}')
  for (const file of ['api/lib/geo.ts','api/lib/http.ts','api/lib/heat.ts','api/lib/air.ts','api/handlers/firms.ts','api/lib/classify.ts','api/data/heat_model.ts','api/data/industrial_sites.ts','api/data/training_cells.ts']) {
    const out=join(dir,file.replace(/\.ts$/,'.js'))
    await mkdir(dirname(out),{recursive:true})
    await writeFile(out,stripTypeScriptTypes(await readFile(resolve(repo,file),'utf8'),{mode:'strip'}))
  }
  for (const file of ['api/data/static_cells.js','api/data/ksa.js','api/data/gihs.js','api/data/nasa_static_cells.js','api/data/osm_sites.js']) await copyFile(resolve(repo,file),join(dir,file))
  const {assessHeat,thermalIndex,nearestFacilities,gridKey}=await import(pathToFileURL(join(dir,'api/lib/heat.js')))
  const {airForDetections,airForDetection}=await import(pathToFileURL(join(dir,'api/lib/air.js')))
  const {inKSA,heatMapEvidence,staticReason}=await import(pathToFileURL(join(dir,'api/lib/geo.js')))
  const {default:models}=await import(pathToFileURL(join(dir,'api/data/heat_model.js')))
  const {default:catalog}=await import(pathToFileURL(join(dir,'api/data/industrial_sites.js')))
  const {default:gihs}=await import(pathToFileURL(join(dir,'api/data/gihs.js')))
  const {default:handler}=await import(pathToFileURL(join(dir,'api/handlers/firms.js')))
  const fixtures=JSON.parse(await readFile(resolve(repo,'pipeline/heat-source/test-co-fixtures.json'),'utf8'))
  const catalogCSV=(await readFile(resolve(repo,'pipeline/heat-source/industrial_sites.csv'),'utf8')).trim().split('\n').slice(1)
  assert.equal(catalog.length,157)
  assert.equal(catalog.length,catalogCSV.length)
  for (let i=0;i<catalog.length;i++) {
    const [id,lat,lon,type,name]=catalogCSV[i].split(',')
    assert.equal(catalog[i].id,id);assert.equal(catalog[i].lat,Number(lat));assert.equal(catalog[i].lon,Number(lon))
    assert.equal(catalog[i].name,name);assert.equal(catalog[i].type,type)
  }
  assert.equal(fixtures.length,12)
  const baseNames=['brightness','bright_t31','channelDelta','logFrp','scan','track','night','confLow','confHigh','logDistance']
  for(const f of fixtures) {
    const values=baseNames.map(k=>f.features[k])
    assert.ok(Math.abs(thermalIndex([...values,f.features.co,f.features.coDelta],models.withCO)-f.expectedStaticProbability)<1e-12,'with-CO JavaScript output differs from Python')
    assert.ok(Math.abs(thermalIndex(values,models.withoutCO)-f.expectedStaticProbabilityNoCO)<1e-12,'no-CO JavaScript output differs from Python')
  }
  const empty={industrialMap:false,persistentFine:false,persistentCoarse:false}
  const site=nearestFacilities(26.70243,50.09207)[0]
  assert.equal(site.name,'Saudi Aramco Ras Tanura Refinery')
  assert.ok(site.distanceKm<.001)
  const inputs={lat:26.70243,lon:50.09207,source:'VIIRS_SNPP_NRT',brightK:343.63,brightI5K:303.53,frp:1.72,scan:.43,track:.46,daynight:'D',conf:'n',static:null,reportedType:null}
  const h=assessHeat(inputs,empty,{value:200,previous72:180})
  assert.ok(h.staticIndex>0&&h.staticIndex<1)
  assert.ok(Math.abs(h.staticIndex+h.vegetationIndex-1)<1e-12)
  assert.equal(h.usedCO,true)
  assert.equal(h.nearbyFacilities[0].name,site.name)
  assert.ok(h.nearbyFacilities.length>=2,'Return multiple nearby facilities instead of falsely naming one as the source')
  assert.ok(h.nearbyFacilities.every(f=>f.distanceKm<=5))
  assert.equal(assessHeat({...inputs,source:'VIIRS_NOAA20_NRT'},empty).modelStatus,'sensor_transfer_unvalidated')
  assert.equal(assessHeat({...inputs,source:'MODIS_NRT'},empty).staticIndex,null)
  assert.equal(assessHeat({...inputs,brightI5K:null},empty).staticIndex,null)
  assert.equal(assessHeat({...inputs,reportedType:1},{...empty,industrialMap:true}).category,'volcano_candidate')
  assert.equal(assessHeat({...inputs,reportedType:3},empty).category,'offshore_detection')
  assert.equal(assessHeat(inputs,{...empty,industrialMap:true}).category,'industrial_map_candidate')
  assert.equal(assessHeat(inputs,{...empty,persistentFine:true}).category,'persistent_candidate')
  assert.equal(assessHeat({...inputs,static:'night-persistent-live'},empty).livePersistence,true)
  assert.equal(assessHeat(inputs,empty,null).usedCO,false)

  let mapped
  const polygons=gihs.type==='Polygon'?[gihs.coordinates]:gihs.coordinates
  for(const polygon of polygons){const ring=polygon[0],lon=ring.reduce((s,x)=>s+x[0],0)/ring.length,lat=ring.reduce((s,x)=>s+x[1],0)/ring.length;if(inKSA(lon,lat)&&heatMapEvidence(lat,lon).industrialMap){mapped=[lat,lon];break}}
  assert.ok(mapped,'GIHS polygons must be usable')
  let outside
  for(let lat=18;lat<31&&!outside;lat+=.5) for(let lon=37;lon<54;lon+=.5){const ev=heatMapEvidence(lat,lon);if(inKSA(lon,lat)&&!ev.industrialMap&&!ev.persistentFine&&!ev.persistentCoarse&&!staticReason(lat,lon)){outside=[lat,lon];break}}
  assert.ok(outside)
  const csv=['latitude,longitude,acq_date,acq_time,satellite,confidence,frp,bright_ti4,bright_ti5,scan,track,daynight',
    `${mapped[0]},${mapped[1]},2026-11-14,0912,N20,n,1.72,343.63,303.53,.43,.46,D`,
    `${outside[0]},${outside[1]},2026-11-14,0912,N20,n,1.72,343.63,303.53,.43,.46,D`].join('\n')
  const originalFetch=globalThis.fetch
  globalThis.fetch=async(input)=>{
    const u=new URL(String(input))
    if(u.hostname==='firms.modaps.eosdis.nasa.gov') return new Response(csv,{status:200})
    if(u.hostname==='air-quality-api.open-meteo.com'){
      const lat=u.searchParams.get('latitude').split(',')
      const times=Array.from({length:120},(_,i)=>new Date(Date.parse('2026-11-10T00:00:00Z')+i*3600000).toISOString().slice(0,16))
      const payload=lat.map(()=>({hourly:{time:times,carbon_monoxide:times.map((_,i)=>i===105?215:200)}}))
      return new Response(JSON.stringify(payload.length===1?payload[0]:payload),{status:200,headers:{'Content-Type':'application/json'}})
    }
    throw new Error('Unexpected fetch '+u.hostname)
  }
  const co=await airForDetections([{...inputs,date:'2026-11-14',time:'0912'}])
  assert.equal(airForDetection({...inputs,date:'2026-11-14',time:'0912'},co).value,215)
  process.env.FIRMS_MAP_KEY='fake-test-key'
  const res={code:0,body:'',status(c){this.code=c;return this},setHeader(){},send(v){this.body=v}}
  await handler({query:{source:'VIIRS_NOAA20_NRT',days:'1'}},res)
  const data=JSON.parse(res.body)
  assert.equal(res.code,200);assert.equal(data.mock,false);assert.equal(data.detections.length,2)
  const a=data.detections[0],b=data.detections[1]
  assert.equal(a.heat.map.industrialMap,true);assert.equal(a.heat.modelStatus,'sensor_transfer_unvalidated')
  // Fire Guardian integration: `static` now follows the validated heat-source class (api/lib/classify.ts),
  // and the live API runs the no-CO model because CO did not improve it (80.3 % vs 80.9 %).
  assert.ok(b.cls && ['fire','industrial','offshore','uncertain'].includes(b.cls.category))
  assert.equal(b.static === null, !['industrial','offshore'].includes(b.cls.category))
  assert.equal(b.heat.usedCO,false);assert.equal(b.heat.coMicrogramsM3,null)
  assert.equal(b.heat.brightI5K,303.53)
  assert.ok(Math.abs(b.heat.channelDifferenceK-(343.63-303.53))<1e-9)
  delete process.env.FIRMS_MAP_KEY
  await handler({query:{source:'VIIRS_NOAA21_NRT',days:'1'}},res)
  const fake=JSON.parse(res.body)
  assert.equal(fake.mock,true);assert.ok(fake.detections.every(d=>d.heat.staticIndex===null))
  globalThis.fetch=async()=>new Response('service unavailable',{status:503})
  const missing=await airForDetections([{...inputs,lat:29.987,lon:38.412,date:'2026-11-14',time:'0912'}])
  assert.equal(missing.size,0)
  assert.ok(assessHeat(inputs,empty,null).staticIndex!==null,'Use the independently trained no-CO fallback when CO fails')
  globalThis.fetch=originalFetch
  console.log('PASS: Python/JS parity (12 real samples, both models), facility lookup, CO alignment, GIHS geometry, sensor and missing-data handling, API and mock fallback.')
}finally{await rm(dir,{recursive:true,force:true})}
