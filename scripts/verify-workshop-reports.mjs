import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {scenarios} from './workshop-catalog.mjs';
import {synthetic} from '../tests/synthetic-inputs.mjs';
import {html} from './lib/workshop-common.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),host=process.env.HXG_SOURCE_ROOT;
if(!host)throw new Error('请用 HXG_SOURCE_ROOT 指定提供 Playwright 的华信小工源码根目录');
const {chromium}=createRequire(path.join(host,'package.json'))('playwright');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hx-report-protocol-')),out=path.join(root,'output/playwright/workshop');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(fs.existsSync(chromium.executablePath())?{headless:true}:{channel:'chrome',headless:true});
try {
  const page=await browser.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  for(const s of scenarios){
    const {run}=await import(pathToFileURL(path.join(root,'plugins',s.name,'skills',s.skill,'scripts/run.mjs')));
    const file=path.join(temporary,s.group+'.html');fs.writeFileSync(file,html(run(synthetic(s.group))));await page.goto(pathToFileURL(file).href);assert.equal(await page.locator('h1').innerText(),s.title);
    await page.locator('#query').fill('NO_MATCH_73');assert.equal(await page.locator('tbody tr:visible').count(),0);await page.locator('#query').fill('');assert(await page.locator('tbody tr:visible').count()>0);
    for(const colorScheme of ['light','dark'])for(const width of [390,920,1280]){await page.emulateMedia({colorScheme});await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
    await page.locator('summary').click();assert(await page.locator('pre').isVisible());await page.locator('#query').focus();assert(await page.locator('#query').evaluate(e=>e===document.activeElement));
    if(s.group==='G1')await page.screenshot({path:path.join(out,'抽象字段结果页.png'),fullPage:true});
    checks.push({group:s.group,search:'passed',details:'passed',keyboardFocus:'passed',themes:2,widths:[390,920,1280]});
  }
  assert.deepEqual(errors,[]);const result={at:new Date().toISOString(),businessSamples:0,modelRequests:0,userInstallations:0,checks,errors};
  fs.writeFileSync(path.join(root,'dist/workshop/report-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await browser.close();fs.rmSync(temporary,{recursive:true,force:true});}
