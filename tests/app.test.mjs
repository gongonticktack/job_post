import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app = await readFile(new URL('../app.js', import.meta.url),'utf8');
const config = await readFile(new URL('../company-parsers.js', import.meta.url),'utf8');
function setup() {
  const ctx=vm.createContext({console,URL,document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{}});
  vm.runInContext(config,ctx);
  vm.runInContext(app.replace(/^init\(\);$/m,''),ctx);
  vm.runInContext(`
    var stored = [], writes = [], requests = [];
    getAllLocalJobs = async () => stored;
    saveLocalJobs = async jobs => { for (const j of jobs) { stored = stored.filter(old => old.sourceUrl !== j.sourceUrl); stored.push(j); writes.push(j); } };
    deleteLocalJob = async url => { stored = stored.filter(j => j.sourceUrl !== url); };
    var base = {company: '株式会社NTTデータ', title:'エンジニア', description:'開発', location:'東京', requiredSkills:['Java'], preferredSkills:[], sourceUrl:'https://jobs.example/detail?id=1'};
  `,ctx);
  return ctx;
}
test('duplicates are skipped across URL variants and within a batch; timestamps do not change content',async()=>{
 const ctx=setup();const result=await vm.runInContext(`saveJobs([base,{...base,sourceUrl:base.sourceUrl+'&utm_source=mail',crawledAt:'2026-10-12'}, {...base,sourceUrl:'https://jobs.example/detail?id=2'}])`,ctx);
 assert.equal(result.added,1);assert.equal(result.skipped,2);assert.equal(vm.runInContext('stored.length',ctx),1);
});
test('updated skills and certifications replace old content; distinct jobs and companies remain',async()=>{
 const ctx=setup();await vm.runInContext('saveJobs([base])',ctx);
 const result=await vm.runInContext(`saveJobs([{...base,requiredSkills:['Python'],requiredCertifications:'PMP'}, {...base,title:'別職種',sourceUrl:'https://jobs.example/detail?id=2'}, {...base,company:'NEC',sourceUrl:'https://jobs.example/detail?id=3'}])`,ctx);
 assert.equal(result.updated,1);assert.equal(result.added,2);assert.equal(vm.runInContext('stored[0].requiredCertifications',ctx),'PMP');
 assert.equal(vm.runInContext('stored.length',ctx),3);
});
test('manual revisions replace content-derived storage keys',async()=>{
 const ctx=setup();await vm.runInContext(`saveJobs([{...base,sourceUrl:'manual:old'}])`,ctx);
 const result=await vm.runInContext(`saveJobs([{...base,description:'変更後',sourceUrl:'manual:new'}])`,ctx);
 assert.equal(result.updated,1);assert.equal(vm.runInContext('stored.length',ctx),1);assert.equal(vm.runInContext('stored[0].description',ctx),'変更後');
});
test('Supabase skills are replaced and persistence failures are not reported as local success',async()=>{
 const ctx=setup();vm.runInContext(`state.supabase={url:'https://example.supabase.co',key:'test'}; getSupabaseJobs=async()=>[];
 supabaseRequest=async(path,options)=>{ requests.push([path,options]);return [{id:1}]; };`,ctx);
 await vm.runInContext('saveJobs([base])',ctx);
 const paths=vm.runInContext('requests.map(r=>r[0])',ctx);
 assert(paths.some(p=>p.startsWith('job_skills?job_id=eq.')));
 vm.runInContext(`supabaseRequest=async()=>{throw new Error('offline')}`,ctx);
 await assert.rejects(vm.runInContext('saveJobs([base])',ctx),/offline/);
 assert.equal(vm.runInContext('stored.length',ctx),0);
});
test('company selection fills every configured list URL and permits custom input',()=>{
 const ctx=setup();vm.runInContext(`els.crawlCompanySelect={value:'NEC'};els.companyName={};els.crawlUrl={};syncCompanySelect(els.crawlCompanySelect,els.companyName)`,ctx);
 assert.equal(vm.runInContext('els.crawlUrl.value',ctx),'https://jobs.nec-careers.com/u/job.phtml');
 assert.equal(vm.runInContext('Object.values(window.JobParserConfig.companies).filter(c=>!c.listUrl).length',ctx),0);
});
test('JavaScript does not imply Java and Go does not match English word fragments',()=>{
 const ctx=setup();const result=vm.runInContext(`extractSkillsFromText('JavaScript development with Google Cloud')`,ctx);
 assert(result.includes('JavaScript'));assert(!result.includes('Java'));assert(!result.includes('Go'));
});
test('region filter supports multiple locations and combines with income and search',()=>{
 const ctx=setup();
 vm.runInContext(`els.searchInput={value:''};state.regionFilter='東京都';
 var regionJobs=[{...base,location:'東京都 / 愛知県',annualIncomeMin:600,annualIncomeMax:900},{...base,location:'大阪府',annualIncomeMin:700,annualIncomeMax:1000}];`,ctx);
 assert.equal(vm.runInContext('filterJobs(regionJobs).length',ctx),1);
 vm.runInContext('state.incomeFilter={min:1000,max:1500}',ctx);
 assert.equal(vm.runInContext('filterJobs(regionJobs).length',ctx),0);
 assert.equal(vm.runInContext(`getJobRegions({location:''})[0]`,ctx),'地域未取得');
 assert.equal(vm.runInContext(`getJobRegions({location:'東京都'}).includes('京都府')`,ctx),false);
});
test('prefecture facets normalize cities and offices without exposing raw text or future travel',()=>{
 const ctx=setup();
 const regions=location=>JSON.parse(vm.runInContext(`JSON.stringify(getJobRegions({location:${JSON.stringify(location)}}))`,ctx));
 assert.deepEqual(regions('Tokyo / Osaka / Yokohama / Aizuwakamatsu / Maebashi'),['福島県','群馬県','東京都','神奈川県','大阪府']);
 assert.deepEqual(regions('Fujitsu Uvance Kawasaki Tower'),['神奈川県']);
 assert.deepEqual(regions('Ｆｕｊｉｔｓｕ Ｔｅｃｈｎｏｌｏｇｙ Ｐａｒｋ'),['神奈川県']);
 assert.deepEqual(regions('東京・横浜 その他参考URL 大阪 https://example.com'),['東京都','神奈川県']);
 assert.deepEqual(regions('東京（高輪） ※将来的に海外駐在となる可能性があります'),['東京都']);
 assert.deepEqual(regions('東京（品川）、西日本拠点（大阪、名古屋）への出張あり'),['東京都']);
 assert.deepEqual(regions('首都圏'),['全国・広域']);
 assert.deepEqual(regions('日本'),['全国・広域']);
 assert.deepEqual(regions('ソウル* 応募方法 ご連絡ください'),['海外']);
 assert.deepEqual(regions('不明なビル'),['地域未取得']);
 assert(!regions('東京都府中市').includes('京都府'));
});

