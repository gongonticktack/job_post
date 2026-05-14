"use strict";

const DB_NAME = "job-post-analytics";
const DB_VERSION = 1;
const STORE = "jobs";
const DICTIONARY_STORAGE_KEY = "job-post-dictionaries";

const state = {
  jobs: [],
  db: null,
  supabase: null,
  manualDraft: null
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  settingsButton: document.querySelector(".settings-button"),
  views: document.querySelectorAll(".view"),
  jobCount: document.querySelector("#jobCount"),
  companyCount: document.querySelector("#companyCount"),
  avgIncome: document.querySelector("#avgIncome"),
  skillTypeFilter: document.querySelector("#skillTypeFilter"),
  skillChart: document.querySelector("#skillChart"),
  certificationChart: document.querySelector("#certificationChart"),
  searchInput: document.querySelector("#searchInput"),
  jobList: document.querySelector("#jobList"),
  crawlForm: document.querySelector("#crawlForm"),
  crawlCompanySelect: document.querySelector("#crawlCompanySelect"),
  crawlUrl: document.querySelector("#crawlUrl"),
  companyName: document.querySelector("#companyName"),
  crawlLimit: document.querySelector("#crawlLimit"),
  crawlStatus: document.querySelector("#crawlStatus"),
  crawlPreview: document.querySelector("#crawlPreview"),
  manualForm: document.querySelector("#manualForm"),
  manualCompanySelect: document.querySelector("#manualCompanySelect"),
  manualCompanyName: document.querySelector("#manualCompanyName"),
  manualText: document.querySelector("#manualText"),
  manualStatus: document.querySelector("#manualStatus"),
  manualPreview: document.querySelector("#manualPreview"),
  manualEditor: document.querySelector("#manualEditor"),
  parseSampleButton: document.querySelector("#parseSampleButton"),
  dictionaryForm: document.querySelector("#dictionaryForm"),
  skillDictionaryInput: document.querySelector("#skillDictionaryInput"),
  certificationDictionaryInput: document.querySelector("#certificationDictionaryInput"),
  dictionaryStatus: document.querySelector("#dictionaryStatus"),
  resetDictionaryButton: document.querySelector("#resetDictionaryButton"),
  settingsJobStatus: document.querySelector("#settingsJobStatus"),
  settingsJobList: document.querySelector("#settingsJobList"),
  template: document.querySelector("#jobCardTemplate")
};

init();

async function init() {
  state.db = await openDb();
  state.supabase = await loadSupabaseConfig();
  await loadParserSettings();
  await loadDictionarySettings();
  bindEvents();
  await refresh();
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  els.settingsButton.addEventListener("click", () => switchView("settings"));
  els.skillTypeFilter.addEventListener("change", render);
  els.searchInput.addEventListener("input", render);
  [els.skillChart, els.certificationChart].forEach((chart) => {
    chart.addEventListener("click", (event) => {
      if (event.target === chart && els.searchInput.value.trim()) {
        els.searchInput.value = "";
        render();
      }
    });
  });
  syncCompanySelect(els.crawlCompanySelect, els.companyName);
  syncCompanySelect(els.manualCompanySelect, els.manualCompanyName);
  els.crawlCompanySelect.addEventListener("change", () => syncCompanySelect(els.crawlCompanySelect, els.companyName));
  els.manualCompanySelect.addEventListener("change", () => syncCompanySelect(els.manualCompanySelect, els.manualCompanyName));
  els.crawlForm.addEventListener("submit", handleCrawl);
  els.manualForm.addEventListener("submit", handleManualPreview);
  els.parseSampleButton.addEventListener("click", handleManualPreview);
  els.dictionaryForm.addEventListener("submit", handleDictionarySave);
  els.resetDictionaryButton.addEventListener("click", resetDictionarySettings);
}

async function loadDictionarySettings() {
  const config = window.JobParserConfig;
  if (!config) return;
  config.defaultSkillDictionary = [...(config.skillDictionary || [])];
  config.defaultCertificationDictionary = [...(config.certificationDictionary || [])];
  if (state.supabase) {
    try {
      const remote = await getDictionaryTerms();
      if (!remote.skillDictionary.length && !remote.certificationDictionary.length) {
        await saveDictionaryTerms(config.defaultSkillDictionary, config.defaultCertificationDictionary);
      }
      if (remote.skillDictionary.length) config.skillDictionary = remote.skillDictionary;
      if (remote.certificationDictionary.length) config.certificationDictionary = remote.certificationDictionary;
      return;
    } catch (error) {
      console.warn("dictionary settings remote load failed", error);
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DICTIONARY_STORAGE_KEY) || "{}");
    if (Array.isArray(saved.skillDictionary)) config.skillDictionary = saved.skillDictionary;
    if (Array.isArray(saved.certificationDictionary)) config.certificationDictionary = saved.certificationDictionary;
  } catch (error) {
    console.warn("dictionary settings load failed", error);
  }
}

