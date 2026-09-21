import fs from 'node:fs';
import {chromium} from '@playwright/test';

const base=process.env.SMARTCROSS_VERIFY_URL||'http://127.0.0.1:3101';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).flatMap(line=>{const match=line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);return match?[[match[1],match[2].replace(/^(['"])(.*)\1$/,'$2')]]:[];}));
const browser=await chromium.launch();
try {
  const context=await browser.newContext({viewport:{width:1400,height:1000}});
  const login=await context.request.post(base+'/api/login',{data:{id:env.DEMO_ACCESS_ID,password:env.DEMO_ACCESS_PASSWORD}});
  if(!login.ok()) throw new Error(`Configured login failed (${login.status()})`);
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/');await page.getByLabel('Simulation sequence',{exact:true}).selectOption('heavy');await page.clock.install();
  await page.getByRole('button',{name:'Start Heavy Traffic Simulation'}).click();await page.getByRole('button',{name:'Pedestrian request',exact:true}).click();
  const timer=page.getByRole('timer').first();const eb=page.getByRole('img',{name:/Eastbound traffic light/});const wb=page.getByRole('img',{name:/Westbound traffic light/});
  fs.mkdirSync('tmp/timer-verification',{recursive:true});
  await page.clock.runFor(20000);if(!/Waiting Time, 0 seconds/.test(await timer.getAttribute('aria-label')||''))throw new Error('WAIT did not visibly reach zero');await page.screenshot({path:'tmp/timer-verification/wait-zero.png',fullPage:true});
  await page.clock.runFor(1000);if(!/Safe Signal Transition, 3 seconds/.test(await timer.getAttribute('aria-label')||'')||!await eb.getAttribute('aria-label').then(v=>v?.endsWith('AMBER')))throw new Error('Amber transition was not synchronized');await page.screenshot({path:'tmp/timer-verification/amber-transition.png',fullPage:true});
  await page.clock.runFor(7000);if(!/Walking Time, 15 seconds/.test(await timer.getAttribute('aria-label')||''))throw new Error('WALK did not start at 15');if(!await eb.getAttribute('aria-label').then(v=>v?.endsWith('STOP'))||!await wb.getAttribute('aria-label').then(v=>v?.endsWith('STOP')))throw new Error('Vehicle signals were not STOP for WALK');await page.screenshot({path:'tmp/timer-verification/walk-fifteen.png',fullPage:true});
  await page.clock.runFor(14000);const nearEnd=await timer.getAttribute('aria-label')||'';if(!/Walking Time, [01] seconds/.test(nearEnd))throw new Error(`WALK did not reach its final second (${nearEnd})`);
  if(/Walking Time, 1 seconds/.test(nearEnd))await page.clock.runFor(1000);
  if(!/Walking Time, 0 seconds/.test(await timer.getAttribute('aria-label')||''))throw new Error(`WALK did not visibly reach zero (${await timer.getAttribute('aria-label')})`);
  await page.clock.runFor(1000);if(!/Safe Signal Transition/.test(await timer.getAttribute('aria-label')||'')||!await eb.getAttribute('aria-label').then(v=>v?.endsWith('STOP')))throw new Error('Post-WALK clearance was not protected');
  if(errors.length)throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('PASS WAIT 20..0, amber/all-red transition, WALK 15..0, protected clearance and synchronized signals');
} finally {await browser.close();}
