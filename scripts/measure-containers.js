#!/usr/bin/env node
/**
 * measure-containers.js — how many fragment-earning containers a bunker holds.
 *
 * WHY THIS EXISTS. The Vault Fragment thresholds (lib/server/vault-fragments.ts)
 * are a balance decision resting on one number: how many interactive containers
 * a player can actually open in a bunker. That number was first ESTIMATED by
 * reading spawnDecorInto (max 5 props per room, 12% rare, northOnly types
 * falling back to tables on side walls) and put at 8-15. Measured, it is ~6.3 —
 * between 1.3x and 2.4x lower, which made the Golden Key threshold unreachable
 * for anyone not playing daily. See the decision log in docs/GAME-DESIGN.md.
 *
 * Re-run this whenever props.js gains or loses an interactive container type,
 * or spawnDecorInto's density changes. Both silently move the reward curve.
 *
 * HOW IT MEASURES RATHER THAN REIMPLEMENTS. It builds a throwaway page carrying
 * every DOM id DungeonGame.tsx renders (read out of that file, so it cannot
 * drift), loads the 14 real engine scripts into it, and mounts the engine with
 * a saved session pinned to each depth. newGame() -> descend(depth) ->
 * ensureFloor() is the same path a player takes; nothing here copies the
 * generator's logic.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/measure-containers.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const fs=require('fs'), path=require('path')
const { chromium } = require('playwright-core')
const BASE=process.env.BASE_URL||'http://127.0.0.1:3180'
const HARNESS='__measure-tmp'

// Build the harness from DungeonGame.tsx's own ids so it can never drift from
// the markup the engine actually queries.
function writeHarness(){
  const tsx = fs.readFileSync(path.join(__dirname,'..','components','game','DungeonGame.tsx'),'utf8')
  const ids = [...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m=>m[1]))].sort()
  const special = { game:'<canvas id="game"></canvas>', vaultCodeInput:'<input id="vaultCodeInput" />' }
  const scripts = ['audio.js','assets.js','story.js','story_campaign.js','dungeon.js','items.js',
    'marketplace-items.js','props.js','monster-config.js','effects.js','entities.js','outdoor.js',
    'run-session.js','game.js']
  const dir = path.join(__dirname,'..','public',HARNESS)
  fs.mkdirSync(dir,{recursive:true})
  fs.writeFileSync(path.join(dir,'index.html'),
    '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}.hidden{display:none}</style>'
    + '<div class="ns-game-root">' + ids.map(i=>special[i]||`<div id="${i}"></div>`).join('') + '</div>'
    + scripts.map(s=>`<script src="/game-engine/${s}"></script>`).join(''))
  return ids.length
}
function cleanHarness(){
  try{ fs.rmSync(path.join(__dirname,'..','public',HARNESS),{recursive:true,force:true}) }catch{}
}

;(async()=>{
  const nIds = writeHarness()
  console.log('harness: ' + nIds + ' ids dari DungeonGame.tsx')
  try{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']})
  const page=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
  const errs=[]; page.on('pageerror',e=>errs.push(e.message.slice(0,140)))
  await page.goto(BASE+'/'+HARNESS+'/index.html',{waitUntil:'load'})
  const ok=await page.evaluate(()=>!!(window.NullStateGame&&window.NS_DUNGEON&&window.NS_PROPS&&window.__NS))
  console.log('engine termuat:', ok, errs.length?('| errors: '+errs.slice(0,2).join(' ; ')):'')
  if(!ok){ await b.close(); process.exit(1) }

  const REPS = 40
  const rows = await page.evaluate(async (reps) => {
    const sleep=ms=>new Promise(r=>setTimeout(r,ms))
    const out=[]
    window.NullStateGame.mount({ startMode:null, worldMapHub:true })
    await sleep(1500)
    for(let depth=1; depth<=5; depth++){
      for(let i=0;i<reps;i++){
        window.NullStateGame.unmount(); await sleep(30)
        window.NullStateGame.mount({
          startMode:'continue', worldMapHub:true, walletAddress:null,
          energy:{ trySpend:async()=>({ok:true}), onExhausted(){} },
          savedSession:{ charKey:'knight', campaignActIndex:0, depth, maxDepthReached:depth,
            xp:0, level:1, kills:0, hp:100,
            inventory:{keys:0,relics:0,shards:0,items:{}},
            goldenKeysRemaining:1, paperRemaining:1, savedAt:Date.now() },
        })
        let g=null
        for(let t=0;t<200 && !(g&&g.decor&&g.decor.length); t++){ await sleep(50); g=window.__NS&&window.__NS.G }
        if(!g||!g.decor){ out.push({depth,err:1}); continue }
        const inter=g.decor.filter(d=>d.interactive && !d.def.isVaultDoor
                      && !d.def.isSealedCache && !d.def.isPremiumCache)
        out.push({ depth:g.depth, interactive:inter.length, allDecor:g.decor.length,
                   rooms:g.dun?g.dun.rooms.length:0 })
      }
    }
    return out
  }, REPS)

  const bad=rows.filter(r=>r.err).length
  if(bad) console.log('gagal:',bad,'dari',rows.length)
  const by={}; rows.filter(r=>!r.err).forEach(r=>{(by[r.depth]=by[r.depth]||[]).push(r.interactive)})
  console.log('\n  lantai | sebaran peti ber-OPEN')
  let sum=0
  for(const d of Object.keys(by).sort()){
    const v=by[d].slice().sort((a,c)=>a-c), avg=v.reduce((a,c)=>a+c,0)/v.length
    sum+=avg
    const med=v[Math.floor(v.length/2)]; console.log('    '+d+'    | n='+v.length+'  min-max '+v[0]+'-'+v[v.length-1]+'  median '+med+'  rata2 '+avg.toFixed(2))
  }
  console.log('\n  ► SATU BUNKER (5 lantai, semua peti dibuka): '+sum.toFixed(1)+' peti ber-OPEN')
  console.log('  ► ambang saat ini: Paper 12, Golden Key 28')
  console.log('  ► artinya: Paper ≈ '+(12/sum).toFixed(2)+' bunker, Key ≈ '+(28/sum).toFixed(2)+' bunker')
  await b.close()
  } finally { cleanHarness() }
})().catch(e=>{cleanHarness();console.error('ERROR',e.message);process.exit(1)})