async function loadParserSettings() {
  const config = window.JobParserConfig;
  if (!config) return;
  config.defaultCompanies = JSON.parse(JSON.stringify(config.companies || {}));
  if (!state.supabase) return;
  try {
    const rows = await supabaseRequest("company_parser_configs?select=company_name,parser_config&enabled=eq.true&order=company_name.asc");
    if (!rows.length) {
      await saveParserConfigs(config.defaultCompanies);
      return;
    }
    config.companies = rows.reduce((acc, row) => {
      acc[row.company_name] = row.parser_config;
      return acc;
    }, {});
  } catch (error) {
    console.warn("parser settings remote load failed", error);
  }
}

async function saveParserConfigs(companies) {
  if (!state.supabase) return;
  const rows = Object.entries(companies || {}).map(([companyName, parserConfig]) => ({
    company_name: companyName,
    parser_config: parserConfig,
    enabled: true
  }));
  if (!rows.length) return;
  await supabaseRequest("company_parser_configs?on_conflict=company_name", {
    method: "POST",
    body: JSON.stringify(rows),
    headers: { prefer: "resolution=merge-duplicates,return=minimal" }
  });
}

async function getDictionaryTerms() {
  const rows = await supabaseRequest("dictionary_terms?select=dictionary_type,term,sort_order&order=dictionary_type.asc,sort_order.asc,term.asc");
  return {
    skillDictionary: rows.filter((row) => row.dictionary_type === "skill").map((row) => row.term),
    certificationDictionary: rows.filter((row) => row.dictionary_type === "certification").map((row) => row.term)
  };
}

async function saveDictionaryTerms(skillDictionary, certificationDictionary) {
  if (!state.supabase) {
    localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify({ skillDictionary, certificationDictionary }));
    return;
  }
  await supabaseRequest("dictionary_terms?dictionary_type=eq.skill", {
    method: "DELETE",
    headers: { prefer: "return=minimal" }
  });
  await supabaseRequest("dictionary_terms?dictionary_type=eq.certification", {
    method: "DELETE",
    headers: { prefer: "return=minimal" }
  });
  const rows = [
    ...skillDictionary.map((term, index) => ({ dictionary_type: "skill", term, sort_order: index })),
    ...certificationDictionary.map((term, index) => ({ dictionary_type: "certification", term, sort_order: index }))
  ];
  if (rows.length) {
    await supabaseRequest("dictionary_terms", {
      method: "POST",
      body: JSON.stringify(rows)
    });
  }
}

async function refresh() {
  if (state.supabase) {
    try {
      state.jobs = await getSupabaseJobs();
      render();
      return;
    } catch (error) {
      setStatus(`Supabase取得に失敗したため、ブラウザ内DBを表示します: ${error.message}`);
    }
  }

  try {
    state.jobs = await getAllLocalJobs();
    if (!state.supabase) {
      setStatus("supabase-config.jsonを読み込めないため、ブラウザ内DBで動作しています。");
    }
  } catch (error) {
    setStatus(`ローカルDBの読み込みに失敗しました: ${error.message}`);
  }
  render();
}

async function saveJobs(jobs) {
  if (state.supabase) {
    try {
      await saveSupabaseJobs(jobs);
      return;
    } catch (error) {
      setStatus(`Supabase保存に失敗したためローカルDBへ保存します: ${error.message}`);
    }
  }
  await saveLocalJobs(jobs);
}

