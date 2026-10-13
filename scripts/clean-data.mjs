import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const latest=JSON.parse(await readFile(new URL('.data-backups/latest.json',root)));
const backup=JSON.parse(await readFile(new URL('.data-backups/'+latest.filename,root)));
const context=vm.createContext({console,URL,document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{}});
vm.runInContext(await readFile(new URL('company-parsers.js',root),'utf8'),context);
vm.runInContext((await readFile(new URL('app.js',root),'utf8')).replace(/^init\(\);$/m,''),context);
context.terms=backup.tables.dictionary_terms;
vm.runInContext(`for(const type of ['skill','certification']){const key=type+'Dictionary';window.JobParserConfig[key]=[...new Set([...window.JobParserConfig[key],...terms.filter(t=>t.dictionary_type===type).map(t=>t.term)])];}`,context);
let recovery={recovered:[]};try{recovery=JSON.parse(await readFile(new URL('.data-backups/recovered.json',root)));}catch{}
const patches=[],deletions=[],review=[];
for(const row of backup.tables.jobs){
 const company=backup.tables.companies.find(c=>c.id===row.company_id)?.name;
 context.row={...row,companies:{name:company}};
 const job=vm.runInContext('toClientJob(row)',context);
 // Preserve pre-normalization evidence, including polluted skill/certification fields.
 job.requiredSkills=row.required_skills||[];job.preferredSkills=row.preferred_skills||[];
 context.job=job;
 const domain=vm.runInContext('classifyJobDomain(job)',context);
 if(domain==='non-it'){deletions.push({id:row.id,title:row.title,updatedAt:row.updated_at});continue;}
 if(domain==='review')review.push({id:row.id,title:row.title});
 const restored=recovery.recovered.find(r=>r.id===row.id)?.job;
 if(restored){
  for(const field of ['requiredSkills','preferredSkills','requiredCertifications','preferredCertifications','referenceInfo'])job[field]=restored[field]||(['requiredSkills','preferredSkills'].includes(field)?[]:'');
  if(!job.description&&restored.description)job.description=restored.description;
 }
 context.job=job;
 const repaired=vm.runInContext('repairJobRequirements(job)',context);
 context.repaired=repaired;
 const patch={required_skills:repaired.requiredSkills,preferred_skills:repaired.preferredSkills,required_certifications:repaired.requiredCertifications,preferred_certifications:repaired.preferredCertifications,reference_info:vm.runInContext('encodeJobReference(repaired)',context)};
 if(!row.description&&repaired.description)patch.description=repaired.description;
 if(Object.entries(patch).some(([key,value])=>JSON.stringify(row[key])!==JSON.stringify(value)))patches.push({id:row.id,title:row.title,updatedAt:row.updated_at,patch,recovered:!!restored});
}
const dictionaryDeletes=backup.tables.dictionary_terms.filter(term=>{
 context.term=term;
 return vm.runInContext(`term.dictionary_type==='certification'?NON_CERTIFICATION_PRODUCTS.has(term.term.toLowerCase()):NOISE_SKILLS.has(term.term)||isCertificationOnlySkill(term.term)`,context);
}).map(term=>({id:term.id,type:term.dictionary_type,term:term.term}));
const plan={backup:latest.filename,patches,deletions,review,dictionaryDeletes};
await writeFile(new URL('.data-backups/cleanup-plan.json',root),JSON.stringify(plan,null,2));
console.log(JSON.stringify({updates:patches.length,recovered:patches.filter(p=>p.recovered).length,deletions,review,dictionaryDeletes},null,2));
const finishOnly=process.argv.includes('--finish');
if(!process.argv.includes('--apply')&&!finishOnly)process.exit(0);
const {supabase}=JSON.parse(await readFile(new URL('supabase-config.json',root)));
async function request(path,method='GET',body){
 const response=await fetch(`${supabase.url}/rest/v1/${path}`,{method,headers:{apikey:supabase.key,Authorization:`Bearer ${supabase.key}`,'Content-Type':'application/json',Prefer:method==='POST'?'resolution=merge-duplicates,return=representation':'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Error(`${method} ${path}: ${response.status} ${await response.text()}`);
 return response.status===204?[]:response.json();
}
// Abort before mutations if any audited target has changed since the backup.
if(!finishOnly){
 const current=await request('jobs?select=id,updated_at&limit=1000');
 for(const target of [...patches,...deletions])assert.equal(current.find(j=>j.id===target.id)?.updated_at,target.updatedAt,`Job ${target.id} changed since backup`);
 for(const [index,target] of patches.entries()){
 const saved=await request(`jobs?id=eq.${target.id}&updated_at=eq.${encodeURIComponent(target.updatedAt)}`,'PATCH',target.patch);
 assert.equal(saved.length,1,`Job ${target.id} was not updated`);
 if((index+1)%25===0)console.log('Updated',index+1,'/',patches.length);
 }
}
const skillNames=[...new Set(patches.flatMap(p=>[...p.patch.required_skills,...p.patch.preferred_skills]))];
const existingSkills=await request('skills?select=*&limit=1000');
const missingNames=skillNames.filter(name=>!existingSkills.some(s=>s.name===name));
if(missingNames.length&&!finishOnly)await request('skills?on_conflict=name','POST',missingNames.map(name=>({name,normalized_name:name.toLowerCase()})));
const skills=await request('skills?select=*&limit=1000');
const links=[];
for(const target of patches)for(const type of ['required','preferred'])for(const name of target.patch[type+'_skills']){
 const skill=skills.find(s=>s.name===name);assert.ok(skill,'Missing skill '+name);links.push({job_id:target.id,skill_id:skill.id,skill_type:type});
}
if(patches.length&&!finishOnly){
 await request(`job_skills?job_id=in.(${patches.map(p=>p.id).join(',')})`,'DELETE');
 for(let index=0;index<links.length;index+=300)await request('job_skills?on_conflict=job_id,skill_id,skill_type','POST',links.slice(index,index+300));
}
if(!finishOnly)for(const target of deletions){
 const removed=await request(`jobs?id=eq.${target.id}&updated_at=eq.${encodeURIComponent(target.updatedAt)}`,'DELETE');assert.equal(removed.length,1);
}
if(dictionaryDeletes.length&&!finishOnly)await request(`dictionary_terms?id=in.(${dictionaryDeletes.map(t=>t.id).join(',')})`,'DELETE');
const newCertificateTerms=['SAP認定資格','認定スクラムマスター'].filter(term=>!backup.tables.dictionary_terms.some(t=>t.dictionary_type==='certification'&&t.term===term));
if(newCertificateTerms.length&&!finishOnly)await request('dictionary_terms?on_conflict=dictionary_type,term','POST',newCertificateTerms.map((term,index)=>({dictionary_type:'certification',term,sort_order:1000+index})));
const finalJobs=await request('jobs?select=*&limit=1000');
for(const target of patches){const actual=finalJobs.find(j=>j.id===target.id);for(const [key,value]of Object.entries(target.patch))assert.equal(JSON.stringify(actual[key]),JSON.stringify(value),`Verification failed: ${target.id} ${key}`);}
for(const target of deletions)assert.ok(!finalJobs.some(j=>j.id===target.id),'Deleted job still present');
let finalLinks=[];for(let offset=0;;offset+=1000){const page=await request(`job_skills?select=*&limit=1000&offset=${offset}`);finalLinks.push(...page);if(page.length<1000)break;}
for(const link of links)assert.ok(finalLinks.some(l=>l.job_id===link.job_id&&l.skill_id===link.skill_id&&l.skill_type===link.skill_type),'Missing skill relation');
const used=new Set(finalLinks.map(l=>l.skill_id));const orphans=skills.filter(s=>!used.has(s.id));
if(orphans.length)await request(`skills?id=in.(${orphans.map(s=>s.id).join(',')})`,'DELETE');
const summary={before:backup.tables.jobs.length,after:finalJobs.length,updated:patches.length,deleted:deletions,removedDictionaryTerms:dictionaryDeletes.length,addedCertificateTerms:newCertificateTerms.length,removedUnusedSkills:orphans.length,recovered:patches.filter(p=>p.recovered).length};
await writeFile(new URL('.data-backups/cleanup-result.json',root),JSON.stringify(summary,null,2));
console.log('VERIFIED',JSON.stringify(summary));
