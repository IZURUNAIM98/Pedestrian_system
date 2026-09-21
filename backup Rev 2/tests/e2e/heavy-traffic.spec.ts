import { expect, test } from '@playwright/test';
import { loadLocalAuthEnvironment } from '../load-local-auth-env';

loadLocalAuthEnvironment();
test.beforeEach(async ({page})=>{
  const response=await page.request.post('/api/login',{data:{id:process.env.DEMO_ACCESS_ID,password:process.env.DEMO_ACCESS_PASSWORD}});
  expect(response.ok()).toBe(true);await page.goto('/');
  await page.getByLabel('Simulation sequence',{exact:true}).selectOption('heavy');
  await expect(page.getByRole('heading',{name:'Peak-Hour Heavy Traffic and Queue Stabilisation'})).toBeVisible();
  await page.clock.install();
});

test('does not offer a downloadable heavy traffic report',async ({page})=>{
  await expect(page.getByRole('button',{name:'Download heavy traffic PDF'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Start Heavy Traffic Simulation'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Pedestrian request'})).toBeVisible();
});

test('peak-hour queue formation, recovery and preserved violation selector without a report download',async ({page},testInfo)=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByLabel('Peak preset').selectOption('Severe Queue');
  await page.getByRole('button',{name:'Start Heavy Traffic Simulation'}).click();
  await page.clock.runFor(65000);
  await expect(page.locator('.ht-car')).not.toHaveCount(0);
  await expect(page.locator('.ht-state')).toContainText(/HEAVY TRAFFIC MANAGEMENT|RECOVERY/);
  await expect(page.locator('.ht-metrics')).toContainText('upstream estimate');
  await page.screenshot({path:testInfo.outputPath('heavy-queue.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.clock.runFor(420000);
  await expect(page.locator('.ht-state')).toContainText('STABLE');
  await expect(page.locator('.ht-summary')).toContainText('NORMAL / STABLE');
  await expect(page.getByRole('button',{name:'Download heavy traffic PDF'})).toHaveCount(0);
  await page.getByLabel('Simulation sequence',{exact:true}).selectOption('crossing');
  await expect(page.locator('#scenario-select').locator('option')).toHaveCount(20);
  await page.getByRole('button',{name:'School crossing'}).click();
  await expect(page.locator('#scenario-select').locator('option')).toHaveCount(21);
  expect(errors).toEqual([]);
});

test('registered pedestrian request receives full countdown and RED protection',async ({page})=>{
  await page.getByRole('button',{name:'Start Heavy Traffic Simulation'}).click();
  await page.getByRole('button',{name:'Pedestrian request',exact:true}).click();
  await expect(page.getByRole('timer').first()).toHaveAttribute('aria-label',/Waiting Time, 20 seconds/);
  await page.clock.runFor(19000);
  await expect(page.getByRole('timer').first()).toHaveAttribute('aria-label',/Waiting Time, 1 seconds/);
  await page.clock.runFor(1000);
  await expect(page.getByRole('timer').first()).toHaveAttribute('aria-label',/Waiting Time, 0 seconds/);
  await page.clock.runFor(1000);
  await expect(page.getByRole('timer').first()).toHaveAttribute('aria-label',/Safe Signal Transition, 3 seconds/);
  await page.clock.runFor(7000);
  await expect(page.locator('.ht-state')).toContainText('WALK');
  await expect(page.getByRole('timer').first()).toHaveAttribute('aria-label',/Walking Time, 15 seconds/);
  await expect(page.getByRole('img',{name:'Eastbound traffic light STOP',exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'Westbound traffic light STOP',exact:true})).toBeVisible();
  const before=await page.locator('.pedestrian-timer b').first().textContent();
  await page.clock.runFor(1000);
  const after=await page.locator('.pedestrian-timer b').first().textContent();
  expect(after).not.toBe(before);
  await page.getByLabel('Pedestrian remains in crossing (extend clearance)').check();
  await page.clock.runFor(17000);
  await expect(page.getByRole('img',{name:'Eastbound traffic light STOP',exact:true})).toBeVisible();
  await page.getByLabel('Pedestrian remains in crossing (extend clearance)').uncheck();
  await page.clock.runFor(6000);
  await expect(page.locator('.ht-state')).toContainText(/GREEN|AMBER/);
});

test('critical sensor failure retains request and blocks WALK; redundant recovery serves demand',async ({page})=>{
  await page.getByRole('button',{name:'Start Heavy Traffic Simulation'}).click();
  await page.getByLabel('Run sensor health').selectOption('failed');
  await page.getByRole('button',{name:'Pedestrian request',exact:true}).click();await page.clock.runFor(12000);
  await expect(page.locator('.ht-state')).toContainText('CRITICAL/SAFE MODE');
  await expect(page.locator('.ht-state')).toContainText('Pedestrian WAIT');
  await page.getByLabel('Run sensor health').selectOption('redundant');await page.clock.runFor(7000);
  await expect(page.locator('.ht-state')).toContainText('DEGRADED MODE');
  await expect(page.locator('.ht-state')).toContainText('WALK');
});