async function loadSupabaseConfig() {
  try {
    const response = await fetch("supabase-config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    const url = config?.supabase?.url;
    const key = config?.supabase?.key;
    if (!url || !key) throw new Error("supabase.url と supabase.key が必要です");
    return { url: url.replace(/\/$/, ""), key };
  } catch (error) {
    console.warn("Supabase config load failed", error);
    return null;
  }
}

async function supabaseRequest(path, options = {}) {
  if (!state.supabase) throw new Error("Supabase config is not loaded");
  const response = await fetch(`${state.supabase.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: state.supabase.key,
      authorization: `Bearer ${state.supabase.key}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = body?.message || body?.hint || response.statusText;
    throw new Error(`Supabase ${response.status}: ${detail} (${path})`);
  }
  return body;
}

async function getSupabaseJobs() {
  const rows = await supabaseRequest("jobs?select=*,companies(name)&order=crawled_at.desc");
  return rows.map(toClientJob);
}

async function saveSupabaseJobs(jobs) {
  for (const job of jobs) {
    if (!job.sourceUrl) continue;
    const companyRows = await supabaseRequest("companies?on_conflict=name", {
      method: "POST",
      body: JSON.stringify({ name: job.company || "未設定" }),
      headers: { prefer: "resolution=merge-duplicates,return=representation" }
    });
    const savedJobRows = await supabaseRequest("jobs?on_conflict=source_url", {
      method: "POST",
      body: JSON.stringify(toDbJob(job, companyRows[0].id)),
      headers: { prefer: "resolution=merge-duplicates,return=representation" }
    });
    const savedJob = savedJobRows[0];
    await saveSupabaseSkills(savedJob.id, job.requiredSkills || [], "required");
    await saveSupabaseSkills(savedJob.id, job.preferredSkills || [], "preferred");
  }
}

async function saveSupabaseSkills(jobId, skills, skillType) {
  const normalizedSkills = [...new Set(skills.map(normalizeSkill).filter(Boolean))];
  for (const name of normalizedSkills) {
    const rows = await supabaseRequest("skills?on_conflict=name", {
      method: "POST",
      body: JSON.stringify({ name, normalized_name: name.toLowerCase() }),
      headers: { prefer: "resolution=merge-duplicates,return=representation" }
    });
    await supabaseRequest("job_skills?on_conflict=job_id,skill_id,skill_type", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, skill_id: rows[0].id, skill_type: skillType }),
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" }
    });
  }
}

function toClientJob(row) {
  return {
    id: row.id,
    company: row.companies?.name || row.company || "",
    title: row.title || "",
    description: row.description || "",
    annualIncomeMin: row.annual_income_min,
    annualIncomeMax: row.annual_income_max,
    annualIncomeRaw: row.annual_income_raw || "",
    requiredSkills: row.required_skills || [],
    preferredSkills: row.preferred_skills || [],
    appealPoints: row.appeal_points || "",
    referenceInfo: row.reference_info || "",
    requiredLanguage: row.required_language || "",
    requiredCertifications: row.required_certifications || "",
    preferredLanguage: row.preferred_language || "",
    preferredCertifications: row.preferred_certifications || "",
    location: row.location || "",
    notes: row.notes || "",
    inputMethod: row.input_method || "",
    sourceUrl: row.source_url || "",
    crawledAt: row.crawled_at
  };
}

function toDbJob(job, companyId) {
  return {
    company_id: companyId,
    title: job.title || "",
    description: job.description || "",
    annual_income_min: Number.isFinite(job.annualIncomeMin) ? job.annualIncomeMin : null,
    annual_income_max: Number.isFinite(job.annualIncomeMax) ? job.annualIncomeMax : null,
    annual_income_raw: job.annualIncomeRaw || "",
    required_skills: Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
    preferred_skills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    appeal_points: job.appealPoints || "",
    reference_info: job.referenceInfo || "",
    required_language: job.requiredLanguage || "",
    required_certifications: job.requiredCertifications || "",
    preferred_language: job.preferredLanguage || "",
    preferred_certifications: job.preferredCertifications || "",
    location: job.location || "",
    notes: job.notes || "",
    input_method: job.inputMethod || "crawl",
    source_url: job.sourceUrl,
    crawled_at: job.crawledAt || new Date().toISOString()
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "sourceUrl" });
        store.createIndex("company", "company", { unique: false });
        store.createIndex("crawledAt", "crawledAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllLocalJobs() {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveLocalJobs(jobs) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    jobs.forEach((job) => store.put({ ...job, crawledAt: job.crawledAt || new Date().toISOString() }));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function deleteLocalJob(sourceUrl) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(sourceUrl);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function deleteJob(job) {
  const label = job.title || job.company || "この求人";
  if (!window.confirm(`${label} を削除しますか？`)) return;

  try {
    if (state.supabase && job.id) {
      await supabaseRequest(`jobs?id=eq.${encodeURIComponent(job.id)}`, {
        method: "DELETE",
        headers: { prefer: "return=minimal" }
      });
    } else if (job.sourceUrl) {
      await deleteLocalJob(job.sourceUrl);
    } else {
      throw new Error("削除対象のIDが見つかりません。");
    }

    setSettingsJobStatus("求人情報を削除しました。");
    await refresh();
  } catch (error) {
    setSettingsJobStatus(`削除に失敗しました: ${error.message}`);
  }
}

