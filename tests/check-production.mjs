import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';

// Read-only verification of the deployed app and its real database, including >1000 rows.
let origin='https://jobpostview.gongonticktack.workers.dev';
let server;
if(process.argv.includes('--local')){
 server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const name=path==='/'?'index.html':path.slice(1);
  if(!['index.html','app.js','crawler.js','company-parsers.js','styles.css','supabase-config.json','job_icon.png'].includes(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'text/html; charset=utf-8');
  res.end(await readFile(new URL('../'+name,import.meta.url)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin=`http://127.0.0.1:${server.address().port}`;
}
const expected=JSON.parse(await readFile(new URL('../.data-backups/replacement-result.json',import.meta.url)));
let incomeExpected;
try{incomeExpected=JSON.parse(await readFile(new URL('../.data-backups/income-estimates-result.json',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
const profile=await mkdtemp(join(tmpdir(),'job-post-production-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
let ws;
try{
 let port;
 for(let i=0;i<100;i++){
  try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(port,'Browser did not start');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 ws=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let nextId=0;const pending=new Map();const errors=[];
 ws.onmessage=event=>{const result=JSON.parse(event.data);if(result.method==='Runtime.exceptionThrown')errors.push(result.params.exceptionDetails.text);if(result.id){const item=pending.get(result.id);pending.delete(result.id);result.error?item.reject(Error(result.error.message)):item.resolve(result.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 await call('Runtime.enable');
 await call('Page.navigate',{url:origin});
 let actual;
 for(let i=0;i<120;i++){
  await new Promise(resolve=>setTimeout(resolve,1000));
  const result=await call('Runtime.evaluate',{expression:`typeof state==='undefined'?null:({jobs:state.jobs.length,archives:state.jobs.filter(j=>j.sourceDocument?.fullText).length,pendingArchives:state.jobs.filter(j=>j.archivePending).length,cards:document.querySelectorAll('#jobList .job-card').length,count:document.querySelector('#resultCount')?.textContent,companies:new Set(state.jobs.map(j=>j.company)).size,reparse:!!document.querySelector('#reparseDocumentsButton'),estimated:state.jobs.filter(j=>j.salaryEstimate).length,estimatedCards:document.querySelectorAll('#jobList .income.is-estimated').length,estimateSources:document.querySelectorAll('#jobList .income-estimate:not([hidden]) .income-estimate-source').length,averageLabel:document.querySelector('#avgIncomeLabel')?.textContent})`,returnByValue:true});
  actual=result.result.value;
  if(actual?.cards===expected.after)break;
 }
 if(actual?.jobs!==expected.after){
  const diagnostic=await call('Runtime.evaluate',{expression:`({ready:document.readyState,supabase:typeof state!=='undefined'&&Boolean(state.supabase),localDB:typeof state!=='undefined'&&Boolean(state.db),status:document.querySelector('#crawlStatus')?.textContent,errors:${JSON.stringify(errors)}})`,returnByValue:true});
  console.log('Loading diagnostic',JSON.stringify(diagnostic.result.value));
 }
 assert.equal(actual?.jobs,expected.after,'Database jobs did not all load');
 assert.equal(actual.pendingArchives,expected.after,'Source archives should be deferred');assert.equal(actual.archives,0,'Archives loaded eagerly');
 assert.equal(actual.cards,expected.after,'List did not render all jobs');
 assert.equal(actual.companies,8);assert.ok(actual.reparse);
 if(process.argv.includes('--mobile')){
  const suffix=process.argv.includes('--before')?'before':'after';
  for(const width of [360,390,430]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
   await call('Runtime.evaluate',{expression:'window.scrollTo(0,0)'});
   const shot=await call('Page.captureScreenshot',{format:'png'});
   await writeFile(new URL(`../.data-backups/mobile-${width}-${suffix}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
   const layout=(await call('Runtime.evaluate',{expression:`({viewport:innerWidth,content:document.documentElement.scrollWidth,filterVisible:getComputedStyle(document.querySelector('#explorerFilters')).display!=='none',titleSize:getComputedStyle(document.querySelector('#jobList h3')).fontSize})`,returnByValue:true})).result.value;
   assert.ok(layout.content<=layout.viewport,`Mobile overflow at ${width}`);
   assert.equal(layout.filterVisible,false,'Filters should start collapsed');
   console.log('MOBILE',width,JSON.stringify(layout));
  }
  await call('Runtime.evaluate',{expression:`document.querySelector('#toggleFilterButton').click();window.scrollTo(0,0)`});
  const filterState=(await call('Runtime.evaluate',{expression:`({expanded:document.querySelector('#toggleFilterButton').getAttribute('aria-expanded'),display:getComputedStyle(document.querySelector('#explorerFilters')).display})`,returnByValue:true})).result.value;
  assert.equal(filterState.expanded,'true');assert.notEqual(filterState.display,'none');
  const filters=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL(`../.data-backups/mobile-filters-${suffix}.png`,import.meta.url),Buffer.from(filters.data,'base64'));
  await call('Runtime.evaluate',{expression:`document.querySelector('#toggleFilterButton').click()`});
 }
 if(process.argv.includes('--details')){
  await call('Emulation.setDeviceMetricsOverride',{width:1680,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Runtime.evaluate',{expression:`document.querySelector('#jobList .job-card').scrollIntoView({block:'start'})`});
  const measure=`(()=>{const card=document.querySelector('#jobList .job-card'),detail=card.querySelector('.job-detail-block'),summary=detail.querySelector(':scope > summary'),body=detail.querySelector('.job-detail-content'),c=card.getBoundingClientRect(),s=summary.getBoundingClientRect(),b=body.getBoundingClientRect();return {open:detail.open,label:summary.innerText,width:s.width,height:s.height,left:s.left-c.left,top:s.top-c.top,rightGap:c.right-s.right,cardWidth:c.width,bodyWidth:b.width,viewport:innerWidth,content:document.documentElement.scrollWidth,nestedSummaryPadding:getComputedStyle(card.querySelector('.source-document > summary')).paddingTop};})()`;
  const closed=(await call('Runtime.evaluate',{expression:measure,returnByValue:true})).result.value;
  assert.ok(closed.height>=36&&closed.width>=110,'Details control is too small');assert.equal(closed.label,'詳細を確認');
  await call('Runtime.evaluate',{expression:`document.querySelector('#jobList .job-card .job-detail-block > summary').click()`});
  await new Promise(resolve=>setTimeout(resolve,1000));
  const opened=(await call('Runtime.evaluate',{expression:measure,returnByValue:true})).result.value;
  assert.equal(opened.label,'詳細を閉じる');assert.ok(Math.abs(closed.top-opened.top)<2&&Math.abs(closed.left-opened.left)<20,'Control moved when expanded');assert.ok(opened.bodyWidth>opened.cardWidth*.95,'Expanded details do not use row width');assert.ok(opened.content<=opened.viewport,'Desktop details overflow');
  const desktop=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../.data-backups/details-desktop.png',import.meta.url),Buffer.from(desktop.data,'base64'));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Runtime.evaluate',{expression:`document.querySelector('#jobList .job-card').scrollIntoView({block:'start'})`});
  const mobile=(await call('Runtime.evaluate',{expression:measure,returnByValue:true})).result.value;
  assert.ok(mobile.content<=mobile.viewport,'Mobile details overflow');assert.ok(mobile.height>=36&&mobile.width>=110);assert.ok(mobile.bodyWidth>mobile.cardWidth*.85);
  const mobileShot=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../.data-backups/details-mobile.png',import.meta.url),Buffer.from(mobileShot.data,'base64'));
  await call('Runtime.evaluate',{expression:`document.querySelector('#jobList .job-card .job-detail-block > summary').click()`});
  console.log('DETAILS',JSON.stringify({closed,opened,mobile}));
 }
 if(incomeExpected){assert.equal(actual.estimated,incomeExpected.estimated);assert.equal(actual.estimatedCards,incomeExpected.estimated);assert.equal(actual.estimateSources,0,'Closed details should not be rendered');assert.equal(actual.averageLabel,'平均年収');}
 const filter=await call('Runtime.evaluate',{expression:`document.querySelector('#regionFilter').value='東京都';document.querySelector('#regionFilter').dispatchEvent(new Event('change'));({cards:document.querySelectorAll('#jobList .job-card').length,count:document.querySelector('#resultCount').textContent})`,returnByValue:true});
 assert.ok(filter.result.value.cards>0&&filter.result.value.cards<expected.after,'Region filter did not narrow jobs');
 assert.equal(errors.length,0,errors.join('\n'));
 if(process.argv.includes('--settings')){
  const settings=await call('Runtime.evaluate',{expression:`switchView('settings');document.querySelector('#dictionarySearch').value='K8s';document.querySelector('#dictionarySearch').dispatchEvent(new Event('input'));({visible:[...document.querySelectorAll('#skillDictionaryEditor [data-dictionary-row]')].filter(row=>!row.hidden).map(row=>row.querySelector('[data-dictionary-field=term]').value),overview:document.querySelector('#settingsOverview').textContent})`,returnByValue:true});
  assert.deepEqual(settings.result.value.visible,['Kubernetes']);
  const jobs=await call('Runtime.evaluate',{expression:`document.querySelector('[data-settings-tab=jobs]').click();({rows:document.querySelectorAll('#settingsJobList .settings-job-item').length,pages:document.querySelector('#settingsJobPage').textContent,count:document.querySelector('#settingsJobCount').textContent})`,returnByValue:true});
  assert.equal(jobs.result.value.rows,25);assert.equal(jobs.result.value.pages,`1 / ${Math.ceil(expected.after/25)}`);
  await call('Runtime.evaluate',{expression:`document.querySelector('[data-settings-tab=skill]').click();window.scrollTo(0,0)`});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  const desktop=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../.data-backups/settings-desktop.png',import.meta.url),Buffer.from(desktop.data,'base64'));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Runtime.evaluate',{expression:'window.scrollTo(0,0)'});
  const mobile=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../.data-backups/settings-mobile.png',import.meta.url),Buffer.from(mobile.data,'base64'));
  const width=await call('Runtime.evaluate',{expression:'({viewport:window.innerWidth,content:document.documentElement.scrollWidth})',returnByValue:true});assert.ok(width.result.value.content<=width.result.value.viewport,'Settings overflow on mobile');
  console.log('SETTINGS',JSON.stringify({search:settings.result.value,pagination:jobs.result.value,mobile:width.result.value}));
 }
 console.log(JSON.stringify({loaded:actual,regionFilter:filter.result.value,exceptions:errors},null,2));
}finally{ws?.close();browser.kill();server?.closeAllConnections();server?.close();}