test('location cleanup removes navigation and manual parsing skips title mentions',()=>{
 const ctx=setup();
 assert.equal(vm.runInContext(`cleanJobLocation('横浜 【その他参考URL】 https://example.com この職種へ応募 職種一覧へ戻る')`,ctx),'横浜');
 assert.equal(vm.runInContext(`cleanJobLocation('神奈川県川崎市 この職種へ応募 / Apply for this job 関連タグ')`,ctx),'神奈川県川崎市');
 assert.equal(vm.runInContext(`parseManualJobText('【複数勤務地希望用】システムコンサルティング分野\\n職務内容\\n開発\\n勤務地\\n東京・横浜\\nこの職種へ応募\\n職種一覧へ戻る','株式会社野村総合研究所',{forceCompany:true}).location`,ctx),'東京・横浜');
});

test('qualifications exclude products and role names, normalize aliases, and avoid duplicate prefixes',()=>{
 const ctx=setup();
 const result=vm.runInContext(`extractCertificationsFromText('SAP S/4HANAやAnaplanを利用。プロジェクトマネージャとして勤務。PMP、応用情報処理技術者の資格を保有。AWS Certified Solutions Architect - Associate')`,ctx);
 assert(!result.includes('SAP S/4HANA'));assert(!result.includes('Anaplan'));
 assert(!result.includes('プロジェクトマネージャ'));assert(result.includes('PMP'));assert(result.includes('応用情報技術者'));
 assert.equal(result.filter(s=>s.includes('AWS Certified Solutions Architect')).length,1);
});
test('requirement repair splits MUST/WANT, normalizes fullwidth code names, and preserves raw evidence',()=>{
 const ctx=setup();
 const job=vm.runInContext(`repairJobRequirements({...base,requiredCertifications:'【MUST】ＪａｖａＳｃｒｉｐｔ、Ｃ＋＋による開発経験5年以上。顧客への提案経験とスキルがあること。【WANT】Python、PMP資格',preferredCertifications:''})`,ctx);
 assert(job.requiredSkills.includes('JavaScript'));assert(job.requiredSkills.includes('C++'));assert(!job.requiredSkills.includes('Java'));
 assert(!job.requiredSkills.includes('Python'));assert(job.preferredSkills.includes('Python'));assert.equal(job.preferredCertifications,'PMP');
 assert(job.referenceInfo.includes('応募条件原文'));
 const again=vm.runInContext(`repairJobRequirements(repairJobRequirements({...base,requiredCertifications:'',preferredCertifications:''}))`,ctx);
 assert(again.requiredSkills.includes('Java'));
});
test('domain review removes non-IT operations while retaining IT sales and uncertain jobs',()=>{
 const ctx=setup();
 assert.equal(vm.runInContext(`classifyJobDomain({title:'業務BPO運用',description:'オペレータのチーム管理'})`,ctx),'non-it');
 assert.equal(vm.runInContext(`classifyJobDomain({title:'ソリューション営業',description:'ITシステムの提案'})`,ctx),'it');
 assert.equal(vm.runInContext(`classifyJobDomain({title:'プロジェクトマネージャ',description:''})`,ctx),'review');
});
test('sales filter includes IT sales, accounts and presales while retaining sales-system developers',()=>{
 const ctx=setup();
 for(const title of ['ソリューション営業','アカウントマネージャー','ソリューションスペシャリスト兼アカウント担当','Linux/AI関連OSSのプリセールスエンジニア','Technical Sales Engineer']){
  ctx.title=title;assert.equal(vm.runInContext('isSalesJob({title})',ctx),true,title);
 }
 ctx.title='SCM・営業領域アプリケーションスペシャリスト';assert.equal(vm.runInContext('isSalesJob({title})',ctx),false);
});
test('source archive survives database serialization without exposing encoded metadata as reference text',()=>{
 const ctx=setup();
 vm.runInContext(`var archived={...base,referenceInfo:'参考情報',sourceDocument:{format:'html',fullText:'応募条件\\nPython\\n資格\\nPMP',html:'<h2>応募条件</h2><p>Python</p>',sourceUrl:base.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z'}};
 var dbArchive=toDbJob(archived,1);var roundTrip=toClientJob({...dbArchive,companies:{name:base.company}});`,ctx);
 assert.equal(vm.runInContext('roundTrip.sourceDocument.fullText',ctx),'応募条件\nPython\n資格\nPMP');
 assert.equal(vm.runInContext('roundTrip.referenceInfo',ctx),'参考情報');
 assert.equal(vm.runInContext('roundTrip.sourceDocument.html===archived.sourceDocument.html',ctx),true);
 assert.equal(vm.runInContext(`jobContentKey(archived)===jobContentKey({...archived,sourceDocument:{...archived.sourceDocument,fullText:'変更後'}})`,ctx),false);
});
test('official-source parsing retains employer when client names occur in job text',()=>{
 const ctx=setup();
 ctx.sourceText='トヨタ自動車の案件を担当\n【募集範囲と具体的業務内容】\nJavaで開発\n【必須の経験・キャリアや資格・言語】\nJavaの経験';
 assert.equal(vm.runInContext(`parseManualJobText(sourceText,'富士通株式会社',{forceCompany:true}).company`,ctx),'富士通株式会社');
});

