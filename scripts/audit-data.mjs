import { readFile, writeFile, mkdir } from 'node:fs/promises';
const { supabase } = JSON.parse(await readFile(new URL('../supabase-config.json', import.meta.url)));
const headers = { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` };
const tables = ['companies', 'jobs', 'skills', 'job_skills', 'dictionary_terms', 'dictionary_categories', 'company_parser_configs'];
const backup = { createdAt: new Date().toISOString(), tables: {} };
for (const table of tables) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${supabase.url}/rest/v1/${table}?select=*&limit=1000&offset=${offset}`, { headers });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const page = await response.json(); rows.push(...page);
    if (page.length < 1000) break;
  }
  backup.tables[table] = rows;
}
const directory = new URL('../.data-backups/', import.meta.url);
await mkdir(directory, { recursive: true });
const filename = `before-cleanup-${Date.now()}.json`;
await writeFile(new URL(filename, directory), JSON.stringify(backup, null, 2));
await writeFile(new URL('latest.json', directory), JSON.stringify({ filename }));
console.log('Backup:', '.data-backups/' + filename);
console.log('Counts:', Object.fromEntries(tables.map((table) => [table, backup.tables[table].length])));
for (const job of process.argv.includes('--summary') ? [] : backup.tables.jobs) {
  console.log(JSON.stringify({ id: job.id, title: job.title, company: backup.tables.companies.find(c => c.id === job.company_id)?.name,
    skills: job.required_skills, preferred: job.preferred_skills, cert: job.required_certifications, preferredCert: job.preferred_certifications,
    source: job.source_url, description: job.description.slice(0, 180) }));
}