function switchView(viewId) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  els.settingsButton.classList.toggle("is-active", viewId === "settings");
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  if (viewId === "settings") {
    renderDictionarySettings();
    renderSettingsJobList();
  }
}

function render() {
  updateCompanyOptions();
  const visibleJobs = filterJobs(state.jobs);
  renderMetrics(visibleJobs);
  renderSkillChart();
  renderCertificationChart();
  renderJobList(els.jobList, visibleJobs);
  renderSettingsJobList();
}

function updateCompanyOptions() {
  const parserCompanies = Object.keys(window.JobParserConfig?.companies || {});
  const companies = [...new Set([...parserCompanies, ...state.jobs.map((job) => job.company).filter(Boolean), "NTT DATA"])]
    .sort((a, b) => a.localeCompare(b, "ja"));
  [els.crawlCompanySelect, els.manualCompanySelect].forEach((select) => {
    const current = select.value;
    select.innerHTML = "";
    companies.forEach((company) => {
      const option = document.createElement("option");
      option.value = company;
      option.textContent = company;
      select.appendChild(option);
    });
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "直接入力";
    select.appendChild(custom);
    select.value = companies.includes(current) || current === "custom" ? current : companies[0];
  });
  syncCompanySelect(els.crawlCompanySelect, els.companyName);
  syncCompanySelect(els.manualCompanySelect, els.manualCompanyName);
}

function renderMetrics(jobs) {
  const companies = new Set(jobs.map((job) => job.company).filter(Boolean));
  const incomeValues = jobs.map(getJobAverageIncome).filter(Number.isFinite);
  const avg = incomeValues.length
    ? Math.round(incomeValues.reduce((sum, value) => sum + value, 0) / incomeValues.length)
    : null;

  els.jobCount.textContent = jobs.length;
  els.companyCount.textContent = companies.size;
  els.avgIncome.textContent = avg ? `${avg}万円` : "-";
}

function getJobAverageIncome(job) {
  const min = Number.isFinite(job.annualIncomeMin) ? job.annualIncomeMin : null;
  const max = Number.isFinite(job.annualIncomeMax) ? job.annualIncomeMax : null;
  if (min !== null && max !== null) return (min + max) / 2;
  if (max !== null) return max;
  if (min !== null) return min;
  return null;
}

function renderSkillChart() {
  const key = els.skillTypeFilter.value === "preferred" ? "preferredSkills" : "requiredSkills";
  const counts = countSkills(state.jobs, key);
  els.skillChart.innerHTML = "";
  els.skillChart.classList.toggle("empty", counts.length === 0);
  els.skillChart.classList.toggle("word-cloud", counts.length > 0);
  if (!counts.length) {
    els.skillChart.textContent = "データがありません";
    return;
  }

  renderWordCloud(els.skillChart, counts, 36);
}

function renderCertificationChart() {
  const counts = countCertifications(state.jobs);
  els.certificationChart.innerHTML = "";
  els.certificationChart.classList.toggle("empty", counts.length === 0);
  els.certificationChart.classList.toggle("word-cloud", counts.length > 0);
  if (!counts.length) {
    els.certificationChart.textContent = "データがありません";
    return;
  }
  renderWordCloud(els.certificationChart, counts, 28);
}

function renderWordCloud(container, counts, limit) {
  const max = counts[0].count;
  const min = counts[counts.length - 1].count;
  counts.slice(0, limit).forEach(({ name, count }, index) => {
    const weight = max === min ? 1 : (count - min) / (max - min);
    const item = document.createElement("button");
    item.className = "cloud-word";
    item.type = "button";
    item.style.setProperty("--size", `${14 + weight * 20}px`);
    item.style.setProperty("--alpha", `${0.55 + weight * 0.45}`);
    item.style.setProperty("--delay", `${index * 16}ms`);
    item.title = `${name}: ${count}件`;
    item.textContent = name;
    item.classList.toggle("is-filtering", isCurrentFilter(name));
    item.addEventListener("click", () => {
      els.searchInput.value = isCurrentFilter(name) ? "" : name;
      render();
    });
    const badge = document.createElement("span");
    badge.textContent = count;
    item.appendChild(badge);
    container.appendChild(item);
  });
}