test('database loading reads beyond the default 1000-row cap and preserves every archive',async()=>{
 const ctx=setup();
 vm.runInContext(`supabaseRequest=async path=>{
  requests.push(path);
  const offset=Number(new URL('https://example.test/'+path).searchParams.get('offset'));
  const limit=Number(new URL('https://example.test/'+path).searchParams.get('limit'));
  return Array.from({length:Math.min(limit,1203-offset)},(_,i)=>({id:offset+i,source_url:'https://example.test/job/'+(offset+i),companies:{name:'NEC'},reference_info:encodeJobReference({sourceDocument:{format:'html',fullText:'Full source '+(offset+i)}})}));
 };`,ctx);
 const jobs=await vm.runInContext('getSupabaseJobs()',ctx);
 assert.equal(jobs.length,1203);
 assert.equal(jobs[1202].sourceDocument.fullText,'Full source 1202');
 assert.equal(vm.runInContext('requests.length',ctx),7);
});

test('summary loading excludes archives and publishes each page before requesting the next',async()=>{
 const ctx=setup();
 vm.runInContext(`var pages=[];
 supabaseRequest=async path=>{
  requests.push(path);
  const query=new URL('https://example.test/'+path).searchParams;
  if(Number(query.get('offset'))===200) {
   if(pages.length!==1 || pages[0].length!==200) throw Error('First page was not published');
   return [{id:201,title:'後続求人',description:'検索対象の本文',companies:{name:'NEC'}}];
  }
  return Array.from({length:200},(_,id)=>({id,title:'開発',companies:{name:'NEC'}}));
 };`,ctx);
 const jobs=await vm.runInContext('getSupabaseJobs({summaryOnly:true,onPage:jobs=>pages.push(jobs)})',ctx);
 assert.equal(jobs.length,201);assert.equal(jobs[200].description,'検索対象の本文');
 assert.equal(jobs[200].archivePending,true);assert.equal(jobs[200].sourceDocument,null);
 assert.equal(vm.runInContext('pages[0].length',ctx),200);
 for(const path of vm.runInContext('requests',ctx)){
  const select=new URL('https://example.test/'+path).searchParams.get('select');
  assert(!select.includes('*'));assert(!select.includes('reference_info'));assert(select.includes('required_skills'));
 }
});

