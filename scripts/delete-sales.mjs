import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const latest=JSON.parse(await readFile(new URL('.data-backups/latest.json',root)));
const snapshot=JSON.parse(await readFile(new URL('.data-backups/'+latest.filename,root)));
const context=vm.createContext({console,URL,document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{}});
vm.runInContext(await readFile(new URL('company-parsers.js',root),'utf8'),context);
vm.runInContext((await readFile(new URL('app.js',root),'utf8')).replace(/^init\(\);$/m,''),context);
const targets=snapshot.tables.jobs.filter(job=>{context.job=job;return vm.runInContext('isSalesJob(job)',context);});
const plan={backup:latest.filename,targets:targets.map(job=>({id:job.id,title:job.title,updatedAt:job.updated_at}))};
await writeFile(new URL('.data-backups/sales-deletion-plan.json',root),JSON.stringify(plan,null,2));
console.log(JSON.stringify(plan,null,2));
if(!process.argv.includes('--apply'))process.exit(0);
const {supabase}=JSON.parse(await readFile(new URL('supabase-config.json',root)));
async function request(path,method='GET'){
 const r=await fetch(`${supabase.url}/rest/v1/${path}`,{method,headers:{apikey:supabase.key,Authorization:`Bearer ${supabase.key}`,Prefer:'return=representation'}});
 if(!r.ok)throw Error(`${method} ${path}: ${r.status} ${await r.text()}`);
 return r.status===204?[]:r.json();
}
const before=await request('jobs?select=id,updated_at&limit=1000');
for(const job of targets)assert.equal(before.find(row=>row.id===job.id)?.updated_at,job.updated_at,`Job ${job.id} changed since backup`);
for(const job of targets){
 const deleted=await request(`jobs?id=eq.${job.id}&updated_at=eq.${encodeURIComponent(job.updated_at)}`,'DELETE');
 assert.equal(deleted.length,1,`Job ${job.id} was not deleted`);
}
const after=await request('jobs?select=id,title&limit=1000');
assert.equal(after.length,before.length-targets.length);
for(const row of after){context.job=row;assert.equal(vm.runInContext('isSalesJob(job)',context),false,`Sales job remains: ${row.id}`);}
let links=[];for(let offset=0;;offset+=1000){const page=await request(`job_skills?select=skill_id&limit=1000&offset=${offset}`);links.push(...page);if(page.length<1000)break;}
const used=new Set(links.map(link=>link.skill_id));
const targetIds=new Set(targets.map(job=>job.id));
const affected=new Set(snapshot.tables.job_skills.filter(link=>targetIds.has(link.job_id)).map(link=>link.skill_id));
const unused=[...affected].filter(id=>!used.has(id));
if(unused.length)await request(`skills?id=in.(${unused.join(',')})`,'DELETE');
const result={before:before.length,after:after.length,deleted:plan.targets,removedUnusedSkills:unused.length,backup:latest.filename};
await writeFile(new URL('.data-backups/sales-deletion-result.json',root),JSON.stringify(result,null,2));
console.log('VERIFIED',JSON.stringify(result));
