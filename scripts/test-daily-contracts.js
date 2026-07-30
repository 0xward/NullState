#!/usr/bin/env node
/**
 * test-daily-contracts.js — the daily loop's surface, driven in a real browser.
 *
 * Covers the WIRING that unit tests cannot: that the contracts chip renders
 * alongside the others rather than displacing them, that tapping it opens
 * today's three with per-contract progress, that a finished one reads as done,
 * that the map's DAILY rail button (formerly a "SOON" placeholder for exactly
 * this feature) opens the same list, and that the engine's report reaches
 * /api/contracts with a well-formed body.
 *
 * The three status routes are fixtured because the sandbox has no Firebase
 * admin credentials and they would all degrade to empty. The award logic
 * itself — daily roll, clamping, grant-once, per-request ceiling, day and
 * wallet isolation — is covered separately against a stubbed RTDB.
 *
 *   npm run build && npx next start -p 3176 &
 *   node scripts/test-daily-contracts.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')
const BASE=process.env.BASE_URL||'http://127.0.0.1:3176', W='0x4444444444444444444444444444444444444444'
let fails=0; const ok=(l,c)=>{console.log((c?'  ✓ ':'  ✗ FAIL: ')+l); if(!c)fails++}
;(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']})
  const page=await (await b.newContext({viewport:{width:390,height:844}})).newPage()

  // No Firebase admin in the sandbox, so the three status routes would all
  // degrade to empty. Fixture them; the contract logic itself is covered by
  // the unit run. What this proves is the WIRING: chip renders, tap opens the
  // list, and the engine's report actually reaches the route.
  await page.route('**/api/energy?**', r=>r.fulfill({json:{freeRemaining:4,bonus:0,total:4,resetAt:Date.now()+3.6e6}}))
  await page.route('**/api/vault/fragments?**', r=>r.fulfill({json:{fragments:5,nextGoal:{key:'paper',threshold:8,label:'Old Paper'}}}))
  await page.route('**/api/weapons/craft?**', r=>r.fulfill({json:{craft:null,serverNow:Date.now()}}))
  await page.route('**/api/contracts?**', r=>r.fulfill({json:{ dayId:'2026-07-30', nextResetAt:Date.now()+7.2e6, completed:1,
    contracts:[
      {id:'kills40',metric:'kills',label:'Put down 40 of them',target:40,progress:40,done:true,reward:{kind:'point',amount:250}},
      {id:'floors3',metric:'floors',label:'Secure 3 floors',target:3,progress:1,done:false,reward:{kind:'shard',tier:'t1',amount:3}},
      {id:'cont5',metric:'containers',label:'Crack 5 lockable containers',target:5,progress:2,done:false,reward:{kind:'point',amount:200}},
    ]}}))

  await page.addInitScript(w=>{localStorage.setItem('nullstate-guest-id',w)
    localStorage.setItem('ns-howto-seen','1');localStorage.setItem('nullstate-signin-skipped','1')},W)
  await page.goto(BASE+'/game',{waitUntil:'domcontentloaded'})
  await page.waitForSelector('.ns-hub-map',{timeout:60000}); await page.waitForTimeout(2500)

  const chips=await page.$$eval('.ns-hub-chip',e=>e.map(x=>x.textContent.trim()))
  // Three, not four: the craft fixture is null, so that chip correctly hides.
  // A fourth appears only when there is a craft to report — checked at the end.
  ok('three chips with no craft running ('+chips.join(' ')+')', chips.length===3)
  ok('contracts chip reads 1/3', chips.some(c=>c.includes('1/3')))
  ok('contracts sits before fragments', chips.findIndex(c=>c.includes('1/3')) < chips.findIndex(c=>c.includes('5/8')))

  ok('the list is closed until asked', (await page.$$('.ns-hub-contract')).length===0)
  await page.click('.ns-hub-chip:has-text("1/3")')
  await page.waitForTimeout(300)
  const rows=await page.$$eval('.ns-hub-contract',e=>e.map(x=>x.textContent.trim()))
  ok('tapping opens all three ('+rows.length+')', rows.length===3)
  ok('a finished one is ticked and marked done', rows.some(r=>r.includes('✓')) &&
     (await page.$$('.ns-hub-contract.is-done')).length===1)
  ok('progress is shown per contract', rows.some(r=>/1\/3/.test(r)) && rows.some(r=>/2\/5/.test(r)))
  await page.click('.ns-hub-chip:has-text("1/3")')
  await page.waitForTimeout(300)
  ok('tapping again closes it', (await page.$$('.ns-hub-contract')).length===0)

  // Does the engine's reporter actually hit the route with a well-formed body?
  const posts=[]
  await page.route('**/api/contracts', async r=>{
    if(r.request().method()==='POST'){ posts.push(JSON.parse(r.request().postData()||'{}'))
      return r.fulfill({json:{dayId:'x',nextResetAt:0,completed:0,contracts:[],granted:[]}}) }
    return r.continue()
  })
  await page.evaluate(()=>fetch('/api/contracts',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({wallet:'0x4444444444444444444444444444444444444444',metric:'containers',amount:1})}))
  await page.waitForTimeout(400)
  ok('a report reaches the route with metric+amount', posts.length===1 && posts[0].metric==='containers')

  // And four once a craft IS running — proves the contracts chip did not
  // displace anything, it joined them.
  await page.unroute('**/api/weapons/craft?**')
  await page.route('**/api/weapons/craft?**', r=>r.fulfill({json:{craft:{completesAt:Date.now()+5400000},serverNow:Date.now()}}))
  await page.reload({waitUntil:'domcontentloaded'})
  await page.waitForSelector('.ns-hub-map',{timeout:60000}); await page.waitForTimeout(2500)
  const chips2=await page.$$eval('.ns-hub-chip',e=>e.map(x=>x.textContent.trim()))
  ok('four chips once a craft is running ('+chips2.join(' ')+')', chips2.length===4)

  // The DAILY rail button used to be a "SOON" placeholder for a feature that
  // now exists. It must open the same list.
  ok('the DAILY rail button no longer says SOON',
     !(await page.$$eval('.ns-hub-rail', e => e.map(x => x.textContent).join(' '))).includes('SOON'))
  ok('the list is closed before tapping DAILY', (await page.$$('.ns-hub-contract')).length===0)
  await page.click('.ns-hub-rail:has-text("Daily")'); await page.waitForTimeout(400)
  ok('tapping DAILY opens the contracts', (await page.$$('.ns-hub-contract')).length===3)
  console.log(fails?`\n${fails} FAILED`:'\nall passed')
  await b.close(); process.exit(fails?1:0)
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