test('archive requests are shared, cached and retryable without losing summary fields',async()=>{
 const ctx=setup();
 vm.runInContext(`var job={id:42,title:'開発',archivePending:true};
 supabaseRequest=async path=>{requests.push(path);throw Error('offline')};`,ctx);
 await assert.rejects(vm.runInContext('ensureJobArchive(job)',ctx),/offline/);
 assert.equal(vm.runInContext('job.archivePending',ctx),true);
 vm.runInContext(`supabaseRequest=async path=>{requests.push(path);return [{reference_info:encodeJobReference({referenceInfo:'条件',sourceDocument:{fullText:'全文'}})}]};`,ctx);
 await vm.runInContext('Promise.all([ensureJobArchive(job),ensureJobArchive(job)])',ctx);
 await vm.runInContext('ensureJobArchive(job)',ctx);
 assert.equal(vm.runInContext('requests.length',ctx),2);
 assert.equal(vm.runInContext('job.title',ctx),'開発');
 assert.equal(vm.runInContext('job.sourceDocument.fullText',ctx),'全文');
 assert.equal(vm.runInContext('job.referenceInfo',ctx),'条件');
 assert.equal(vm.runInContext('job.archivePending',ctx),false);
});

test('partial loading errors keep displayed remote jobs instead of replacing them with local data',async()=>{
 const ctx=setup();
 vm.runInContext(`state.supabase={};var rendered=0;var statuses=[];
 render=()=>rendered++;setStatus=message=>statuses.push(message);setJobLoadStatus=message=>statuses.push(message);
 getSupabaseJobs=async({onPage})=>{await onPage([{id:1,title:'取得済み'}]);throw Error('offline')};
 getAllLocalJobs=async()=>{throw Error('Must not replace partial remote results')};`,ctx);
 await vm.runInContext('refresh()',ctx);
 assert.equal(vm.runInContext('state.jobs[0].title',ctx),'取得済み');
 assert.equal(vm.runInContext('rendered',ctx),1);
 assert(vm.runInContext('statuses.some(s=>s.includes("一部"))',ctx));
});

