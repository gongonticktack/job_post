import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker from '../worker.js';
const root=new URL('../',import.meta.url);
const refresh=process.argv.includes('--refresh');
const affected=process.argv.includes('--affected');
const replace=process.argv.includes('--replace')||affected;
const retry=process.argv.includes('--retry');
const organize=process.argv.includes('--organize');
const latest=JSON.parse(await readFile(new URL('.data-backups/latest.json',root)));
const snapshot=await readFile(new URL('.data-backups/'+latest.filename,root));
let done;const finished=new Promise(r=>done=r);
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/snapshot'){res.setHeader('Content-Type','application/json');res.end(snapshot);return;}
 if(pathname==='/replacement'){res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('.data-backups/replacement-jobs.json',root)));return;}
 if(pathname==='/supabase-config.json'){res.setHeader('Content-Type','application/json');res.end('{}');return;}
 if(['/api/proxy','/results','/progress'].includes(pathname)){
  let body='';for await(const chunk of req)body+=chunk;
  if(pathname==='/results'){await writeFile(new URL(organize?'.data-backups/organized-taxonomy.json':replace||retry?'.data-backups/replacement-jobs.json':refresh?'.data-backups/latest-jobs.json':'.data-backups/recovered.json',root),body);res.end('OK');done(JSON.parse(body));return;}
  if(pathname==='/progress'){console.log('Recovered:',body);res.end('OK');return;}
  const upstream=await worker.fetch(new Request('https://app.example/api/proxy',{method:'POST',headers:{'Content-Type':'application/json'},body}),{});
  res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(Buffer.from(await upstream.arrayBuffer()));return;
 }
 const files={'/':organize?'scripts/organize-taxonomy.html':retry?'scripts/retry-replacement.html':replace?'scripts/replace-jobs.html':refresh?'scripts/refresh-jobs.html':'scripts/recover-requirements.html','/index.html':'index.html','/app.js':'app.js','/crawler.js':'crawler.js','/company-parsers.js':'company-parsers.js','/styles.css':'styles.css'};
 if(!files[pathname]){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(await readFile(new URL(files[pathname],root)));
 }catch(e){res.writeHead(502);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(join(tmpdir(),'job-recovery-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--user-data-dir='+profile,`http://127.0.0.1:${server.address().port}/${affected?'?affected=1':''}`],{stdio:'ignore'});
const timer=setTimeout(()=>done({error:'Timed out'}),replace?1800000:refresh?600000:180000);
const output=await finished;console.log(JSON.stringify({jobs:output.jobs?.length,reports:output.reports,recovered:output.recovered?.length,refreshed:output.refreshed?.length,unmatched:output.unmatched,failures:output.failures,error:output.error}));
clearTimeout(timer);browser.kill();server.closeAllConnections();server.close();process.exit(output.error?1:0);
