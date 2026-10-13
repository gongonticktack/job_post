import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const latest=JSON.parse(await readFile(new URL('.data-backups/latest.json',root)));
const backup=JSON.parse(await readFile(new URL('.data-backups/'+latest.filename,root)));
const stage=JSON.parse(await readFile(new URL('.data-backups/replacement-jobs.json',root)));
assert.equal(stage.backupCreatedAt,backup.createdAt,'Stage and backup do not match');
assert.equal(stage.reports.length,8,'All eight company catalogs are required');
for(const report of stage.reports){assert.ok(report.complete,`${report.company}: incomplete catalog`);assert.equal(report.failed.length,0,`${report.company}: failed sources`);assert.ok(report.accepted>0,`${report.company}: no IT jobs`);}
const ctx=vm.createContext({console,URL,document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{}});
vm.runInContext(await readFile(new URL('company-parsers.js',root),'utf8'),ctx);
vm.runInContext((await readFile(new URL('app.js',root),'utf8')).replace(/^init\(\);$/m,''),ctx);
const sources=new Set();
for(const job of stage.jobs){
 assert.ok(job.title&&job.description&&job.sourceDocument?.fullText,'Missing job fields or full text');
 assert.ok(job.sourceDocument.fetchedAt&&job.sourceDocument.sourceUrl,'Missing source provenance');
 assert.ok(['html','ibm-json','accenture-json'].includes(job.sourceDocument.format),'Unexpected source format');
 assert.ok(!sources.has(job.sourceUrl),'Duplicate source URL');sources.add(job.sourceUrl);
 ctx.job=job;assert.equal(vm.runInContext('isSalesJob(job)',ctx),false,'Sales job in replacement');
 assert.equal(vm.runInContext('classifyJobDomain(job)',ctx),'it','Non-IT job in replacement');
}
const hash=value=>createHash('sha256').update(value).digest('hex');
const plan={backup:latest.filename,before:backup.tables.jobs.length,after:stage.jobs.length,sourceTextCharacters:stage.jobs.reduce((sum,job)=>sum+job.sourceDocument.fullText.length,0),companies:Object.fromEntries(stage.reports.map(report=>[report.company,stage.jobs.filter(job=>job.company===report.company).length]))};
await writeFile(new URL('.data-backups/replacement-plan.json',root),JSON.stringify(plan,null,2));
console.log(JSON.stringify(plan,null,2));
if(!process.argv.includes('--apply'))process.exit(0);
const {supabase}=JSON.parse(await readFile(new URL('supabase-config.json',root)));
async function request(path,method='GET',body,prefer){
 const response=await fetch(`${supabase.url}/rest/v1/${path}`,{method,headers:{apikey:supabase.key,Authorization:`Bearer ${supabase.key}`,'Content-Type':'application/json',Prefer:prefer||(method==='POST'?'resolution=merge-duplicates,return=representation':'return=representation')},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Error(`${method} ${path}: ${response.status} ${await response.text()}`);
 const text=await response.text();return text?JSON.parse(text):[];
}
async function all(table,select='*'){
 const rows=[];for(let offset=0;;offset+=200){const page=await request(`${table}?select=${select}&limit=200&offset=${offset}&order=${table==='job_skills'?'job_id,skill_id,skill_type':'id'}`);rows.push(...page);if(page.length<200)break;}return rows;
}
const before=await all('jobs','id,source_url,updated_at');
const resume=process.argv.includes('--resume');
const previousSaved=resume?JSON.parse(await readFile(new URL('.data-backups/replacement-saved-ids.json',root))):[];
const previousIds=new Set(previousSaved.map(row=>row.id));
const backupIds=new Set(backup.tables.jobs.map(row=>row.id));
if(resume){
 assert.equal(previousSaved.length,stage.jobs.length,'Incomplete saved IDs');
 assert.equal(new Set(previousSaved.map(row=>row.source_url)).size,sources.size,'Duplicate saved URLs');
 for(const row of previousSaved)assert.ok(sources.has(row.source_url),'Unexpected saved URL');
 for(const row of before)assert.ok(previousIds.has(row.id)||backupIds.has(row.id),'Unexpected job during resume');
}else assert.equal(before.length,backup.tables.jobs.length,'Jobs changed since backup');
for(const old of backup.tables.jobs)if(!previousIds.has(old.id))assert.equal(before.find(row=>row.id===old.id)?.updated_at,old.updated_at,`Job ${old.id} changed since backup`);
const companyNames=[...new Set(stage.jobs.map(job=>job.company))];
await request('companies?on_conflict=name','POST',companyNames.map(name=>({name})));
const companies=await all('companies');
const payloads=stage.jobs.map(job=>{ctx.job=job;ctx.companyId=companies.find(company=>company.name===job.company)?.id;assert.ok(ctx.companyId,'Missing company');return vm.runInContext('toDbJob(job,companyId)',ctx);});
const saved=[...previousSaved];
for(let offset=0;!resume&&offset<payloads.length;offset+=15){
 saved.push(...await request('jobs?on_conflict=source_url&select=id,source_url','POST',payloads.slice(offset,offset+15)));
 if(offset%150===0)console.log('Saved',Math.min(offset+15,payloads.length),'/',payloads.length);
}
assert.equal(new Set(saved.map(row=>row.id)).size,stage.jobs.length,'Incomplete upsert');
await writeFile(new URL('.data-backups/replacement-saved-ids.json',root),JSON.stringify(saved));
// Verify every stored full-text archive before deleting any previous job.
const stored=await all('jobs','id,source_url,reference_info');
for(const payload of payloads){const actual=stored.find(row=>row.source_url===payload.source_url);assert.ok(actual,'Missing saved job');assert.equal(hash(actual.reference_info),hash(payload.reference_info),'Stored full-text archive differs');}
console.log('Verified all full-text archives');
const names=[...new Set(stage.jobs.flatMap(job=>[...(job.requiredSkills||[]),...(job.preferredSkills||[])]))];
if(names.length)await request('skills?on_conflict=name','POST',names.map(name=>({name,normalized_name:name.toLowerCase()})));
const skills=await all('skills');
const links=[];const byUrl=new Map(saved.map(row=>[row.source_url,row.id]));const skillIds=new Map(skills.map(row=>[row.name,row.id]));
for(const job of stage.jobs)for(const type of ['required','preferred'])for(const name of job[type+'Skills']){
 assert.ok(skillIds.has(name),'Missing skill');links.push({job_id:byUrl.get(job.sourceUrl),skill_id:skillIds.get(name),skill_type:type});
}
for(let offset=0;offset<saved.length;offset+=150)await request(`job_skills?job_id=in.(${saved.slice(offset,offset+150).map(row=>row.id).join(',')})`,'DELETE');
for(let offset=0;offset<links.length;offset+=500)await request('job_skills?on_conflict=job_id,skill_id,skill_type','POST',links.slice(offset,offset+500), 'resolution=ignore-duplicates,return=minimal');
const actualLinks=await all('job_skills');
const linkSet=new Set(actualLinks.map(link=>`${link.job_id}:${link.skill_id}:${link.skill_type}`));
for(const link of links)assert.ok(linkSet.has(`${link.job_id}:${link.skill_id}:${link.skill_type}`),'Missing skill link');
console.log('Verified all skill links');
const keeperIds=new Set(saved.map(row=>row.id));
const obsolete=backup.tables.jobs.filter(row=>!keeperIds.has(row.id));
// Existing rows with the same URL are retained and refreshed; only backed-up old IDs are removed.
for(let offset=0;offset<obsolete.length;offset+=100){
 const batch=obsolete.slice(offset,offset+100);const current=await request(`jobs?select=id,updated_at&id=in.(${batch.map(row=>row.id).join(',')})`);
 for(const row of batch)assert.equal(current.find(item=>item.id===row.id)?.updated_at,row.updated_at,`Old job ${row.id} changed during replacement`);
 const removed=await request(`jobs?id=in.(${batch.map(row=>row.id).join(',')})`,'DELETE');assert.equal(removed.length,batch.length,'Old rows not deleted');
}
const after=await all('jobs','id,source_url');assert.equal(after.length,stage.jobs.length);
for(const row of after)assert.ok(keeperIds.has(row.id),'Unexpected job after replacement');
const finalLinks=await all('job_skills');const used=new Set(finalLinks.map(link=>link.skill_id));const orphans=skills.filter(skill=>!used.has(skill.id));
for(let offset=0;offset<orphans.length;offset+=150)await request(`skills?id=in.(${orphans.slice(offset,offset+150).map(row=>row.id).join(',')})`,'DELETE');
const result={...plan,oldRowsRemoved:obsolete.length,retainedAndUpdated:backup.tables.jobs.length-obsolete.length,skillLinks:finalLinks.length,unusedSkillsRemoved:orphans.length,verifiedAt:new Date().toISOString()};
await writeFile(new URL('.data-backups/replacement-result.json',root),JSON.stringify(result,null,2));
console.log('VERIFIED',JSON.stringify(result));
