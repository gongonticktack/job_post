import {readFile} from 'node:fs/promises';
const c=JSON.parse(await readFile('supabase-config.json','utf8')).supabase;
const rows=JSON.parse(await readFile('artifacts/location/before.json','utf8'));
const target=rows.find(r=>r.location.startsWith('希望用】'));
const r=await fetch(c.url+'/rest/v1/jobs?select=id,title,location,reference_info,source_url&id=eq.'+target.id,{headers:{apikey:c.key,Authorization:'Bearer '+c.key}});
if(!r.ok)throw Error(r.status);
const [job]=await r.json();
const archive=job.reference_info.startsWith('JOB_SOURCE_ARCHIVE_V1\n')?JSON.parse(job.reference_info.split('\n').slice(1).join('\n')).sourceDocument:null;
console.log(JSON.stringify({id:job.id,title:job.title,url:job.source_url,tail:archive?.fullText?.slice(-3500)},null,2));
