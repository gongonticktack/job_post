import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const latest=JSON.parse(await readFile(new URL('.data-backups/latest.json',root)));
const backup=JSON.parse(await readFile(new URL('.data-backups/'+latest.filename,root)));
const ctx=vm.createContext({console,URL,document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{}});
vm.runInContext(await readFile(new URL('company-parsers.js',root),'utf8'),ctx);
vm.runInContext((await readFile(new URL('app.js',root),'utf8')).replace(/^init\(\);$/m,''),ctx);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const updates=[];const skipped=[];
let advertised=0;
for(const row of backup.tables.jobs){
 if(Number.isFinite(row.annual_income_min)||Number.isFinite(row.annual_income_max)){advertised++;continue;}
 ctx.row={...row,company:backup.tables.companies.find(company=>company.id===row.company_id)?.name};
 const job=vm.runInContext('toClientJob(row)',ctx);
 if(!job.salaryEstimate){skipped.push({id:row.id,title:row.title,company:job.company});continue;}
 ctx.job=job;
 const reference_info=vm.runInContext('encodeJobReference(job)',ctx);
 const original=vm.runInContext('decodeJobReference(row.reference_info)',ctx);
 assert.equal(hash(job.sourceDocument),hash(original.sourceDocument),'Full source changed');
 if(reference_info===row.reference_info)continue;
 updates.push({id:row.id,company:job.company,title:row.title,updated_at:row.updated_at,originalReference:row.reference_info,reference_info,estimate:job.salaryEstimate});
}
const summary={backup:latest.filename,jobs:backup.tables.jobs.length,advertised,estimated:updates.length,unestimated:skipped,companies:Object.fromEntries([...new Set(updates.map(row=>row.company))].map(company=>[company,updates.filter(row=>row.company===company).length]))};
await writeFile(new URL('.data-backups/income-estimates-plan.json',root),JSON.stringify({summary,updates},null,2));
console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--apply'))process.exit(0);
const {supabase}=JSON.parse(await readFile(new URL('supabase-config.json',root)));
async function request(path,method='GET',body){
 const response=await fetch(`${supabase.url}/rest/v1/${path}`,{method,headers:{apikey:supabase.key,Authorization:`Bearer ${supabase.key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();if(!response.ok)throw Error(`${response.status} ${path}: ${text}`);return text?JSON.parse(text):[];
}
// Conditional updates avoid overwriting changes after the backup.
for(let index=0;index<updates.length;index++){
 const update=updates[index];
 const rows=await request(`jobs?id=eq.${update.id}&updated_at=eq.${encodeURIComponent(update.updated_at)}`,'PATCH',{reference_info:update.reference_info});
 assert.equal(rows.length,1,`Job ${update.id} changed since backup`);
 assert.equal(rows[0].reference_info,update.reference_info,'Estimate not saved');
 const old=backup.tables.jobs.find(row=>row.id===update.id);
 assert.equal(rows[0].annual_income_min,old.annual_income_min);
 assert.equal(rows[0].annual_income_max,old.annual_income_max);
 assert.equal(rows[0].annual_income_raw,old.annual_income_raw);
 if(index%50===0)console.log('Saved estimates',index+1,'/',updates.length);
}
const current=[];
for(let offset=0;;offset+=200){const page=await request(`jobs?select=*&order=id&limit=200&offset=${offset}`);current.push(...page);if(page.length<200)break;}
assert.equal(current.length,backup.tables.jobs.length,'Job count changed');
const byId=new Map(current.map(row=>[row.id,row]));
for(const old of backup.tables.jobs){
 const row=byId.get(old.id);assert.ok(row,'Job missing');
 assert.equal(row.annual_income_min,old.annual_income_min);assert.equal(row.annual_income_max,old.annual_income_max);assert.equal(row.annual_income_raw,old.annual_income_raw);
 ctx.old=old;ctx.current=row;
 assert.equal(vm.runInContext('JSON.stringify(decodeJobReference(old.reference_info).sourceDocument)===JSON.stringify(decodeJobReference(current.reference_info).sourceDocument)',ctx),true,'Full source changed');
}
for(const update of updates)assert.equal(byId.get(update.id).reference_info,update.reference_info);
await writeFile(new URL('.data-backups/income-estimates-result.json',root),JSON.stringify({...summary,verifiedAt:new Date().toISOString()},null,2));
console.log('VERIFIED',updates.length,'estimates; all advertised salaries and source archives preserved');