function isCurrentFilter(name) {
  return els.searchInput.value.trim().toLowerCase() === name.toLowerCase();
}

function renderJobList(container, jobs) {
  container.innerHTML = "";
  container.classList.toggle("empty", jobs.length === 0);
  if (!jobs.length) {
    container.textContent = container === els.jobList
      ? "まだ求人情報が保存されていません"
      : "取得した求人がここに表示されます";
    return;
  }

  jobs.forEach((job) => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.querySelector("h3").textContent = job.title || "職種名未取得";
    card.querySelector(".company").textContent = job.company || "企業名未設定";
    card.querySelector(".income").textContent = job.annualIncomeRaw || "年収未取得";
    card.querySelector(".description").textContent = job.description || "業務内容未取得";
    renderJobMeta(card.querySelector(".job-meta"), job);
    card.querySelector(".required").textContent = (job.requiredSkills || []).join(", ") || "-";
    card.querySelector(".preferred").textContent = (job.preferredSkills || []).join(", ") || "-";
    card.querySelector(".notes").textContent = job.notes || "";
    const source = card.querySelector(".source");
    source.href = job.sourceUrl || "#";
    source.hidden = !job.sourceUrl;
    container.appendChild(card);
  });
}

function renderJobMeta(container, job) {
  const items = [
    ["勤務地", job.location],
    ["英語", job.preferredLanguage || job.requiredLanguage]
  ].filter(([, value]) => value);
  container.innerHTML = "";
  container.hidden = items.length === 0;
  items.forEach(([label, value]) => {
    const item = document.createElement("span");
    item.textContent = `${label}: ${value}`;
    container.appendChild(item);
  });
}

function filterJobs(jobs) {
  const query = els.searchInput.value.trim().toLowerCase();
  if (!query) return jobs;
  return jobs.filter((job) => [
    job.company,
    job.title,
    job.description,
    job.annualIncomeRaw,
    job.appealPoints,
    job.location,
    job.requiredCertifications,
    job.preferredCertifications,
    ...(job.requiredSkills || []),
    ...(job.preferredSkills || []),
    job.notes
  ].join(" ").toLowerCase().includes(query));
}