test('employee salary estimates use role evidence, preserve advertised pay and round-trip separately',()=>{
 const ctx=setup();
 const estimate=vm.runInContext(`estimateMissingIncome({company:'アクセンチュア株式会社',title:'クラウドエンジニア'})`,ctx);
 assert.equal(estimate.center,750);assert.equal(estimate.min,550);assert.equal(estimate.max,950);
 assert.equal(estimate.role,'engineer');assert.equal(estimate.sampleCount,718);
 assert.equal(vm.runInContext(`estimateMissingIncome({company:'アクセンチュア株式会社',title:'エンジニア / コンサルタント'}).role`,ctx),'overall');
 assert.equal(vm.runInContext(`estimateMissingIncome({company:'日本IBM',title:'Research Student Intern'})`,ctx),null);
 assert.equal(vm.runInContext(`estimateMissingIncome({company:'日本IBM',title:'Researcher'}).role`,ctx),'overall');
 assert.equal(vm.runInContext(`estimateMissingIncome({company:'アクセンチュア株式会社',title:'エンジニア',annualIncomeMin:500})`,ctx),null);
 assert.equal(vm.runInContext(`estimateMissingIncome({company:'未調査の会社',title:'エンジニア'})`,ctx),null);
 vm.runInContext(`var salaryJob=normalizeClientJob({...base,company:'アクセンチュア株式会社',title:'クラウドエンジニア',annualIncomeMin:null,annualIncomeMax:null,annualIncomeRaw:'',sourceDocument:{format:'html',fullText:'給与は応相談'}});
 var salaryRow=toDbJob(salaryJob,1);var loadedSalary=toClientJob({...salaryRow,company:salaryJob.company});`,ctx);
 assert.equal(vm.runInContext('salaryRow.annual_income_min',ctx),null);
 assert.equal(vm.runInContext('salaryRow.annual_income_raw',ctx),'');
 assert.equal(vm.runInContext('JSON.parse(salaryRow.reference_info.slice(SOURCE_ARCHIVE_PREFIX.length)).salaryEstimate.center',ctx),750);
 assert.equal(vm.runInContext('loadedSalary.sourceDocument.fullText',ctx),'給与は応相談');
 assert.equal(vm.runInContext('getJobIncomeRange(loadedSalary).min',ctx),550);
 assert.equal(vm.runInContext('getJobAverageIncome(loadedSalary)',ctx),750);
 assert.equal(vm.runInContext('getJobIncomeDisplay(loadedSalary)',ctx),'推定 550〜950万円');
 assert.equal(vm.runInContext(`normalizeClientJob({...loadedSalary,annualIncomeMin:600,annualIncomeMax:900,annualIncomeRaw:'600〜900万円'}).salaryEstimate`,ctx),null);
});

