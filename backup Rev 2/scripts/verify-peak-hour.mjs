import fs from 'node:fs';
import {chromium} from '@playwright/test';
const base=process.env.SMARTCROSS_VERIFY_URL||'http://127.0.0.1:3100';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[];}));
const browser=await chromium.launch();
try {
 const context=await browser.newContext();
 const gate=await context.request.get(base+'/',{maxRedirects:0});if(gate.status()!==307)throw Error('Anonymous gate failed');
 const login=await context.request.post(base+'/api/login',{data:{id:env.DEMO_ACCESS_ID,password:env.DEMO_ACCESS_PASSWORD}});if(!login.ok())throw Error('Configured login failed');
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/');
 const apiStatus=await page.evaluate(async()=>{const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'normal',scenarioId:'normal-no-violation'})});return r.status;});if(apiStatus!==200)throw Error(`Authenticated baseline API failed (${apiStatus})`);
 await page.getByLabel('Simulation sequence',{exact:true}).selectOption('heavy');await page.clock.install();
 await page.getByLabel('Peak preset').selectOption('Heavy Peak');await page.getByRole('button',{name:'Start Heavy Traffic Simulation'}).click();await page.clock.runFor(420000);
 if(!(await page.locator('.ht-summary').textContent()).includes('NORMAL / STABLE'))throw Error('Stable recovery failed');
 if(errors.length)throw Error(errors.join('; '));console.log('PASS protected login, peak-hour playback, stable recovery, no page errors');
} finally {await browser.close();}
