import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const latest=JSON.parse(await readFile(new URL('.data-backups/latest.json',root)));
const backup=JSON.parse(await readFile(new URL('.data-backups/'+latest.filename,root)));
const stage=JSON.parse(await readFile(new URL('.data-backups/organized-taxonomy.json',root)));
assert.equal(stage.backupCreatedAt,backup.createdAt);assert.equal(stage.failures.length,0);assert.equal(stage.jobs.length,backup.tables.jobs.length);
const sourceIds=new Set(backup.tables.jobs.map(row=>row.id));assert.equal(new Set(stage.jobs.map(row=>row.id)).size,sourceIds.size);
const patches=[];
for(const job of stage.jobs){
 const old=backup.tables.jobs.find(row=>row.id===job.id);assert.ok(old);
 assert.equal(new Set(job.requiredSkills).size,job.requiredSkills.length);assert.equal(new Set(job.preferredSkills).size,job.preferredSkills.length);
 assert.ok(!job.preferredSkills.some(skill=>job.requiredSkills.includes(skill)));
 assert.ok(!job.requiredSkills.concat(job.preferredSkills).some(skill=>/\uFFFD/.test(skill)));
 const archive=JSON.parse(old.reference_info.slice(old.reference_info.indexOf('\n')+1));
 const reference_info='JOB_SOURCE_ARCHIVE_V1\n'+JSON.stringify({...archive,referenceInfo:job.referenceInfo});
 const patch={required_skills:job.requiredSkills,preferred_skills:job.preferredSkills,required_certifications:job.requiredCertifications,preferred_certifications:job.preferredCertifications,reference_info};
 if(Object.entries(patch).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(old[key])))patches.push({id:job.id,title:job.title,updatedAt:old.updated_at,patch});
}
const beforeUnique=new Set(backup.tables.jobs.flatMap(job=>[...job.required_skills,...job.preferred_skills]));
const afterUnique=new Set(stage.jobs.flatMap(job=>[...job.requiredSkills,...job.preferredSkills]));
const summary={backup:latest.filename,jobs:stage.jobs.length,updatedJobs:patches.length,beforeUniqueSkills:beforeUnique.size,afterUniqueSkills:afterUnique.size,dictionarySkills:stage.entries.skill.length,dictionaryCertifications:stage.entries.certification.length,newSkills:[...afterUnique].filter(skill=>!beforeUnique.has(skill)),removedOrMerged:[...beforeUnique].filter(skill=>!afterUnique.has(skill)),reparseFallback:stage.fallback};
await writeFile(new URL('.data-backups/taxonomy-plan.json',root),JSON.stringify({summary,patches},null,2));console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--apply'))process.exit(0);
const {supabase}=JSON.parse(await readFile(new URL('supabase-config.json',root)));
async function request(path,method='GET',body,prefer='return=representation'){
 const response=await fetch(`${supabase.url}/rest/v1/${path}`,{method,headers:{apikey:supabase.key,Authorization:`Bearer ${supabase.key}`,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();if(!response.ok)throw Error(`${method} ${path}: ${response.status} ${text}`);return text?JSON.parse(text):[];
}
async function all(table,select='*'){
 const rows=[];for(let offset=0;;offset+=200){const page=await request(`${table}?select=${select}&order=${table==='job_skills'?'job_id,skill_id,skill_type':'id'}&limit=200&offset=${offset}`);rows.push(...page);if(page.length<200)return rows;}
}
const current=await all('jobs','id,updated_at');assert.equal(current.length,backup.tables.jobs.length);
for(const old of backup.tables.jobs)assert.equal(current.find(row=>row.id===old.id)?.updated_at,old.updated_at,'Jobs changed since backup');
const categories=[...new Map(Object.entries(stage.entries).flatMap(([type,entries])=>entries.map(entry=>[`${type}:${entry.category}`,{dictionary_type:type,category:entry.category,color:entry.color,sort_order:0}]))).values()];
await request('dictionary_categories?on_conflict=dictionary_type,category','POST',categories,'resolution=merge-duplicates,return=minimal');
const savedCategories=await all('dictionary_categories');
const terms=Object.entries(stage.entries).flatMap(([type,entries])=>entries.map((entry,index)=>({dictionary_type:type,term:entry.term,category_id:savedCategories.find(category=>category.dictionary_type===type&&category.category===entry.category).id,sort_order:index})));
await request('dictionary_terms?on_conflict=dictionary_type,term','POST',terms,'resolution=merge-duplicates,return=minimal');
for(let index=0;index<patches.length;index++){
 const target=patches[index];const saved=await request(`jobs?id=eq.${target.id}&updated_at=eq.${encodeURIComponent(target.updatedAt)}`,'PATCH',target.patch);
 assert.equal(saved.length,1,'Job changed during update');for(const [key,value] of Object.entries(target.patch))assert.equal(JSON.stringify(saved[0][key]),JSON.stringify(value),'Update mismatch');
 if(index%200===0)console.log('Updated',index+1,'/',patches.length);
}
const names=[...afterUnique];
await request('skills?on_conflict=name','POST',names.map(name=>({name,normalized_name:name.toLowerCase()})),'resolution=merge-duplicates,return=minimal');
const skills=await all('skills');const ids=new Map(skills.map(skill=>[skill.name,skill.id]));const links=[];
for(const job of stage.jobs)for(const type of ['required','preferred'])for(const name of job[type+'Skills'])links.push({job_id:job.id,skill_id:ids.get(name),skill_type:type});
for(let offset=0;offset<stage.jobs.length;offset+=150)await request(`job_skills?job_id=in.(${stage.jobs.slice(offset,offset+150).map(job=>job.id).join(',')})`,'DELETE',undefined,'return=minimal');
for(let offset=0;offset<links.length;offset+=500)await request('job_skills?on_conflict=job_id,skill_id,skill_type','POST',links.slice(offset,offset+500),'resolution=ignore-duplicates,return=minimal');
const stored=await all('jobs');const storedById=new Map(stored.map(job=>[job.id,job]));assert.equal(stored.length,backup.tables.jobs.length);
for(const old of backup.tables.jobs){
 const row=storedById.get(old.id);assert.ok(row);
 for(const key of ['title','description','annual_income_raw','annual_income_min','annual_income_max','source_url','company_id','location'])assert.equal(row[key],old[key],`Unexpected change: ${key}`);
 const original=JSON.parse(old.reference_info.slice(old.reference_info.indexOf('\n')+1));const archive=JSON.parse(row.reference_info.slice(row.reference_info.indexOf('\n')+1));
 assert.equal(JSON.stringify(archive.sourceDocument),JSON.stringify(original.sourceDocument),'Full source changed');assert.equal(JSON.stringify(archive.salaryEstimate),JSON.stringify(original.salaryEstimate),'Salary estimate changed');
}
for(const target of patches)for(const [key,value] of Object.entries(target.patch))assert.equal(JSON.stringify(storedById.get(target.id)[key]),JSON.stringify(value));
const storedLinks=await all('job_skills');assert.equal(storedLinks.length,links.length);const linkSet=new Set(storedLinks.map(link=>`${link.job_id}:${link.skill_id}:${link.skill_type}`));for(const link of links)assert.ok(linkSet.has(`${link.job_id}:${link.skill_id}:${link.skill_type}`));
// Remove obsolete aliases and terms only after new contents and associations are verified.
const keep=new Set(terms.map(term=>`${term.dictionary_type}:${term.term}`));const obsolete=backup.tables.dictionary_terms.filter(term=>!keep.has(`${term.dictionary_type}:${term.term}`));
for(let offset=0;offset<obsolete.length;offset+=100)await request(`dictionary_terms?id=in.(${obsolete.slice(offset,offset+100).map(term=>term.id).join(',')})`,'DELETE',undefined,'return=minimal');
const used=new Set(storedLinks.map(link=>link.skill_id));const orphans=skills.filter(skill=>!used.has(skill.id));
for(let offset=0;offset<orphans.length;offset+=100)await request(`skills?id=in.(${orphans.slice(offset,offset+100).map(skill=>skill.id).join(',')})`,'DELETE',undefined,'return=minimal');
const result={...summary,skillLinks:links.length,obsoleteDictionaryTerms:obsolete.length,unusedSkillRows:orphans.length,verifiedAt:new Date().toISOString()};await writeFile(new URL('.data-backups/taxonomy-result.json',root),JSON.stringify(result,null,2));console.log('VERIFIED',JSON.stringify(result));