test('taxonomy merges synonyms, removes vague tags and does not confuse technical subjects with exams',()=>{
 const ctx=setup();vm.runInContext('normalizeLoadedSkillDictionary(window.JobParserConfig);normalizeLoadedCertificationDictionary(window.JobParserConfig);',ctx);
 const list=vm.runInContext(`extractSkillsFromText('AWS、Amazon Web Services、K8s、Kubernetes、Spring Boot、JavaScript、C++、C#、ネットワーク、データベースの経験。開発、設計、導入、運用。AWS Certified Solutions Architect - Associate資格',getCompanyParser())`,ctx);
 assert.equal(list.filter(x=>x==='AWS').length,1);assert.equal(list.filter(x=>x==='Kubernetes').length,1);
 assert(list.includes('Spring Boot')&&!list.includes('Spring'));assert(!list.includes('Java')&&list.includes('JavaScript'));
 assert(list.includes('ネットワーク')&&list.includes('データベース'));assert(!list.includes('C言語'));
 assert(!list.includes('開発')&&!list.includes('設計')&&!list.includes('導入'));
 const onlyCert=vm.runInContext(`extractSkillsFromText('AWS Certified Solutions Architect - Associate資格、PMP資格')`,ctx);assert.equal(onlyCert.length,0);
 const entries=vm.runInContext(`normalizeDictionaryEntries(['K8s','Kubernetes','アジャイル開発','アジャイル','開発','課題解決能力','課題解決'],'skill')`,ctx);
 assert.equal(entries.length,3);
 const certs=vm.runInContext(`extractCertificationsFromText('認定スクラムマスター（CSM）、ITIL Foundation資格、TOEIC 750点以上、CCNA、CCNP')`,ctx);
 assert(certs.includes('Certified ScrumMaster'));assert(certs.includes('ITIL Foundation'));assert(!certs.includes('ITIL'));assert(certs.includes('TOEIC 750点以上'));assert(certs.includes('CCNA')&&certs.includes('CCNP'));
 const repaired=vm.runInContext(`repairJobRequirements({...base,referenceInfo:buildRequirementReference('','K8sの経験','KubernetesとPythonの経験')})`,ctx);
 assert(repaired.requiredSkills.includes('Kubernetes'));assert(!repaired.preferredSkills.includes('Kubernetes'));assert(repaired.preferredSkills.includes('Python'));
 const normalized=vm.runInContext(`normalizeClientJob({...base,requiredSkills:['K8s'],preferredSkills:['Kubernetes']})`,ctx);assert.equal(normalized.preferredSkills.length,0);
 vm.runInContext(`window.JobParserConfig.defaultCertificationDictionary=['PMP'];window.JobParserConfig.certificationDictionary=['CCNA'];normalizeLoadedCertificationDictionary(window.JobParserConfig)`,ctx);
 assert.equal(vm.runInContext('window.JobParserConfig.certificationDictionary.join()',ctx),'CCNA');
 vm.runInContext(`window.JobParserConfig.certificationDictionary=[];normalizeLoadedCertificationDictionary(window.JobParserConfig)`,ctx);
 assert.equal(vm.runInContext('window.JobParserConfig.certificationDictionary.length',ctx),0);
});

test('dictionary save failure retains old terms, and pruning covers jobs beyond 1000 rows',async()=>{
 const ctx=setup();
 vm.runInContext(`state.supabase={url:'https://example.test',key:'test'};
 saveDictionaryCategories=async()=>[{id:1,dictionary_type:'skill',category:'general'},{id:2,dictionary_type:'certification',category:'certification'}];
 supabaseRequest=async(path,options)=>{requests.push([path,options?.method]);if(path.startsWith('dictionary_terms?on_conflict'))throw Error('write failed');return [{id:9,dictionary_type:'skill',term:'OldSkill'}];};`,ctx);
 await assert.rejects(()=>vm.runInContext(`saveDictionaryTerms([{term:'NewSkill',category:'general'}],[])`,ctx),/write failed/);
 assert.equal(vm.runInContext(`requests.some(row=>row[1]==='DELETE')`,ctx),false);
 vm.runInContext(`requests=[];supabaseRequest=async path=>{requests.push(path);const offset=new URL('https://example.test/'+path).searchParams.get('offset');return Array.from({length:offset==='0'?1000:203},(_,i)=>({id:i,required_skills:['AWS'],preferred_skills:[]}));};`,ctx);
 await vm.runInContext(`pruneSupabaseJobSkillsOutsideDictionary(['AWS'])`,ctx);
 assert.equal(vm.runInContext('requests.length',ctx),2);
});
