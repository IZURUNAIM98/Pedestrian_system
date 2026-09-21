import fs from 'node:fs';
import { chromium } from '@playwright/test';

const baseURL = process.env.SMARTCROSS_VERIFY_URL || 'http://127.0.0.1:3100';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).flatMap(line => {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
  return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const gate = await context.request.get(baseURL + '/', { maxRedirects: 0 });
  if (gate.status() !== 307) throw new Error('Anonymous dashboard gate failed');
  const login = await context.request.post(baseURL + '/api/login', {data: {id: env.DEMO_ACCESS_ID, password: env.DEMO_ACCESS_PASSWORD}});
  if (!login.ok()) throw new Error(`Login failed (${login.status()})`);
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', err => errors.push(err.message));
  for (const width of [1400, 1000, 412]) {
    await page.setViewportSize({width, height: 950});
    await page.goto(baseURL + '/');
    for (const mode of ['normal', 'school']) {
      await page.locator('.crossing-mode-tabs button').nth(mode === 'normal' ? 0 : 1).click();
      const scene = page.locator('.road-scene');
      await scene.waitFor();
      const geometry = await scene.evaluate(el => {
        const box = selector => { const b=el.querySelector(selector).getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}; };
        return {a:box('.zone-speed-eastbound'),b:box('.zone-speed-westbound'), road:box('.road-lane')};
      });
      const {a,b,road}=geometry;
      const midX=road.x+road.w/2, midY=road.y+road.h/2;
      if (Math.abs(a.w-b.w)>1 || Math.abs(a.h-b.h)>1 || Math.abs((a.x+a.w/2)+(b.x+b.w/2)-2*midX)>1 || Math.abs((a.y+a.h/2)+(b.y+b.h/2)-2*midY)>1) throw new Error(`Mirror geometry failed: ${mode}/${width} ${JSON.stringify(geometry)}`);
      if (b.y<road.y || b.y+b.h>midY || a.y<midY || a.y+a.h>road.y+road.h) throw new Error(`Zone outside assigned lane: ${mode}/${width}`);
      fs.mkdirSync('tmp/speed-zone-verification', {recursive:true});
      await scene.screenshot({path:`tmp/speed-zone-verification/${mode}-${width}.png`});
      console.log(`PASS ${mode}/${width}: mirrored zones inside assigned lanes`);
    }
  }
  if(errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('PASS login gate, retained configured credentials, and no browser page errors');
} finally { await browser.close(); }
