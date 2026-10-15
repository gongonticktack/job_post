import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const ctx = vm.createContext({ console, URL, document: { querySelector: () => null, querySelectorAll: () => [] }, window: {} });
vm.runInContext(await readFile(new URL('../company-parsers.js', import.meta.url), 'utf8'), ctx);
vm.runInContext((await readFile(new URL('../app.js', import.meta.url), 'utf8')).replace(/^init\(\);$/m, ''), ctx);
const before = JSON.parse(await readFile(new URL('../artifacts/location/before.json', import.meta.url), 'utf8'));
const clean = value => { ctx.value = value; return vm.runInContext('cleanJobLocation(value)', ctx); };
const regions = value => { ctx.value = value; return vm.runInContext('getJobRegions({location:value})', ctx); };
// Empty cleanup results require source review rather than deleting a stored value.
const changes = before.map(row => ({ id: row.id, before: row.location, after: clean(row.location) })).filter(row => row.after && row.before !== row.after);
// Confirmed against this row's archived official job text (job_code=557).
const misparsed = before.find(row => row.id === 916 && row.location === '希望用】システムコンサルティング分野');
if (misparsed) changes.push({ id: misparsed.id, before: misparsed.location, after: '東京（高輪）／大阪／名古屋' });
const unknown = [...new Set(before.filter(row => regions(row.location).includes('地域未取得')).map(row => row.location))];
await writeFile(new URL('../artifacts/location/changes.json', import.meta.url), JSON.stringify(changes, null, 2));
console.log(JSON.stringify({ total: before.length, changes: changes.length, unknown }, null, 2));

if (process.argv.includes('--apply') || process.argv.includes('--verify')) {
  const { supabase: config } = JSON.parse(await readFile(new URL('../supabase-config.json', import.meta.url), 'utf8'));
  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' };
  let verified = 0;
  for (const change of process.argv.includes('--apply') ? changes : []) {
    const url = `${config.url}/rest/v1/jobs?id=eq.${encodeURIComponent(change.id)}`;
    const get = await fetch(`${url}&select=id,location`, { headers });
    if (!get.ok) throw new Error(`Read failed: ${get.status}`);
    const [current] = await get.json();
    if (current?.location === change.after) { verified++; continue; }
    if (current?.location !== change.before) throw new Error(`Location changed concurrently: ${change.id}`);
    const guard = `${url}&location=eq.${encodeURIComponent(change.before)}`;
    const patch = await fetch(guard, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ location: change.after }) });
    if (!patch.ok || (await patch.json()).length !== 1) throw new Error(`Update failed: ${change.id}`);
    const check = await fetch(`${url}&select=id,location`, { headers });
    if (!check.ok || (await check.json())[0]?.location !== change.after) throw new Error(`Verification failed: ${change.id}`);
    verified++;
  }
  if (process.argv.includes('--apply')) console.log(`Verified location-only updates: ${verified}/${changes.length}`);
  const after = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(`${config.url}/rest/v1/jobs?select=id,location&order=id&offset=${offset}&limit=500`, { headers });
    if (!response.ok) throw new Error(`Final read failed: ${response.status}`);
    const page = await response.json();
    after.push(...page);
    if (page.length < 500) break;
  }
  if (after.length !== before.length || before.some(row => !after.some(current => current.id === row.id))) throw new Error('Job IDs changed');
  const expected = new Map(changes.map(row => [row.id, row.after]));
  for (const row of before) {
    if (after.find(current => current.id === row.id).location !== (expected.get(row.id) ?? row.location)) throw new Error(`Final mismatch: ${row.id}`);
  }
  await writeFile(new URL('../artifacts/location/after.json', import.meta.url), JSON.stringify(after, null, 2));
  console.log(JSON.stringify({ verified: after.length, changed: changes.length, unknown: after.filter(row => regions(row.location).includes('地域未取得')).length }));
}