function countSkills(jobs, key) {
  const map = new Map();
  jobs.flatMap((job) => job[key] || []).forEach((skill) => {
    const normalized = normalizeSkill(skill);
    if (!normalized) return;
    map.set(normalized, (map.get(normalized) || 0) + 1);
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

function countCertifications(jobs) {
  const map = new Map();
  jobs.flatMap((job) => [
    ...extractCertificationsFromText(job.requiredCertifications || ""),
    ...extractCertificationsFromText(job.preferredCertifications || ""),
    ...extractCertificationsFromText(job.notes || "")
  ]).forEach((certification) => {
    const normalized = normalizeSkill(certification);
    if (!normalized) return;
    map.set(normalized, (map.get(normalized) || 0) + 1);
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

function renderDictionarySettings() {
  els.skillDictionaryInput.value = (window.JobParserConfig?.skillDictionary || []).join("\n");
  els.certificationDictionaryInput.value = (window.JobParserConfig?.certificationDictionary || []).join("\n");
}

function renderSettingsJobList() {
  if (!els.settingsJobList) return;
  els.settingsJobList.innerHTML = "";
  els.settingsJobList.classList.toggle("empty", state.jobs.length === 0);
  if (!state.jobs.length) {
    els.settingsJobList.textContent = "削除できる求人情報がありません";
    return;
  }

  state.jobs.forEach((job) => {
    const item = document.createElement("article");
    item.className = "settings-job-item";

    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = job.title || "職種名未取得";
    const meta = document.createElement("p");
    meta.textContent = [job.company, job.annualIncomeRaw, job.location].filter(Boolean).join(" / ") || "詳細情報なし";
    body.append(title, meta);

    const button = document.createElement("button");
    button.className = "danger-button";
    button.type = "button";
    button.textContent = "削除";
    button.addEventListener("click", () => deleteJob(job));

    item.append(body, button);
    els.settingsJobList.appendChild(item);
  });
}

async function handleDictionarySave(event) {
  event.preventDefault();
  const skillDictionary = parseDictionaryInput(els.skillDictionaryInput.value);
  const certificationDictionary = parseDictionaryInput(els.certificationDictionaryInput.value);
  window.JobParserConfig.skillDictionary = skillDictionary;
  window.JobParserConfig.certificationDictionary = certificationDictionary;
  try {
    await saveDictionaryTerms(skillDictionary, certificationDictionary);
    els.dictionaryStatus.hidden = false;
    els.dictionaryStatus.textContent = state.supabase
      ? "辞書をDBに保存しました。解析とTOPのクラウド表示に反映されます。"
      : "辞書を保存しました。解析とTOPのクラウド表示に反映されます。";
    render();
  } catch (error) {
    els.dictionaryStatus.hidden = false;
    els.dictionaryStatus.textContent = `辞書保存に失敗しました: ${error.message}`;
  }
}

async function resetDictionarySettings() {
  const config = window.JobParserConfig;
  config.skillDictionary = [...(config.defaultSkillDictionary || [])];
  config.certificationDictionary = [...(config.defaultCertificationDictionary || [])];
  localStorage.removeItem(DICTIONARY_STORAGE_KEY);
  try {
    await saveDictionaryTerms(config.skillDictionary, config.certificationDictionary);
    renderDictionarySettings();
    els.dictionaryStatus.hidden = false;
    els.dictionaryStatus.textContent = state.supabase
      ? "辞書を初期値に戻してDBへ保存しました。"
      : "辞書を初期値に戻しました。";
    render();
  } catch (error) {
    els.dictionaryStatus.hidden = false;
    els.dictionaryStatus.textContent = `辞書の初期化に失敗しました: ${error.message}`;
  }
}

function parseDictionaryInput(value) {
  return [...new Set(value.split(/\n|,/).map((item) => cleanText(item)).filter(Boolean))];
}

async function handleCrawl(event) {
  event.preventDefault();
  const url = els.crawlUrl.value.trim();
  const company = els.companyName.value.trim();
  const limit = Number.parseInt(els.crawlLimit.value, 10) || 10;

  setStatus("求人一覧ページを取得しています...");
  els.crawlPreview.innerHTML = "";

  try {
    const jobs = await crawlJobs(url, company, limit);
    if (!jobs.length) {
      setStatus("求人情報を抽出できませんでした。ページ構造が変わっているか、取得先サイト側でアクセスが制限されている可能性があります。");
      return;
    }
    await saveJobs(jobs);
    renderJobList(els.crawlPreview, jobs);
    setStatus(`${jobs.length}件の求人情報を保存しました。TOPページに反映済みです。`);
    await refresh();
  } catch (error) {
    setStatus(`取得に失敗しました: ${error.message}`);
  }
}

async function handleManualPreview(event) {
  event?.preventDefault();
  const text = els.manualText.value.trim();
  if (!text) {
    setInputStatus("求人票テキストを貼り付けてください。");
    return;
  }
  const job = parseManualJobText(text, els.manualCompanyName.value.trim());
  state.manualDraft = job;
  renderJobList(els.manualPreview, [job]);
  renderManualEditor(job);
  setInputStatus("解析しました。必要に応じて編集してから保存してください。");
}

async function saveManualDraft() {
  if (!state.manualDraft) {
    setInputStatus("先に求人票を解析してください。");
    return;
  }
  try {
    const job = readManualEditorJob();
    await saveJobs([job]);
    state.manualDraft = job;
    renderJobList(els.manualPreview, [job]);
    clearManualInput();
    setInputStatus("保存しました。次の求人票を入力できます。");
    await refresh();
  } catch (error) {
    setInputStatus(`保存に失敗しました: ${error.message}`);
  }
}

async function crawlJobs(listUrl, company, limit) {
  if (!window.crawlJobsBrowser) {
    throw new Error("crawler.js が読み込まれていません。index.html と同じ階層に crawler.js を配置してください。");
  }
  return window.crawlJobsBrowser(listUrl, company, limit, setStatus);
}

function syncCompanySelect(select, input) {
  const isCustom = select.value === "custom";
  input.disabled = !isCustom;
  if (!isCustom) input.value = select.value;
  if (isCustom) input.focus();
}

function parseManualJobText(text, fallbackCompany) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const parser = getCompanyParser(fallbackCompany);
  const headings = parser.headings || {};
  const company = pickSection(normalized, headings.company, parser) || fallbackCompany || "未設定";
  const title = pickManualTitle(normalized, parser);
  const description = pickSection(normalized, headings.description, parser) || "";
  const appealPoints = pickSection(normalized, headings.appealPoints, parser) || "";
  const referenceInfo = pickSection(normalized, headings.referenceInfo, parser) || "";
  const requiredSkillsRaw = pickSection(normalized, headings.requiredSkills, parser);
  const preferredSkillsRaw = pickSection(normalized, headings.preferredSkills, parser);
  const requiredLanguage = pickSection(normalized, headings.requiredLanguage, parser);
  const requiredCertifications = pickSection(normalized, headings.requiredCertifications, parser);
  const preferredLanguage = pickSection(normalized, headings.preferredLanguage, parser);
  const preferredCertifications = pickSection(normalized, headings.preferredCertifications, parser);
  const annualIncomeRaw = pickSection(normalized, headings.income, parser) || findIncomeText(normalized);
  const income = parseIncome(annualIncomeRaw);
  const location = pickSection(normalized, headings.location, parser);
  const notes = [
    referenceInfo && `参考情報: ${referenceInfo}`,
    requiredLanguage && `必要語学: ${requiredLanguage}`,
    requiredCertifications && `必要資格: ${requiredCertifications}`,
    preferredLanguage && `歓迎語学: ${preferredLanguage}`,
    preferredCertifications && `歓迎資格: ${preferredCertifications}`
  ].filter(Boolean).join("\n");

  return {
    company,
    title,
    description,
    annualIncomeRaw,
    annualIncomeMin: income.min,
    annualIncomeMax: income.max,
    requiredSkills: extractSkillsFromText(requiredSkillsRaw || description, parser),
    preferredSkills: extractSkillsFromText([preferredSkillsRaw, preferredCertifications].filter(Boolean).join("\n"), parser),
    appealPoints,
    referenceInfo,
    requiredLanguage,
    requiredCertifications,
    preferredLanguage,
    preferredCertifications,
    location,
    notes,
    inputMethod: "manual",
    sourceUrl: `manual:${hashText(`${company}\n${title}\n${normalized.slice(0, 200)}`)}`,
    crawledAt: new Date().toISOString()
  };
}

function renderManualEditor(job) {
  els.manualEditor.hidden = false;
  els.manualEditor.innerHTML = `
    <div class="panel-head editor-head">
      <h2>保存前編集</h2>
      <button class="primary-button" id="manualSaveButton" type="button">この内容で保存</button>
    </div>
    <div class="editor-grid">
      <label>企業名<input data-field="company" type="text"></label>
      <label>求人タイトル<input data-field="title" type="text"></label>
      <label>年収<input data-field="annualIncomeRaw" type="text"></label>
      <label>勤務地<input data-field="location" type="text"></label>
    </div>
    <label>職務内容<textarea data-field="description" rows="5"></textarea></label>
    <label>必須スキル<textarea data-field="requiredSkills" rows="4"></textarea></label>
    <label>歓迎スキル<textarea data-field="preferredSkills" rows="4"></textarea></label>
    <label>必要資格<textarea data-field="requiredCertifications" rows="3"></textarea></label>
    <label>歓迎資格<textarea data-field="preferredCertifications" rows="3"></textarea></label>
    <label>アピールポイント<textarea data-field="appealPoints" rows="5"></textarea></label>
    <label>補足・資格・語学<textarea data-field="notes" rows="5"></textarea></label>
  `;
  setEditorValue("company", job.company);
  setEditorValue("title", job.title);
  setEditorValue("annualIncomeRaw", job.annualIncomeRaw);
  setEditorValue("location", job.location);
  setEditorValue("description", job.description);
  setEditorValue("requiredSkills", (job.requiredSkills || []).join("\n"));
  setEditorValue("preferredSkills", (job.preferredSkills || []).join("\n"));
  setEditorValue("requiredCertifications", job.requiredCertifications);
  setEditorValue("preferredCertifications", job.preferredCertifications);
  setEditorValue("appealPoints", job.appealPoints);
  setEditorValue("notes", job.notes);
  els.manualEditor.querySelector("#manualSaveButton").addEventListener("click", saveManualDraft);
}

function setEditorValue(field, value) {
  const input = els.manualEditor.querySelector(`[data-field="${field}"]`);
  if (input) input.value = value || "";
}

function readManualEditorJob() {
  const get = (field) => els.manualEditor.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
  const annualIncomeRaw = get("annualIncomeRaw");
  const income = parseIncome(annualIncomeRaw);
  const job = {
    ...state.manualDraft,
    company: get("company") || "未設定",
    title: get("title"),
    description: get("description"),
    annualIncomeRaw,
    annualIncomeMin: income.min,
    annualIncomeMax: income.max,
    location: get("location"),
    requiredSkills: splitEditorList(get("requiredSkills")),
    preferredSkills: splitEditorList(get("preferredSkills")),
    requiredCertifications: get("requiredCertifications"),
    preferredCertifications: get("preferredCertifications"),
    appealPoints: get("appealPoints"),
    notes: get("notes"),
    inputMethod: "manual"
  };
  job.sourceUrl = `manual:${hashText(`${job.company}\n${job.title}\n${job.description.slice(0, 120)}`)}`;
  return job;
}

function clearManualInput() {
  els.manualText.value = "";
  els.manualPreview.innerHTML = "解析した求人がここに表示されます";
  els.manualPreview.classList.add("empty");
  els.manualEditor.hidden = true;
  els.manualEditor.innerHTML = "";
  state.manualDraft = null;
}

function splitEditorList(value) {
  return [...new Set(value.split(/\n|,|、/).map(normalizeSkill).filter(Boolean))];
}

function getCompanyParser(company) {
  const config = window.JobParserConfig || {};
  return config.companies?.[company] || config.companies?.[config.defaultCompany] || {
    headings: {},
    sectionHeadings: [],
    ignoreSkillPatterns: []
  };
}

function pickManualTitle(text, parser) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const pattern = getTitlePattern(parser);
  const titleLine = lines.find((line) => pattern.test(line)) || lines[0] || "";
  return titleLine.replace(/<\d+>\s*$/, "").trim();
}

function getTitlePattern(parser) {
  if (parser.titlePattern instanceof RegExp) return parser.titlePattern;
  if (typeof parser.titlePattern === "string" && parser.titlePattern) {
    return new RegExp(parser.titlePattern);
  }
  return /^【.+?】/;
}

function pickSection(text, labels = [], parser = getCompanyParser()) {
  const lines = text.split("\n");
  const headings = parser.sectionHeadings || [];
  const start = lines.findIndex((line) => labels.some((label) => line.trim() === label || line.includes(label)));
  if (start < 0) return "";
  const values = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line && headings.some((heading) => line === heading || line.includes(heading))) break;
    values.push(lines[i]);
  }
  return cleanText(values.join("\n"));
}

function findIncomeText(text) {
  const match = text.match(/(?:年収|給与|想定年収|待遇).{0,80}?(\d{3,4}).{0,20}?万円?(?:.{0,20}?(\d{3,4}).{0,20}?万円?)?/);
  return match ? match[0] : "";
}

function parseIncome(raw) {
  const values = (raw.match(/\d{3,4}/g) || []).map(Number);
  return {
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null
  };
}

function extractSkillsFromText(raw, parser = getCompanyParser()) {
  if (!raw) return [];
  const known = window.JobParserConfig?.skillDictionary || [];
  const ignorePattern = new RegExp(parser.ignoreSkillPatterns?.join("|") || "$^");
  const found = known.filter((skill) => new RegExp(escapeRegExp(skill), "i").test(raw));
  const bulletItems = raw
    .split(/\n|・|●|■|,|、|;/)
    .map((item) => cleanText(item).replace(/^[\-\u30fb\s]+/, ""))
    .filter((item) => item.length >= 2 && item.length <= 42)
    .filter((item) => !ignorePattern.test(item));
  return [...new Set([...found, ...bulletItems].map(normalizeSkill).filter(Boolean))].slice(0, 24);
}

function extractCertificationsFromText(raw) {
  if (!raw) return [];
  const dictionary = window.JobParserConfig?.certificationDictionary || [];
  return [...new Set(dictionary.filter((name) => new RegExp(escapeRegExp(name), "i").test(raw)))];
}

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeSkill(skill) {
  return cleanText(skill).replace(/経験$/, "").replace(/スキル$/, "").trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setStatus(message) {
  els.crawlStatus.textContent = message;
}

function setInputStatus(message) {
  els.manualStatus.textContent = message;
}

function setSettingsJobStatus(message) {
  els.settingsJobStatus.hidden = false;
  els.settingsJobStatus.textContent = message;
}
