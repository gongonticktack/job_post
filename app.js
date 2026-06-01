"use strict";

const DB_NAME = "job-post-analytics";
const DB_VERSION = 1;
const STORE = "jobs";
const DICTIONARY_STORAGE_KEY = "job-post-dictionaries";
const CERTIFICATION_ALIASES = {
  "project management professional": "PMP",
  "project manager professional": "PMP",
  "pmp": "PMP",
  "aws certified solutions architect": "AWS Certified Solutions Architect - Associate",
  "aws certified solutions architect - associate": "AWS Certified Solutions Architect - Associate",
  "aws certified solutions architect associate": "AWS Certified Solutions Architect - Associate",
  "aws solutions architect": "AWS Certified Solutions Architect - Associate",
  "aws certified developer": "AWS Certified Developer - Associate",
  "aws certified sysops administrator": "AWS Certified CloudOps Engineer - Associate",
  "aws certified devops engineer": "AWS Certified DevOps Engineer - Professional",
  "aws certified security": "AWS Certified Security - Specialty",
  "aws certified machine learning": "AWS Certified Machine Learning - Specialty",
  "google cloud cloud digital leader": "Cloud Digital Leader",
  "google cloud generative ai leader": "Generative AI Leader",
  "google cloud associate cloud engineer": "Associate Cloud Engineer",
  "google cloud associate google workspace administrator": "Associate Google Workspace Administrator",
  "google cloud associate data practitioner": "Associate Data Practitioner",
  "google cloud professional cloud architect": "Professional Cloud Architect",
  "google cloud professional cloud database engineer": "Professional Cloud Database Engineer",
  "google cloud professional cloud developer": "Professional Cloud Developer",
  "google cloud professional data engineer": "Professional Data Engineer",
  "google cloud professional cloud devops engineer": "Professional Cloud DevOps Engineer",
  "google cloud professional cloud security engineer": "Professional Cloud Security Engineer",
  "google cloud professional cloud network engineer": "Professional Cloud Network Engineer",
  "google cloud professional machine learning engineer": "Professional Machine Learning Engineer",
  "google cloud professional security operations engineer": "Professional Security Operations Engineer",
  "csm": "Certified ScrumMaster",
  "cspo": "Certified Scrum Product Owner",
  "psm": "Professional Scrum Master",
  "pspo": "Professional Scrum Product Owner",
  "itil foundation": "ITIL",
  "プロジェクトマネージャ": "プロジェクトマネージャ試験",
  "プロジェクトマネージャ試験": "プロジェクトマネージャ試験",
  "システムアーキテクト": "システムアーキテクト試験",
  "システムアーキテクト試験": "システムアーキテクト試験",
  "データベース": "データベーススペシャリスト",
  "データベーススペシャリスト": "データベーススペシャリスト",
  "ネットワーク": "ネットワークスペシャリスト",
  "ネットワークスペシャリスト": "ネットワークスペシャリスト",
  "情報処理安全確保支援士": "情報処理安全確保支援士試験"
};
const EXCLUDED_CERTIFICATIONS = new Set(["ipa", "情報処理技術者"]);
const EXCLUDED_SKILL_PATTERNS = [
  /など$/,
  /チーム$/,
  /判断し$/,
  /^【.+】/,
  /【.+】/,
  /^(言語|工程|役割|担当|業務|職務|チーム|部門|部署|組織)$/,
  /(以下|上記|下記|経験|知識|スキル|条件|歓迎|必須|応募|求める|業務|職務|言語).{4,}/
];

const state = {
  jobs: [],
  db: null,
  supabase: null,
  manualDraft: null,
  activeFacetFilters: []
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  settingsButton: document.querySelector(".settings-button"),
  views: document.querySelectorAll(".view"),
  jobCount: document.querySelector("#jobCount"),
  companyCount: document.querySelector("#companyCount"),
  representativeCompanies: document.querySelector("#representativeCompanies"),
  avgIncome: document.querySelector("#avgIncome"),
  skillTypeFilter: document.querySelector("#skillTypeFilter"),
  resetSkillFilters: document.querySelector("#resetSkillFilters"),
  skillChart: document.querySelector("#skillChart"),
  certificationChart: document.querySelector("#certificationChart"),
  resetCertificationFilters: document.querySelector("#resetCertificationFilters"),
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
  dictionaryForm: document.querySelector("#dictionaryForm"),
  skillDictionaryEditor: document.querySelector("#skillDictionaryEditor"),
  skillCategoryEditor: document.querySelector("#skillCategoryEditor"),
  certificationDictionaryEditor: document.querySelector("#certificationDictionaryEditor"),
  skillDictionaryCount: document.querySelector("#skillDictionaryCount"),
  certificationDictionaryCount: document.querySelector("#certificationDictionaryCount"),
  dictionaryStatus: document.querySelector("#dictionaryStatus"),
  resetDictionaryButton: document.querySelector("#resetDictionaryButton"),
  cleanupDataButton: document.querySelector("#cleanupDataButton"),
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
  els.resetSkillFilters.addEventListener("click", () => {
    clearFacetFilters("skill");
    render();
  });
  els.resetCertificationFilters.addEventListener("click", () => {
    clearFacetFilters("certification");
    render();
  });
  [els.skillChart, els.certificationChart].forEach((chart) => {
    chart.addEventListener("click", (event) => {
      if (event.target !== chart) return;
      if (chart === els.skillChart) clearFacetFilters("skill");
      if (chart === els.certificationChart) clearFacetFilters("certification");
      render();
    });
  });
  syncCompanySelect(els.crawlCompanySelect, els.companyName);
  syncCompanySelect(els.manualCompanySelect, els.manualCompanyName);
  els.crawlCompanySelect.addEventListener("change", () => syncCompanySelect(els.crawlCompanySelect, els.companyName));
  els.manualCompanySelect.addEventListener("change", () => syncCompanySelect(els.manualCompanySelect, els.manualCompanyName));
  els.crawlForm.addEventListener("submit", handleCrawl);
  els.manualForm.addEventListener("submit", handleManualPreview);
  els.dictionaryForm.addEventListener("submit", handleDictionarySave);
  els.dictionaryForm.addEventListener("click", handleDictionaryEditorClick);
  els.dictionaryForm.addEventListener("change", handleDictionaryEditorChange);
  els.dictionaryForm.addEventListener("input", handleDictionaryEditorInput);
  els.resetDictionaryButton.addEventListener("click", resetDictionarySettings);
  els.cleanupDataButton.addEventListener("click", cleanupSavedData);
}

async function loadDictionarySettings() {
  const config = window.JobParserConfig;
  if (!config) return;
  config.defaultSkillDictionary = [...(config.skillDictionary || [])];
  config.defaultCertificationDictionary = [...(config.certificationDictionary || [])];
  config.dictionaryMeta = config.dictionaryMeta || { skill: {}, certification: {} };
  config.dictionaryCategories = config.dictionaryCategories || { skill: getDefaultDictionaryCategories("skill") };
  if (state.supabase) {
    try {
      let remote = await getDictionaryTerms();
      if (!remote.hasDictionaryTerms) {
        await saveDictionaryTerms(config.defaultSkillDictionary, config.defaultCertificationDictionary);
        remote = await getDictionaryTerms();
      }
      if (!remote.certificationDictionary.length && config.defaultCertificationDictionary?.length) {
        await saveDictionaryTerms(
          remote.skillDictionary.length ? remote.skillDictionary : config.defaultSkillDictionary,
          config.defaultCertificationDictionary,
          remote.dictionaryCategories?.skill || config.dictionaryCategories?.skill
        );
        remote = await getDictionaryTerms();
      }
      if (remote.skillDictionary.length) config.skillDictionary = remote.skillDictionary;
      if (remote.certificationDictionary.length) config.certificationDictionary = remote.certificationDictionary;
      if (!config.certificationDictionary?.length) {
        config.certificationDictionary = [...(config.defaultCertificationDictionary || [])];
      }
      config.dictionaryMeta = remote.dictionaryMeta;
      config.dictionaryCategories = remote.dictionaryCategories;
      normalizeLoadedCertificationDictionary(config);
      return;
    } catch (error) {
      console.warn("dictionary settings remote load failed", error);
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DICTIONARY_STORAGE_KEY) || "{}");
    if (Array.isArray(saved.skillDictionary)) config.skillDictionary = saved.skillDictionary;
    if (Array.isArray(saved.certificationDictionary) && saved.certificationDictionary.length) {
      config.certificationDictionary = saved.certificationDictionary;
    }
    if (saved.dictionaryMeta) config.dictionaryMeta = saved.dictionaryMeta;
    if (saved.dictionaryCategories) config.dictionaryCategories = saved.dictionaryCategories;
  } catch (error) {
    console.warn("dictionary settings load failed", error);
  }
  if (!config.certificationDictionary?.length) {
    config.certificationDictionary = [...(config.defaultCertificationDictionary || [])];
  }
  normalizeLoadedCertificationDictionary(config);
}

function normalizeLoadedCertificationDictionary(config) {
  config.certificationDictionary = [...new Set([
    ...(config.certificationDictionary || []),
    ...(config.defaultCertificationDictionary || [])
  ]
    .map(normalizeCertification)
    .filter(Boolean))];
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
    }, { ...config.defaultCompanies });
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
  const rows = await getDictionaryTermRows();
  const categoryRows = await getDictionaryCategories();
  const categoryById = buildCategoryByIdMap(categoryRows);
  const normalizedRows = rows.map((row) => normalizeDictionaryTermRow(row, categoryById));
  const categoryColorMap = buildCategoryColorMap(categoryRows);
  const enrichedRows = normalizedRows.map((row) => ({
    ...row,
    color: getDictionaryCategoryColor(row.dictionary_type, row.category, categoryColorMap, row.color)
  }));
  return {
    skillDictionary: enrichedRows.filter((row) => row.dictionary_type === "skill").map((row) => row.term),
    certificationDictionary: enrichedRows.filter((row) => row.dictionary_type === "certification").map((row) => row.term),
    dictionaryMeta: buildDictionaryMeta(enrichedRows),
    dictionaryCategories: buildDictionaryCategories(categoryRows, enrichedRows),
    hasDictionaryTerms: normalizedRows.length > 0,
    missingSkillEntries: []
  };
}

async function getDictionaryTermRows() {
  try {
    return await supabaseRequest("dictionary_terms?select=dictionary_type,term,category_id,sort_order&order=dictionary_type.asc,sort_order.asc,term.asc");
  } catch (error) {
    console.warn("dictionary terms normalized load failed, trying legacy columns", error);
    return await supabaseRequest("dictionary_terms?select=dictionary_type,term,category,color,sort_order&order=dictionary_type.asc,sort_order.asc,term.asc");
  }
}

function normalizeDictionaryTermRow(row, categoryById = new Map()) {
  const categoryRow = Array.isArray(row.dictionary_categories)
    ? row.dictionary_categories[0]
    : row.dictionary_categories || categoryById.get(String(row.category_id || ""));
  const category = cleanText(categoryRow?.category || row.category || inferDictionaryCategory(row.term || "", row.dictionary_type));
  return {
    ...row,
    category,
    color: normalizeColor(categoryRow?.color || row.color) || getCategoryColor(category)
  };
}

async function getDictionaryCategories() {
  try {
    return await supabaseRequest("dictionary_categories?select=id,dictionary_type,category,color,sort_order&order=dictionary_type.asc,sort_order.asc,category.asc");
  } catch (error) {
    console.warn("dictionary categories remote load failed", error);
    return [];
  }
}

function buildCategoryColorMap(rows = []) {
  return rows.reduce((map, row) => {
    const type = row.dictionary_type || row.type || "skill";
    const category = normalizeDictionaryKey(row.category || "");
    if (type && category) map.set(`${type}:${category}`, normalizeColor(row.color) || getCategoryColor(row.category));
    return map;
  }, new Map());
}

function getDictionaryCategoryColor(type, category, colorMap, fallback = "") {
  const key = `${type || "skill"}:${normalizeDictionaryKey(category || "")}`;
  return normalizeColor(colorMap?.get(key)) || normalizeColor(fallback) || getCategoryColor(category);
}

function buildCategoryIdMap(rows = []) {
  return rows.reduce((map, row) => {
    const type = row.dictionary_type || row.type || "skill";
    const category = normalizeDictionaryKey(row.category || "");
    if (type && category && row.id) map.set(`${type}:${category}`, row.id);
    return map;
  }, new Map());
}

function buildCategoryByIdMap(rows = []) {
  return rows.reduce((map, row) => {
    if (row.id) map.set(String(row.id), row);
    return map;
  }, new Map());
}

function buildDictionaryCategories(categoryRows = [], termRows = []) {
  const skill = new Map();
  categoryRows
    .filter((row) => (row.dictionary_type || row.type) === "skill")
    .forEach((row) => {
      if (!row.category) return;
      skill.set(normalizeDictionaryKey(row.category), {
        category: row.category,
        color: normalizeColor(row.color) || getCategoryColor(row.category)
      });
    });
  termRows
    .filter((row) => row.dictionary_type === "skill")
    .forEach((row) => {
      if (!row.category || row.category === "certification") return;
      const key = normalizeDictionaryKey(row.category);
      if (!skill.has(key)) {
        skill.set(key, {
          category: row.category,
          color: normalizeColor(row.color) || getCategoryColor(row.category) || "#25d6a2"
        });
      }
    });
  getDefaultDictionaryCategories("skill").forEach((entry) => {
    const key = normalizeDictionaryKey(entry.category);
    if (!skill.has(key)) skill.set(key, entry);
  });
  return { skill: [...skill.values()].sort((a, b) => a.category.localeCompare(b.category, "ja")) };
}

async function saveDictionaryTerms(skillDictionary, certificationDictionary, skillCategoryEntries = null) {
  const skillEntries = normalizeDictionaryEntries(skillDictionary, "skill");
  const certificationEntries = normalizeDictionaryEntries(certificationDictionary, "certification");
  const categoryEntries = normalizeDictionaryCategories(skillCategoryEntries || deriveSkillCategories(skillEntries));
  if (!state.supabase) {
    localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify({
      skillDictionary: skillEntries.map((entry) => entry.term),
      certificationDictionary: certificationEntries.map((entry) => entry.term),
      dictionaryMeta: buildDictionaryMeta(applyCategoryColorsToDictionaryRows([...skillEntries, ...certificationEntries], categoryEntries)),
      dictionaryCategories: { skill: categoryEntries }
    }));
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
  const savedCategories = await saveDictionaryCategories(categoryEntries);
  const categoryIdMap = buildCategoryIdMap(savedCategories);
  const getCategoryId = (type, category) => categoryIdMap.get(`${type}:${normalizeDictionaryKey(category || "")}`) || null;
  const rows = [
    ...skillEntries.map((entry, index) => ({
      dictionary_type: "skill",
      term: entry.term,
      category_id: getCategoryId("skill", entry.category),
      sort_order: index
    })),
    ...certificationEntries.map((entry, index) => ({
      dictionary_type: "certification",
      term: entry.term,
      category_id: getCategoryId("certification", "certification"),
      sort_order: index
    }))
  ];
  if (rows.length) {
    await supabaseRequest("dictionary_terms", {
      method: "POST",
      body: JSON.stringify(rows)
    });
  }
  await syncSkillDictionaryToSupabaseSkills(skillEntries);
  await pruneClientJobSkillsOutsideDictionary(skillEntries);
  await pruneSupabaseJobSkillsOutsideDictionary(skillEntries);
  await pruneSupabaseSkillsOutsideDictionary(skillEntries);
}

async function saveDictionaryCategories(categoryEntries) {
  if (!state.supabase) return [];
  try {
    await supabaseRequest("dictionary_categories?dictionary_type=eq.skill", {
      method: "DELETE",
      headers: { prefer: "return=minimal" }
    });
    const skillRows = normalizeDictionaryCategories(categoryEntries).map((entry, index) => ({
      dictionary_type: "skill",
      category: entry.category,
      color: entry.color || getCategoryColor(entry.category) || "#25d6a2",
      sort_order: index
    }));
    const rows = [
      ...skillRows,
      {
        dictionary_type: "certification",
        category: "certification",
        color: "#d8b4fe",
        sort_order: 0
      }
    ];
    if (rows.length) {
      await supabaseRequest("dictionary_categories?on_conflict=dictionary_type,category", {
        method: "POST",
        body: JSON.stringify(rows),
        headers: { prefer: "resolution=merge-duplicates,return=representation" }
      });
    }
    return await getDictionaryCategories();
  } catch (error) {
    console.warn("dictionary categories save failed", error);
    throw error;
  }
}

async function syncSkillDictionaryToSupabaseSkills(skillEntries) {
  if (!state.supabase) return;
  const rows = normalizeDictionaryEntries(skillEntries, "skill")
    .map((entry) => normalizeSkill(entry.term))
    .filter(Boolean)
    .map((name) => ({ name, normalized_name: name.toLowerCase() }));
  if (!rows.length) return;
  await supabaseRequest("skills?on_conflict=name", {
    method: "POST",
    body: JSON.stringify(rows),
    headers: { prefer: "resolution=merge-duplicates,return=minimal" }
  });
}

async function pruneSupabaseSkillsOutsideDictionary(skillEntries) {
  if (!state.supabase) return;
  const allowed = new Set(normalizeDictionaryEntries(skillEntries, "skill")
    .map((entry) => normalizeDictionaryKey(entry.term))
    .filter(Boolean));
  const rows = await supabaseRequest("skills?select=id,name");
  for (const row of rows) {
    if (allowed.has(normalizeDictionaryKey(row.name || ""))) continue;
    await supabaseRequest(`skills?id=eq.${encodeURIComponent(row.id)}`, {
      method: "DELETE",
      headers: { prefer: "return=minimal" }
    });
  }
}

async function pruneSupabaseJobSkillsOutsideDictionary(skillEntries) {
  if (!state.supabase) return;
  const allowed = new Set(normalizeDictionaryEntries(skillEntries, "skill")
    .map((entry) => normalizeDictionaryKey(entry.term))
    .filter(Boolean));
  const rows = await supabaseRequest("jobs?select=id,required_skills,preferred_skills");
  for (const row of rows) {
    const requiredSkills = filterSkillsByDictionary(row.required_skills || [], allowed);
    const preferredSkills = filterSkillsByDictionary(row.preferred_skills || [], allowed);
    if (!hasSkillListChanged(row.required_skills || [], requiredSkills)
      && !hasSkillListChanged(row.preferred_skills || [], preferredSkills)) {
      continue;
    }
    await supabaseRequest(`jobs?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        required_skills: requiredSkills,
        preferred_skills: preferredSkills
      }),
      headers: { prefer: "return=minimal" }
    });
    await replaceSupabaseJobSkills(row.id, requiredSkills, preferredSkills);
  }
}

function filterSkillsByDictionary(skills, allowedKeys = null) {
  const allowed = allowedKeys || new Set((window.JobParserConfig?.skillDictionary || [])
    .map(normalizeDictionaryKey)
    .filter(Boolean));
  return [...new Set((skills || [])
    .map(normalizeSavedSkill)
    .filter((skill) => skill && allowed.has(normalizeDictionaryKey(skill))))];
}

async function pruneClientJobSkillsOutsideDictionary(skillEntries) {
  const allowed = new Set(normalizeDictionaryEntries(skillEntries, "skill")
    .map((entry) => normalizeDictionaryKey(entry.term))
    .filter(Boolean));
  const updatedJobs = [];
  state.jobs = state.jobs.map((job) => {
    const requiredSkills = filterSkillsByDictionary(job.requiredSkills || [], allowed);
    const preferredSkills = filterSkillsByDictionary(job.preferredSkills || [], allowed);
    if (!hasSkillListChanged(job.requiredSkills || [], requiredSkills)
      && !hasSkillListChanged(job.preferredSkills || [], preferredSkills)) {
      return job;
    }
    const updatedJob = { ...job, requiredSkills, preferredSkills };
    updatedJobs.push(updatedJob);
    return updatedJob;
  });
  if (!state.supabase && updatedJobs.length) {
    await saveLocalJobs(updatedJobs);
  }
}

function buildDictionaryMeta(rows) {
  return rows.reduce((acc, row) => {
    const type = row.dictionary_type || row.type;
    const term = row.term;
    if (!type || !term) return acc;
    acc[type] = acc[type] || {};
    acc[type][normalizeDictionaryKey(term)] = {
      category: row.category || "",
      color: row.color || ""
    };
    return acc;
  }, { skill: {}, certification: {} });
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
    state.jobs = (await getAllLocalJobs()).map(normalizeClientJob);
    if (!state.supabase) {
      setStatus("supabase-config.jsonを読み込めないため、ブラウザ内DBで動作しています。");
    }
  } catch (error) {
    setStatus(`ローカルDBの読み込みに失敗しました: ${error.message}`);
  }
  render();
}

async function saveJobs(jobs) {
  const normalizedJobs = jobs.map(normalizeClientJob);
  if (state.supabase) {
    try {
      await saveSupabaseJobs(normalizedJobs);
      return;
    } catch (error) {
      setStatus(`Supabase保存に失敗したためローカルDBへ保存します: ${error.message}`);
    }
  }
  await saveLocalJobs(normalizedJobs);
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
    const normalizedCompany = canonicalCompanyName(job.company || "未設定");
    const companyRows = await supabaseRequest("companies?on_conflict=name", {
      method: "POST",
      body: JSON.stringify({ name: normalizedCompany }),
      headers: { prefer: "resolution=merge-duplicates,return=representation" }
    });
    const savedJobRows = await supabaseRequest("jobs?on_conflict=source_url", {
      method: "POST",
      body: JSON.stringify(toDbJob({ ...job, company: normalizedCompany }, companyRows[0].id)),
      headers: { prefer: "resolution=merge-duplicates,return=representation" }
    });
    const savedJob = savedJobRows[0];
    await saveSupabaseSkills(savedJob.id, job.requiredSkills || [], "required");
    await saveSupabaseSkills(savedJob.id, job.preferredSkills || [], "preferred");
  }
}

async function saveSupabaseSkills(jobId, skills, skillType) {
  const normalizedSkills = filterSkillsByDictionary(skills);
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

async function replaceSupabaseJobSkills(jobId, requiredSkills, preferredSkills) {
  await supabaseRequest(`job_skills?job_id=eq.${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" }
  });
  await saveSupabaseSkills(jobId, requiredSkills, "required");
  await saveSupabaseSkills(jobId, preferredSkills, "preferred");
}

function toClientJob(row) {
  return normalizeClientJob({
    id: row.id,
    company: canonicalCompanyName(row.companies?.name || row.company || ""),
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
  });
}

function normalizeClientJob(job) {
  const company = canonicalCompanyName(job.company || "");
  const parser = getCompanyParser(company);
  return {
    ...job,
    company,
    requiredSkills: cleanSkillList(job.requiredSkills || [], parser),
    preferredSkills: cleanSkillList(job.preferredSkills || [], parser)
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
      const relatedSkillIds = await getSupabaseJobSkillIds(job.id);
      await supabaseRequest(`jobs?id=eq.${encodeURIComponent(job.id)}`, {
        method: "DELETE",
        headers: { prefer: "return=minimal" }
      });
      await deleteOrphanSupabaseSkills(relatedSkillIds);
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

async function getSupabaseJobSkillIds(jobId) {
  const rows = await supabaseRequest(`job_skills?select=skill_id&job_id=eq.${encodeURIComponent(jobId)}`);
  return [...new Set(rows.map((row) => row.skill_id).filter((id) => id !== null && id !== undefined))];
}

async function deleteOrphanSupabaseSkills(skillIds) {
  let deletedCount = 0;
  for (const skillId of skillIds) {
    const rows = await supabaseRequest(`job_skills?select=job_id&skill_id=eq.${encodeURIComponent(skillId)}&limit=1`);
    if (!rows.length) {
      await supabaseRequest(`skills?id=eq.${encodeURIComponent(skillId)}`, {
        method: "DELETE",
        headers: { prefer: "return=minimal" }
      });
      deletedCount += 1;
    }
  }
  return deletedCount;
}

async function cleanupSavedData() {
  if (!window.confirm("保存済み求人のスキルを現在の抽出ルールで整理しますか？")) return;
  setSettingsJobStatus("データを整理しています...");

  try {
    let updatedCount = 0;
    let removedSkillCount = 0;

    for (const job of state.jobs) {
      const cleaned = cleanJobSkills(job);
      const cleanedIncome = cleanJobIncome(job);
      if (!hasSkillListChanged(job.requiredSkills, cleaned.requiredSkills)
        && !hasSkillListChanged(job.preferredSkills, cleaned.preferredSkills)
        && !hasIncomeChanged(job, cleanedIncome)) {
        continue;
      }

      updatedCount += 1;
      if (state.supabase && job.id) {
        const beforeSkillIds = await getSupabaseJobSkillIds(job.id);
        await supabaseRequest(`jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            required_skills: cleaned.requiredSkills,
            preferred_skills: cleaned.preferredSkills,
            annual_income_min: cleanedIncome.annualIncomeMin,
            annual_income_max: cleanedIncome.annualIncomeMax,
            annual_income_raw: cleanedIncome.annualIncomeRaw
          }),
          headers: { prefer: "return=minimal" }
        });
        await replaceSupabaseJobSkills(job.id, cleaned.requiredSkills, cleaned.preferredSkills);
        removedSkillCount += await deleteOrphanSupabaseSkills(beforeSkillIds);
      } else if (job.sourceUrl) {
        await saveLocalJobs([{ ...job, ...cleaned, ...cleanedIncome }]);
      }
    }

    if (state.supabase) {
      removedSkillCount += await cleanupAllOrphanSupabaseSkills();
    }

    await refresh();
    setSettingsJobStatus(`データ更新が完了しました。求人${updatedCount}件を整理し、未使用スキル${removedSkillCount}件を削除しました。`);
  } catch (error) {
    setSettingsJobStatus(`データ更新に失敗しました: ${error.message}`);
  }
}

function cleanJobSkills(job) {
  const parser = getCompanyParser(job.company);
  const requiredSkills = cleanSkillList(job.requiredSkills || [], parser);
  const preferredSkills = cleanSkillList(job.preferredSkills || [], parser);
  return { requiredSkills, preferredSkills };
}

function cleanJobIncome(job) {
  const income = parseIncome(job.annualIncomeRaw || "");
  return {
    annualIncomeMin: income.min,
    annualIncomeMax: income.max,
    annualIncomeRaw: formatIncomeRaw(job.annualIncomeRaw || "", income)
  };
}

function cleanSkillList(skills, parser) {
  const ignorePattern = new RegExp(parser.ignoreSkillPatterns?.join("|") || "$^");
  return [...new Set(skills.map(normalizeSavedSkill).filter((skill) => isSavedSkillValid(skill, ignorePattern)))];
}

function isSavedSkillValid(skill, ignorePattern) {
  const dictionary = window.JobParserConfig?.skillDictionary || [];
  const normalized = normalizeSkill(skill);
  if (!normalized) return false;
  if (isExcludedSkillText(normalized)) return false;
  if (dictionary.some((term) => term.toLowerCase() === normalized.toLowerCase())) return true;
  return false;
}

function hasSkillListChanged(before = [], after = []) {
  const left = before.map(normalizeSkill).filter(Boolean);
  return left.length !== after.length || left.some((value, index) => value !== after[index]);
}

function hasIncomeChanged(job, cleanedIncome) {
  return job.annualIncomeRaw !== cleanedIncome.annualIncomeRaw
    || job.annualIncomeMin !== cleanedIncome.annualIncomeMin
    || job.annualIncomeMax !== cleanedIncome.annualIncomeMax;
}

async function cleanupAllOrphanSupabaseSkills() {
  const rows = await supabaseRequest("skills?select=id");
  let deletedCount = 0;
  for (const row of rows) {
    const used = await supabaseRequest(`job_skills?select=job_id&skill_id=eq.${encodeURIComponent(row.id)}&limit=1`);
    if (!used.length) {
      await supabaseRequest(`skills?id=eq.${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: { prefer: "return=minimal" }
      });
      deletedCount += 1;
    }
  }
  return deletedCount;
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
  renderFilterControls();
  renderSkillChart(visibleJobs);
  renderCertificationChart(visibleJobs);
  renderJobList(els.jobList, visibleJobs);
  renderSettingsJobList();
}

function renderFilterControls() {
  const skillCount = countActiveFilters("skill");
  const certificationCount = countActiveFilters("certification");
  els.resetSkillFilters.hidden = skillCount === 0;
  els.resetCertificationFilters.hidden = certificationCount === 0;
  els.resetSkillFilters.textContent = skillCount ? `スキル条件リセット (${skillCount})` : "スキル条件リセット";
  els.resetCertificationFilters.textContent = certificationCount ? `資格条件リセット (${certificationCount})` : "資格条件リセット";
}

function updateCompanyOptions() {
  const parserCompanies = Object.keys(window.JobParserConfig?.companies || {});
  const companies = [...new Set([...parserCompanies, ...state.jobs.map((job) => job.company).filter(Boolean), "株式会社NTTデータ"]
    .map(canonicalCompanyOptionName)
    .filter((company) => company && !isHiddenCompanyOption(company)))]
    .sort((a, b) => a.localeCompare(b, "ja"));
  [els.crawlCompanySelect, els.manualCompanySelect].forEach((select) => {
    const current = canonicalCompanyOptionName(select.value);
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

function canonicalCompanyOptionName(name) {
  const canonical = canonicalCompanyName(name);
  return isFujitsuParserCompany(name) || isFujitsuParserCompany(canonical)
    ? "富士通株式会社"
    : canonical;
}

function isHiddenCompanyOption(name) {
  return /富士通\s*japan|fujitsu\s*japan/i.test(cleanCompanyName(name));
}

function renderMetrics(jobs) {
  const companyCounts = countCompanies(jobs);
  const incomeValues = jobs.map(getJobAverageIncome).filter(Number.isFinite);
  const avg = incomeValues.length
    ? Math.round(incomeValues.reduce((sum, value) => sum + value, 0) / incomeValues.length)
    : null;

  els.jobCount.textContent = jobs.length;
  els.companyCount.textContent = companyCounts.length;
  renderRepresentativeCompanies(companyCounts);
  els.avgIncome.textContent = avg ? `${avg}万円` : "-";
}

function countCompanies(jobs) {
  const map = new Map();
  jobs.forEach((job) => {
    const company = canonicalCompanyName(job.company || "");
    const key = normalizeCompanyKey(company);
    if (!key) return;
    const current = map.get(key) || { name: company, count: 0 };
    current.count += 1;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

function renderRepresentativeCompanies(companyCounts) {
  els.representativeCompanies.innerHTML = "";
  if (!companyCounts.length) {
    els.representativeCompanies.textContent = "-";
    return;
  }
  companyCounts.slice(0, 5).forEach(({ name, count }) => {
    const item = document.createElement("span");
    item.textContent = `${name} ${count}`;
    els.representativeCompanies.appendChild(item);
  });
}

function getJobAverageIncome(job) {
  const min = Number.isFinite(job.annualIncomeMin) ? job.annualIncomeMin : null;
  const max = Number.isFinite(job.annualIncomeMax) ? job.annualIncomeMax : null;
  if (min !== null && max !== null) return (min + max) / 2;
  if (max !== null) return max;
  if (min !== null) return min;
  return null;
}

function renderSkillChart(jobs) {
  const key = els.skillTypeFilter.value === "preferred" ? "preferredSkills" : "requiredSkills";
  const counts = countSkills(jobs, key);
  els.skillChart.innerHTML = "";
  els.skillChart.classList.toggle("empty", counts.length === 0);
  els.skillChart.classList.toggle("word-cloud", counts.length > 0);
  if (!counts.length) {
    els.skillChart.textContent = "データがありません";
    return;
  }

  renderWordCloud(els.skillChart, counts, "skill", key);
}

function renderCertificationChart(jobs) {
  const counts = countCertifications(jobs);
  els.certificationChart.innerHTML = "";
  els.certificationChart.classList.toggle("empty", counts.length === 0);
  els.certificationChart.classList.toggle("word-cloud", counts.length > 0);
  if (!counts.length) {
    els.certificationChart.textContent = "データがありません";
    return;
  }
  renderWordCloud(els.certificationChart, counts, "certification");
}

function renderWordCloud(container, counts, type = "skill", key = "") {
  const max = counts[0].count;
  const visibleCounts = prioritizeSelectedCounts(counts, type, key);
  visibleCounts.forEach(({ name, count }, index) => {
    const selected = isCurrentFacetFilter(name, type, key);
    const weight = count <= 1 || max <= 1 ? 0 : (count - 1) / (max - 1);
    const meta = getDictionaryMeta(name, type);
    const item = document.createElement("button");
    item.className = `cloud-word ${getWordCategoryClass(name, type, meta)}`;
    item.type = "button";
    const rgb = colorToRgb(meta.color);
    if (rgb) item.style.setProperty("--word-rgb", rgb);
    item.style.setProperty("--size", selected ? "17px" : `${12 + weight * 30}px`);
    item.style.setProperty("--alpha", `${0.46 + weight * 0.54}`);
    item.style.setProperty("--delay", `${index * 16}ms`);
    item.title = `${name}: ${count}件`;
    item.textContent = name;
    item.classList.toggle("is-filtering", selected);
    item.addEventListener("click", () => {
      toggleFacetFilter(name, type, key);
      render();
    });
    const badge = document.createElement("span");
    badge.textContent = count;
    item.appendChild(badge);
    container.appendChild(item);
  });
}

function prioritizeSelectedCounts(counts, type, key = "") {
  return [...counts].sort((a, b) => {
    const leftSelected = isCurrentFacetFilter(a.name, type, key);
    const rightSelected = isCurrentFacetFilter(b.name, type, key);
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    return b.count - a.count || a.name.localeCompare(b.name, "ja");
  });
}

function getDictionaryMeta(name, type) {
  const meta = window.JobParserConfig?.dictionaryMeta?.[type]?.[normalizeDictionaryKey(name)];
  return meta || {};
}

function getWordCategoryClass(name, type, meta = {}) {
  if (meta.category) return `word-${meta.category}`;
  if (type === "certification") return "word-certification";
  const value = normalizeSkill(name).toLowerCase();
  if (matchesTerm(value, [
    "javascript", "typescript", "python", "java", "c#", "c++", "go", "ruby", "php", "sql",
    "swift", "kotlin", "scala", "rust", "r", "vba", "shell", "bash", "powershell", "html", "css"
  ])) return "word-language";
  if (matchesTerm(value, [
    "react", "vue", "angular", "spring", "spring boot", "node.js", "next.js", "nuxt", "express",
    "nestjs", "django", "flask", "fastapi", "laravel", "rails", ".net", "asp.net", "unity", "unreal engine"
  ])) return "word-framework";
  if (matchesTerm(value, [
    "aws", "azure", "gcp", "docker", "kubernetes", "linux", "terraform", "ansible", "jenkins",
    "github actions", "ci/cd", "devops", "sre", "vmware", "openshift", "eks", "aks", "cloud run", "lambda",
    "オンプレミス", "クラウド", "windows server"
  ])) return "word-infra";
  if (matchesTerm(value, [
    "postgresql", "mysql", "oracle", "sql server", "mongodb", "redis", "elasticsearch", "dynamodb",
    "bigquery", "snowflake", "redshift", "databricks", "etl", "bi", "dwh", "データマート",
    "データ分析", "データ基盤", "データベース", "tableau", "power bi", "looker", "dbt"
  ])) return "word-data";
  if (matchesTerm(value, [
    "ai", "生成ai", "機械学習", "mlops", "llm", "rag", "kaggle", "pytorch", "tensorflow", "vllm",
    "hpc", "cpu", "npu", "gpgpu", "アクセラレータ"
  ])) return "word-ai";
  if (matchesTerm(value, [
    "scm", "erp", "sap", "sap s/4hana", "oracle cloud scm", "kinaxis", "kinaxis maestro", "anaplan", "o9",
    "mcframe", "サプライチェーン", "物流", "調達", "生産計画", "在庫", "品質管理",
    "組み込みシステム", "組み込み", "webシステム", "制御システム", "制御モデル",
    "車両性能シミュレーション", "モデルベース開発", "エンジニアリングシステム", "情報管理システム"
  ])) return "word-domain";
  if (matchesTerm(value, [
    "要件定義", "設計", "開発", "運用", "仕様定義", "上流工程", "詳細設計", "テスト",
    "基本設計", "外部設計", "内部設計", "単体テスト", "結合テスト", "総合テスト", "uat",
    "品質保証", "qa", "テスト自動化", "アジャイル", "スクラム", "ウォーターフォール", "api設計"
  ])) return "word-process";
  if (matchesTerm(value, [
    "プロジェクトマネジメント", "ステークホルダーマネジメント", "チームリード", "チームリーダー",
    "リーダー", "リーダーシップ", "テックリード", "リードエンジニア", "エンジニアリングマネージャー",
    "プロジェクトリーダー", "プロジェクトマネージャー", "プロジェクト推進", "サブリーダー",
    "マネジメント", "メンバーマネジメント", "ラインマネジメント", "組織マネジメント",
    "qcd", "顧客折衝", "pl", "pm", "pmo", "wbs", "課題管理", "リスク管理", "進捗管理",
    "予算管理", "要員管理", "体制構築", "チームビルディング", "ベンダーマネジメント",
    "ベンダー管理", "ベンダーコントロール", "パートナー管理", "パートナー折衝",
    "ピープルマネジメント", "プロダクトマネジメント", "プロダクトオーナー",
    "プロダクトオーナーシップ", "プロダクト責任者", "プロダクト企画", "ロードマップ策定",
    "pdm", "po", "チームマネジメント"
  ])) return "word-management";
  if (matchesTerm(value, [
    "セキュリティ", "ゼロトラスト", "認証", "認可", "oauth", "oidc", "saml", "active directory", "entra id"
  ])) return "word-security";
  return "word-general";
}

function matchesTerm(value, terms) {
  return terms.some((term) => value === term.toLowerCase());
}

function colorToRgb(color) {
  const value = String(color || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(value)) return "";
  const hex = value.slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16)
  ].join(", ");
}

function toggleFacetFilter(name, type, key = "") {
  const normalizedName = normalizeFacetName(name, type);
  if (!normalizedName) return;
  const index = state.activeFacetFilters.findIndex((filter) => isSameFacetFilter(filter, type, key, normalizedName));
  if (index >= 0) {
    state.activeFacetFilters.splice(index, 1);
    return;
  }
  state.activeFacetFilters.push({
    name: normalizedName,
    normalizedName: normalizedName.toLowerCase(),
    type,
    key
  });
}

function clearFacetFilters(type = "") {
  if (!type) {
    state.activeFacetFilters = [];
    return;
  }
  state.activeFacetFilters = state.activeFacetFilters.filter((filter) => filter.type !== type);
}

function isCurrentFacetFilter(name, type, key = "") {
  const normalizedName = normalizeFacetName(name, type);
  return state.activeFacetFilters.some((filter) => isSameFacetFilter(filter, type, key, normalizedName));
}

function isSameFacetFilter(filter, type, key, normalizedName) {
  return filter.type === type
    && filter.key === key
    && filter.normalizedName === normalizedName.toLowerCase();
}

function normalizeFacetName(name, type) {
  return type === "certification" ? normalizeCertification(name) : normalizeSkill(name);
}

function countActiveFilters(type) {
  return state.activeFacetFilters.filter((filter) => filter.type === type).length;
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
    const highlightTerms = getHighlightTerms();
    setHighlightedText(card.querySelector("h3"), job.title || "職種名未取得", highlightTerms);
    setHighlightedText(card.querySelector(".company"), job.company || "企業名未設定", highlightTerms);
    setHighlightedText(card.querySelector(".income"), job.annualIncomeRaw || "年収未取得", highlightTerms);
    renderMatchSummary(card.querySelector(".match-summary"), getJobMatchSummary(job, highlightTerms));
    renderJobDetails(card, job, highlightTerms);
    renderJobMeta(card.querySelector(".job-meta"), job);
    renderHighlightedList(card.querySelector(".required"), job.requiredSkills || [], highlightTerms);
    renderHighlightedList(card.querySelector(".preferred"), job.preferredSkills || [], highlightTerms);
    renderCertificationTags(card.querySelector(".certifications"), getJobCertifications(job), highlightTerms);
    const source = card.querySelector(".source");
    const hasSourcePage = job.sourceUrl && !job.sourceUrl.startsWith("manual:");
    source.href = hasSourcePage ? job.sourceUrl : "#";
    source.hidden = !hasSourcePage;
    container.appendChild(card);
  });
}

function renderJobDetails(card, job, highlightTerms) {
  const detailBlock = card.querySelector(".job-detail-block");
  const descriptionSection = card.querySelector(".description").closest("section");
  const notesSection = card.querySelector(".notes").closest("section");
  const description = job.description || "";
  const notes = job.notes || "";

  detailBlock.hidden = !description && !notes;
  descriptionSection.hidden = !description;
  notesSection.hidden = !notes;
  setHighlightedText(card.querySelector(".description"), description, highlightTerms);
  setHighlightedText(card.querySelector(".notes"), notes, highlightTerms);
}

function getHighlightTerms() {
  const query = els.searchInput.value.trim();
  return [...new Set([
    ...state.activeFacetFilters.map((filter) => filter.name),
    query,
    ...query.split(/\s+/)
  ].map(cleanText).filter(Boolean))];
}

function renderMatchSummary(container, matches) {
  container.innerHTML = "";
  container.hidden = matches.length === 0;
  matches.forEach(({ label, terms }) => {
    const item = document.createElement("span");
    item.textContent = `${label}: ${terms.join(" / ")}`;
    container.appendChild(item);
  });
}

function getJobMatchSummary(job, terms) {
  if (!terms.length) return [];
  const fields = [
    ["職種", [job.title]],
    ["企業", [job.company]],
    ["年収", [job.annualIncomeRaw]],
    ["職務内容", [job.description]],
    ["勤務地", [job.location]],
    ["必須", job.requiredSkills || []],
    ["推奨", job.preferredSkills || []],
    ["資格", getJobCertifications(job)],
    ["備考", [job.notes, job.appealPoints, job.requiredCertifications, job.preferredCertifications]]
  ];

  return fields
    .map(([label, values]) => ({
      label,
      terms: terms.filter((term) => values.some((value) => textContainsTerm(value, term))).slice(0, 4)
    }))
    .filter((item) => item.terms.length);
}

function textContainsTerm(value, term) {
  const normalizedValue = normalizeSkill(value).toLowerCase();
  const normalizedTerm = normalizeSkill(term).toLowerCase();
  return normalizedValue.includes(normalizedTerm);
}

function getJobCertifications(job) {
  const sources = [
    job.requiredCertifications,
    job.preferredCertifications,
    job.notes,
    job.description,
    job.appealPoints,
    job.referenceInfo,
    ...(job.requiredSkills || []),
    ...(job.preferredSkills || [])
  ];
  return [...new Set(sources
    .flatMap((value) => extractCertificationsFromText(value || ""))
    .map(normalizeCertification)
    .filter(Boolean))];
}

function renderCertificationTags(container, certifications, highlightTerms = []) {
  container.innerHTML = "";
  container.classList.toggle("certification-tags", certifications.length > 0);
  if (!certifications.length) {
    container.textContent = "-";
    return;
  }
  certifications.forEach((certification) => {
    const tag = document.createElement("span");
    setHighlightedText(tag, certification, highlightTerms);
    container.appendChild(tag);
  });
}

function renderHighlightedList(container, values, highlightTerms = []) {
  container.innerHTML = "";
  if (!values.length) {
    container.textContent = "-";
    return;
  }
  values.forEach((value, index) => {
    if (index > 0) container.appendChild(document.createTextNode(", "));
    const item = document.createElement("span");
    setHighlightedText(item, value, highlightTerms);
    container.appendChild(item);
  });
}

function setHighlightedText(element, value, highlightTerms = []) {
  element.innerHTML = "";
  const text = String(value || "");
  const terms = normalizeHighlightTerms(highlightTerms);
  if (!text || !terms.length) {
    element.textContent = text;
    return;
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  let lastIndex = 0;
  text.replace(pattern, (match, _term, offset) => {
    if (offset > lastIndex) {
      element.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
    }
    const mark = document.createElement("mark");
    mark.textContent = match;
    element.appendChild(mark);
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < text.length) {
    element.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function normalizeHighlightTerms(terms) {
  const seen = new Set();
  return terms
    .map(cleanText)
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
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
  const facetFiltered = state.activeFacetFilters.reduce(filterJobsByFacet, jobs);
  const query = els.searchInput.value.trim().toLowerCase();
  if (!query) return facetFiltered;
  return facetFiltered.filter((job) => [
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

function filterJobsByFacet(jobs, filter) {
  if (filter.type === "certification") {
    return jobs.filter((job) => getJobCertifications(job)
      .some((certification) => normalizeCertification(certification).toLowerCase() === filter.normalizedName));
  }

  if (filter.type === "skill" && filter.key) {
    return jobs.filter((job) => (job[filter.key] || [])
      .some((skill) => normalizeSkill(skill).toLowerCase() === filter.normalizedName));
  }

  return jobs;
}

function countSkills(jobs, key) {
  const map = new Map();
  jobs.forEach((job) => {
    const jobSkills = new Set((job[key] || []).map(normalizeSavedSkill).filter(Boolean));
    jobSkills.forEach((skill) => {
      map.set(skill, (map.get(skill) || 0) + 1);
    });
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

function countCertifications(jobs) {
  const map = new Map();
  jobs.forEach((job) => {
    const jobCertifications = new Set(getJobCertifications(job).map(normalizeCertification).filter(Boolean));
    jobCertifications.forEach((certification) => {
      map.set(certification, (map.get(certification) || 0) + 1);
    });
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

function renderDictionarySettings() {
  renderDictionaryEditor("skill");
  renderSkillCategoryEditor();
  renderDictionaryEditor("certification");
  refreshSkillCategorySelects();
  renderDictionaryCounts();
}

function renderDictionaryEditor(type) {
  const editor = type === "skill" ? els.skillDictionaryEditor : els.certificationDictionaryEditor;
  if (!editor) return;
  editor.innerHTML = "";
  const entries = getDictionaryEntries(type);
  entries.forEach((entry) => editor.appendChild(createDictionaryRow(entry, type)));
  if (!entries.length) editor.appendChild(createDictionaryRow({ term: "", category: type === "certification" ? "certification" : "general", color: getCategoryColor(type === "certification" ? "certification" : "general") }, type));
}

function renderDictionaryCounts() {
  if (els.skillDictionaryCount) {
    els.skillDictionaryCount.textContent = `${countDictionaryRows("skill")}件`;
  }
  if (els.certificationDictionaryCount) {
    els.certificationDictionaryCount.textContent = `${countDictionaryRows("certification")}件`;
  }
}

function countDictionaryRows(type) {
  const editor = getDictionaryEditor(type);
  if (!editor) return 0;
  return [...editor.querySelectorAll("[data-dictionary-row]")]
    .filter((row) => cleanText(row.querySelector("[data-dictionary-field='term']")?.value || ""))
    .length;
}

function createDictionaryRow(entry, type) {
  const row = document.createElement("div");
  row.className = "dictionary-row";
  row.dataset.dictionaryRow = type;

  const termLabel = document.createElement("label");
  termLabel.textContent = type === "skill" ? "スキル名" : "資格名";
  const term = document.createElement("input");
  term.dataset.dictionaryField = "term";
  term.type = "text";
  term.value = entry.term || "";
  term.placeholder = type === "skill" ? "例: Python" : "例: PMP";
  termLabel.appendChild(term);

  const deleteButton = document.createElement("button");
  deleteButton.className = "danger-button compact-button";
  deleteButton.dataset.deleteDictionaryRow = type;
  deleteButton.type = "button";
  deleteButton.textContent = "削除";

  if (type === "skill") {
    const categoryLabel = document.createElement("label");
    categoryLabel.textContent = "カテゴリ";
    const category = document.createElement("select");
    category.dataset.dictionaryField = "category";
    fillSkillCategorySelect(category, entry.category || inferDictionaryCategory(entry.term || "", type));
    categoryLabel.appendChild(category);
    row.append(termLabel, categoryLabel, deleteButton);
  } else {
    row.classList.add("dictionary-row-simple");
    row.append(termLabel, deleteButton);
  }
  return row;
}

function renderSkillCategoryEditor() {
  const editor = els.skillCategoryEditor;
  if (!editor) return;
  editor.innerHTML = "";
  const categories = getSkillCategoryEntries();
  categories.forEach((entry) => editor.appendChild(createSkillCategoryRow(entry)));
}

function createSkillCategoryRow(entry) {
  const row = document.createElement("div");
  row.className = "dictionary-row dictionary-category-row";
  row.dataset.dictionaryRow = "skill-category";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "カテゴリ";
  const name = document.createElement("input");
  name.dataset.dictionaryField = "category";
  name.type = "text";
  name.value = entry.category || "";
  nameLabel.appendChild(name);

  const colorLabel = document.createElement("label");
  colorLabel.textContent = "カラー";
  colorLabel.className = "dictionary-color-label";
  const color = document.createElement("input");
  color.dataset.dictionaryField = "color";
  color.type = "color";
  color.value = normalizeColor(entry.color) || getCategoryColor(entry.category) || "#25d6a2";
  colorLabel.appendChild(color);

  const deleteButton = document.createElement("button");
  deleteButton.className = "danger-button compact-button";
  deleteButton.dataset.deleteDictionaryRow = "skill-category";
  deleteButton.type = "button";
  deleteButton.textContent = "削除";

  row.append(nameLabel, colorLabel, deleteButton);
  return row;
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
    meta.textContent = [
      job.company,
      job.annualIncomeRaw,
      job.location,
      formatJobRegisteredAt(job)
    ].filter(Boolean).join(" / ") || "詳細情報なし";
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

function formatJobRegisteredAt(job) {
  const value = job.crawledAt || job.createdAt || job.updatedAt;
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `登録日時: ${date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

async function handleDictionarySave(event) {
  event.preventDefault();
  const skillCategoryEntries = readSkillCategoryEntries();
  const categoryColors = toCategoryColorMap(skillCategoryEntries);
  const skillEntries = readDictionaryEditor("skill", categoryColors);
  const certificationEntries = readDictionaryEditor("certification");
  const skillDictionary = skillEntries.map((entry) => entry.term);
  const certificationDictionary = certificationEntries.map((entry) => entry.term);
  window.JobParserConfig.skillDictionary = skillDictionary;
  window.JobParserConfig.certificationDictionary = certificationDictionary;
  window.JobParserConfig.dictionaryCategories = { skill: skillCategoryEntries };
  window.JobParserConfig.dictionaryMeta = buildDictionaryMeta([...skillEntries, ...certificationEntries]);
  renderDictionaryCounts();
  try {
    await saveDictionaryTerms(skillEntries, certificationEntries, skillCategoryEntries);
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

function handleDictionaryEditorClick(event) {
  const addType = event.target.closest("[data-add-dictionary-row]")?.dataset.addDictionaryRow;
  if (addType) {
    const editor = getDictionaryEditor(addType);
    const row = addType === "skill-category"
      ? createSkillCategoryRow({ category: "", color: "#25d6a2" })
      : createDictionaryRow({
          term: "",
          category: addType === "certification" ? "certification" : "general",
          color: getCategoryColor(addType === "certification" ? "certification" : "general")
        }, addType);
    editor?.prepend(row);
    row.querySelector("[data-dictionary-field='term'], [data-dictionary-field='category']")?.focus();
    return;
  }

  const deleteButton = event.target.closest("[data-delete-dictionary-row]");
  if (deleteButton) {
    const deletedType = deleteButton.dataset.deleteDictionaryRow;
    deleteButton.closest("[data-dictionary-row]")?.remove();
    if (deletedType === "skill-category") refreshSkillCategorySelects();
    renderDictionaryCounts();
  }
}

function handleDictionaryEditorChange(event) {
  if (event.target.closest("[data-dictionary-row='skill-category'] [data-dictionary-field='category']")) refreshSkillCategorySelects();
  if (event.target.closest("[data-dictionary-field='term']")) renderDictionaryCounts();
}

function handleDictionaryEditorInput(event) {
  if (event.target.closest("[data-dictionary-field='term']")) renderDictionaryCounts();
}

async function resetDictionarySettings() {
  const config = window.JobParserConfig;
  config.skillDictionary = [...(config.defaultSkillDictionary || [])];
  config.certificationDictionary = [...(config.defaultCertificationDictionary || [])];
  const skillEntries = normalizeDictionaryEntries(config.skillDictionary, "skill");
  const certificationEntries = normalizeDictionaryEntries(config.certificationDictionary, "certification");
  const categoryEntries = deriveSkillCategories(skillEntries);
  config.dictionaryCategories = { skill: categoryEntries };
  config.dictionaryMeta = buildDictionaryMeta([...skillEntries, ...certificationEntries]);
  localStorage.removeItem(DICTIONARY_STORAGE_KEY);
  try {
    await saveDictionaryTerms(skillEntries, certificationEntries, categoryEntries);
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

function parseDictionaryInput(value, type) {
  return normalizeDictionaryEntries(
    value
      .split(/\n/)
      .map((line) => {
        const [term, category, color] = line.split("|").map((item) => cleanText(item));
        return { term, category, color };
      }),
    type
  );
}

function readDictionaryEditor(type, categoryColors = new Map()) {
  const editor = getDictionaryEditor(type);
  if (!editor) return [];
  return normalizeDictionaryEntries([...editor.querySelectorAll("[data-dictionary-row]")]
    .map((row) => ({
      term: row.querySelector("[data-dictionary-field='term']")?.value || "",
      category: row.querySelector("[data-dictionary-field='category']")?.value || "",
      color: categoryColors.get(normalizeDictionaryKey(row.querySelector("[data-dictionary-field='category']")?.value || "")) || ""
    })), type);
}

function readSkillCategoryEntries() {
  if (!els.skillCategoryEditor) return [];
  return normalizeDictionaryCategories([...els.skillCategoryEditor.querySelectorAll("[data-dictionary-row='skill-category']")].map((row) => ({
    category: row.querySelector("[data-dictionary-field='category']")?.value || "",
    color: row.querySelector("[data-dictionary-field='color']")?.value || ""
  })));
}

function toCategoryColorMap(entries) {
  const map = new Map();
  normalizeDictionaryCategories(entries).forEach((entry) => {
    map.set(normalizeDictionaryKey(entry.category), entry.color);
  });
  return map;
}

function normalizeDictionaryCategories(entries = []) {
  const map = new Map();
  entries.forEach((entry) => {
    const category = cleanText(entry?.category);
    const color = normalizeColor(entry?.color);
    if (category && category !== "certification") {
      map.set(normalizeDictionaryKey(category), {
        category,
        color: color || getCategoryColor(category) || "#25d6a2"
      });
    }
  });
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category, "ja"));
}

function deriveSkillCategories(skillEntries) {
  return normalizeDictionaryCategories([
    ...getDefaultDictionaryCategories("skill"),
    ...normalizeDictionaryEntries(skillEntries, "skill")
      .map((entry) => ({
        category: entry.category,
        color: entry.color || getCategoryColor(entry.category)
      }))
  ]);
}

function applyCategoryColorsToDictionaryRows(rows, categoryEntries) {
  const categoryColors = toCategoryColorMap(categoryEntries);
  return rows.map((row) => ({
    ...row,
    color: row.type === "skill" || row.dictionary_type === "skill"
      ? categoryColors.get(normalizeDictionaryKey(row.category || "")) || row.color || getCategoryColor(row.category)
      : row.color
  }));
}

function getDictionaryEditor(type) {
  if (type === "skill") return els.skillDictionaryEditor;
  if (type === "skill-category") return els.skillCategoryEditor;
  return els.certificationDictionaryEditor;
}

function normalizeDictionaryEntries(entries, type) {
  const map = new Map();
  entries.forEach((entry) => {
    const normalized = typeof entry === "string"
      ? { term: cleanText(entry), category: "", color: "" }
      : {
          term: cleanText(entry?.term),
          category: cleanText(entry?.category),
          color: cleanText(entry?.color)
        };
    if (!normalized.term) return;
    if (!normalized.category) normalized.category = inferDictionaryCategory(normalized.term, type);
    if (!normalized.color) normalized.color = getCategoryColor(normalized.category);
    map.set(normalizeDictionaryKey(normalized.term), { ...normalized, type });
  });
  return [...map.values()];
}

function formatDictionaryInput(type) {
  const config = window.JobParserConfig || {};
  return (type === "skill" ? config.skillDictionary || [] : config.certificationDictionary || [])
    .map((term) => {
      const meta = config.dictionaryMeta?.[type]?.[normalizeDictionaryKey(term)] || {};
      return [term, meta.category, meta.color].filter(Boolean).join(" | ");
    })
    .join("\n");
}

function getDictionaryEntries(type) {
  const config = window.JobParserConfig || {};
  return normalizeDictionaryEntries(type === "skill" ? config.skillDictionary || [] : config.certificationDictionary || [], type)
    .map((entry) => {
      const meta = config.dictionaryMeta?.[type]?.[normalizeDictionaryKey(entry.term)] || {};
      return {
        ...entry,
        category: meta.category || entry.category,
        color: meta.color || entry.color
      };
    });
}

function getSkillCategoryEntries() {
  const config = window.JobParserConfig || {};
  const map = new Map();
  normalizeDictionaryCategories(config.dictionaryCategories?.skill || []).forEach((entry) => {
    map.set(normalizeDictionaryKey(entry.category), entry);
  });
  getDictionaryEntries("skill").forEach((entry) => {
    const category = entry.category || inferDictionaryCategory(entry.term, "skill");
    if (!category || category === "certification") return;
    const key = normalizeDictionaryKey(category);
    if (!map.has(key)) {
      map.set(key, {
        category,
        color: normalizeColor(entry.color) || getCategoryColor(category) || "#25d6a2"
      });
    }
  });
  Object.entries(getDefaultCategoryColors()).forEach(([category, color]) => {
    if (category === "certification") return;
    const key = normalizeDictionaryKey(category);
    if (!map.has(key)) map.set(key, { category, color });
  });
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category, "ja"));
}

function refreshSkillCategorySelects() {
  const categories = getCurrentSkillCategories();
  els.skillDictionaryEditor?.querySelectorAll("select[data-dictionary-field='category']").forEach((select) => {
    fillSkillCategorySelect(select, select.value);
  });
  return categories;
}

function fillSkillCategorySelect(select, selectedValue) {
  const categories = getCurrentSkillCategories();
  const current = cleanText(selectedValue);
  select.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  if (current && !categories.includes(current)) {
    const option = document.createElement("option");
    option.value = current;
    option.textContent = current;
    select.appendChild(option);
  }
  select.value = current || categories[0] || "general";
}

function getCurrentSkillCategories() {
  const categories = new Set(getSkillCategoryEntries().map((entry) => entry.category));
  if (els.skillCategoryEditor) {
    [...els.skillCategoryEditor.querySelectorAll("[data-dictionary-field='category']")]
      .map((input) => cleanText(input.value))
      .filter(Boolean)
      .forEach((category) => categories.add(category));
  }
  return [...categories].sort((a, b) => a.localeCompare(b, "ja"));
}

function normalizeColor(value) {
  const color = cleanText(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function normalizeDictionaryKey(term) {
  return normalizeSkill(term).toLowerCase();
}

function inferDictionaryCategory(term, type) {
  if (type === "certification") return "certification";
  return getWordCategoryClass(term, "skill").replace(/^word-/, "");
}

function getCategoryColor(category) {
  return getDefaultCategoryColors()[category] || "";
}

function getDefaultCategoryColors() {
  return {
    language: "#f89797",
    framework: "#fbbf7e",
    infra: "#7dd3fc",
    data: "#67e8f9",
    ai: "#c4b5fd",
    domain: "#93c5fd",
    process: "#a7f3d0",
    management: "#fde047",
    security: "#fca5a5",
    certification: "#d8b4fe",
    general: "#25d6a2"
  };
}

function getDefaultDictionaryCategories(type = "skill") {
  if (type !== "skill") return [];
  return Object.entries(getDefaultCategoryColors())
    .filter(([category]) => category !== "certification")
    .map(([category, color]) => ({ category, color }));
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
  const duplicate = findDuplicateSkillProfileJob(job);
  setManualDuplicateWarning(duplicate);
  if (duplicate) {
    setInputStatus("解析しました。重複の可能性があります。保存前に内容を確認してください。");
    return;
  }
  setInputStatus("解析しました。必要に応じて編集してから保存してください。");
}

function findDuplicateSkillProfileJob(targetJob) {
  const targetProfile = getSkillProfileKey(targetJob);
  if (!targetProfile) return null;
  return state.jobs.find((job) => getSkillProfileKey(job) === targetProfile) || null;
}

function getSkillProfileKey(job) {
  const required = normalizeProfileList(job.requiredSkills || [], normalizeSavedSkill);
  const preferred = normalizeProfileList(job.preferredSkills || [], normalizeSavedSkill);
  const certifications = normalizeProfileList(getJobCertifications(job), normalizeCertification);
  if (!required.length && !preferred.length && !certifications.length) return "";
  return JSON.stringify({ required, preferred, certifications });
}

function normalizeProfileList(values, normalizer) {
  return [...new Set(values.map(normalizer).filter(Boolean).map((value) => value.toLowerCase()))].sort();
}

async function saveManualDraft() {
  if (!state.manualDraft) {
    setInputStatus("先に求人票を解析してください。");
    return;
  }
  try {
    const job = readManualEditorJob();
    const duplicate = findDuplicateSkillProfileJob(job);
    setManualDuplicateWarning(duplicate);
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
  const detectedCompany = detectCompanyFromText(normalized, fallbackCompany);
  const parser = getCompanyParser(detectedCompany);
  const headings = parser.headings || {};
  const company = canonicalCompanyName(pickSection(normalized, headings.company, parser) || detectedCompany || fallbackCompany || "未設定");
  const title = pickManualTitle(normalized, parser);
  const description = pickSection(normalized, headings.description, parser) || "";
  const appealPoints = pickSection(normalized, headings.appealPoints, parser) || "";
  const referenceInfo = pickSection(normalized, headings.referenceInfo, parser) || "";
  let requiredSkillsRaw = pickSection(normalized, headings.requiredSkills, parser);
  let preferredSkillsRaw = pickSection(normalized, headings.preferredSkills, parser);
  if (company === "NEC") {
    const necQualifications = extractNecQualificationBlocks(normalized);
    requiredSkillsRaw = necQualifications.must || requiredSkillsRaw;
    preferredSkillsRaw = necQualifications.want || preferredSkillsRaw;
  }
  const requiredLanguage = pickSection(normalized, headings.requiredLanguage, parser);
  const requiredCertifications = pickSection(normalized, headings.requiredCertifications, parser);
  const preferredLanguage = pickSection(normalized, headings.preferredLanguage, parser);
  const preferredCertifications = pickSection(normalized, headings.preferredCertifications, parser);
  const annualIncomeSource = pickSection(normalized, headings.income, parser) || findIncomeText(normalized);
  const income = parseIncome(annualIncomeSource);
  const annualIncomeRaw = formatIncomeRaw(annualIncomeSource, income);
  const location = pickSection(normalized, headings.location, parser);
  const notes = referenceInfo || "";

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

function extractNecQualificationBlocks(text) {
  const blocks = { must: [], want: [] };
  let current = "";
  let hasCurrentContent = false;
  const stopPattern = /^(待遇 \/ Salary & Benefits|勤務地 \/ Location|備考 \/ Notes|【求める人物像・ソフトスキル】|【採用形態・ランク】|【想定報酬】)$/;
  const rankPattern = /^(主任の場合|プロフェッショナル（課長相当）の場合)$/;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (stopPattern.test(line)) break;
    if (line === "【MUST】") {
      current = "must";
      hasCurrentContent = false;
      continue;
    }
    if (line === "【WANT】") {
      current = "want";
      hasCurrentContent = false;
      continue;
    }
    if (rankPattern.test(line)) {
      if (hasCurrentContent) current = "";
      continue;
    }
    if (!current) continue;
    blocks[current].push(line);
    hasCurrentContent = true;
  }

  return {
    must: cleanText(blocks.must.join("\n")),
    want: cleanText(blocks.want.join("\n"))
  };
}

function renderManualEditor(job) {
  els.manualEditor.hidden = false;
  els.manualEditor.innerHTML = `
    <div class="panel-head editor-head">
      <h2>保存前編集</h2>
      <div class="manual-save-actions">
        <button class="primary-button" id="manualSaveButton" type="button">この内容で保存</button>
        <div id="manualDuplicateWarning" class="duplicate-warning" hidden></div>
      </div>
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
    <label>補足<textarea data-field="notes" rows="5"></textarea></label>
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
  els.manualEditor.addEventListener("input", updateManualDuplicateWarningFromEditor);
}

function updateManualDuplicateWarningFromEditor() {
  if (!state.manualDraft || els.manualEditor.hidden) return;
  const job = readManualEditorJob();
  setManualDuplicateWarning(findDuplicateSkillProfileJob(job));
}

function setManualDuplicateWarning(duplicate) {
  const warning = els.manualEditor.querySelector("#manualDuplicateWarning");
  if (!warning) return;
  warning.hidden = !duplicate;
  warning.textContent = duplicate
    ? `重複の可能性: ${duplicate.company || "企業名未設定"} / ${duplicate.title || "職種名未取得"}`
    : "";
}

function setEditorValue(field, value) {
  const input = els.manualEditor.querySelector(`[data-field="${field}"]`);
  if (input) input.value = value || "";
}

function readManualEditorJob() {
  const get = (field) => els.manualEditor.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
  const annualIncomeSource = get("annualIncomeRaw");
  const income = parseIncome(annualIncomeSource);
  const annualIncomeRaw = formatIncomeRaw(annualIncomeSource, income);
  const parser = getCompanyParser(get("company") || state.manualDraft?.company);
  const job = {
    ...state.manualDraft,
    company: canonicalCompanyName(get("company") || "未設定"),
    title: get("title"),
    description: get("description"),
    annualIncomeRaw,
    annualIncomeMin: income.min,
    annualIncomeMax: income.max,
    location: get("location"),
    requiredSkills: splitEditorList(get("requiredSkills"), parser),
    preferredSkills: splitEditorList(get("preferredSkills"), parser),
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

function splitEditorList(value, parser = getCompanyParser()) {
  const ignorePattern = new RegExp(parser.ignoreSkillPatterns?.join("|") || "$^");
  return [...new Set(value.split(/\n|,|、/).map(normalizeSavedSkill).filter((skill) => isSavedSkillValid(skill, ignorePattern)))];
}

function getCompanyParser(company) {
  const config = window.JobParserConfig || {};
  const canonical = canonicalCompanyName(company);
  return config.companies?.[canonical] || config.companies?.[company] || config.companies?.[config.defaultCompany] || {
    headings: {},
    sectionHeadings: [],
    ignoreSkillPatterns: []
  };
}

function detectCompanyFromText(text, fallbackCompany) {
  if (/株式会社NTTデータ|NTTデータ株式会社|NTT\s*データ|NTT\s*DATA/i.test(text)) return canonicalCompanyName("株式会社NTTデータ");
  if (/富士通株式会社|富士通\s*Japan\s*株式会社|Fujitsu\s*Japan|Fujitsu/i.test(text)) return canonicalCompanyName("富士通株式会社");
  if (/日本電気株式会社|\bNEC\b|医療DX|厚生労働省/.test(text)) return canonicalCompanyName("NEC");
  if (/EC本部|トヨタ自動車|トヨタグループ|Teamcenter|TargetLink/.test(text)) {
    return canonicalCompanyName("株式会社トヨタシステムズ");
  }
  return canonicalCompanyName(fallbackCompany || "");
}

function canonicalCompanyName(name) {
  const raw = cleanCompanyName(name);
  if (!raw) return "";
  const companies = window.JobParserConfig?.companies || {};
  const normalizedRaw = normalizeCompanyKey(raw);
  for (const [canonical, parser] of Object.entries(companies)) {
    const names = [canonical, ...(parser.aliases || [])];
    if (names.some((candidate) => normalizeCompanyKey(candidate) === normalizedRaw)) {
      return canonical;
    }
  }
  return formatUnknownCompanyName(raw);
}

function isFujitsuParserCompany(name) {
  const key = normalizeCompanyKey(name);
  return key === "富士通"
    || key === "富士通japan"
    || key === "fujitsu"
    || key === "fujitsujapan"
    || key === "fujitsulimited";
}

function cleanCompanyName(name) {
  return String(name || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*(株式会社|有限会社)\s*/g, "$1")
    .trim();
}

function normalizeCompanyKey(name) {
  return cleanCompanyName(name)
    .toLowerCase()
    .replace(/[\s・._-]+/g, "")
    .replace(/^株式会社/, "")
    .replace(/株式会社$/, "");
}

function formatUnknownCompanyName(name) {
  const cleaned = cleanCompanyName(name);
  if (!/(株式会社|有限会社)/.test(cleaned)) return cleaned;
  return cleaned
    .replace(/\s+/g, "")
    .replace(/japan/i, "Japan");
}

function pickManualTitle(text, parser) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const pattern = getTitlePattern(parser);
  const matches = lines.filter((line) => pattern.test(line));
  const matchIndex = Number.isInteger(parser.titleMatchIndex) ? parser.titleMatchIndex : 0;
  const titleLine = matches[matchIndex] || matches[0] || lines[0] || "";
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
  const start = lines.findIndex((line) => labels.some((label) => isLabelLine(line, label)));
  if (start < 0) return "";
  const values = [];
  const inlineValue = getInlineLabelValue(lines[start], labels);
  if (inlineValue && !/^【[^】]+】$/.test(inlineValue)) values.push(inlineValue);
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line && headings.some((heading) => line === heading || line.includes(heading))) break;
    values.push(lines[i]);
  }
  return cleanText(values.join("\n"));
}

function isLabelLine(line, label) {
  const trimmed = line.trim();
  return trimmed === label || trimmed.startsWith(`${label}\t`) || trimmed.startsWith(`${label} `) || trimmed.includes(label);
}

function getInlineLabelValue(line, labels = []) {
  const trimmed = line.trim();
  const label = labels.find((item) => isLabelLine(trimmed, item));
  if (!label) return "";
  const index = trimmed.indexOf(label);
  if (index < 0) return "";
  return trimmed
    .slice(index + label.length)
    .replace(/^[\s\t:：]+/, "")
    .trim();
}

function findIncomeText(text) {
  const match = text.match(/(?:年収|給与|想定年収|待遇).{0,80}?(\d{3,4}).{0,20}?万円?(?:.{0,20}?(\d{3,4}).{0,20}?万円?)?/);
  return match ? match[0] : "";
}

function parseIncome(raw) {
  const target = pickIncomeTarget(raw);
  const yenValues = (target.match(/\d[\d,]{4,}/g) || [])
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => value >= 10000)
    .map((value) => Math.round(value / 10000));
  const values = yenValues.length
    ? yenValues
    : (target.match(/\d{3,4}/g) || []).map(Number);
  return {
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null
  };
}

function pickIncomeTarget(raw) {
  const lines = String(raw || "").split(/\n|。|■/).map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /年収|想定年収/.test(item)) || raw || "";
  const match = String(line).match(/(?:想定年収|年収)[\s\S]*/);
  const target = match ? match[0] : String(line);
  return target.split(/(?:月給|基本給|賃金形態|残業手当|通勤手当|退職金|社会保険|所定労働時間)/)[0].trim();
}

function formatIncomeRaw(raw, income) {
  if (!Number.isFinite(income.min) && !Number.isFinite(income.max)) return cleanText(raw);
  if (Number.isFinite(income.min) && Number.isFinite(income.max) && income.min !== income.max) {
    return `${income.min}-${income.max}万円`;
  }
  const value = Number.isFinite(income.min) ? income.min : income.max;
  return `${value}万円`;
}

function extractSkillsFromText(raw, parser = getCompanyParser()) {
  if (!raw) return [];
  const known = window.JobParserConfig?.skillDictionary || [];
  const ignorePattern = new RegExp(parser.ignoreSkillPatterns?.join("|") || "$^");
  const found = known.filter((skill) => new RegExp(escapeRegExp(skill), "i").test(raw));
  const bulletItems = raw
    .split(/\n|・|●|■|,|、|;/)
    .map((item) => cleanText(item).replace(/^[\-\u30fb\s]+/, ""))
    .flatMap(extractSkillPhrases)
    .filter((item) => isSkillLikeText(item, ignorePattern));
  return filterSkillsByDictionary([...found, ...bulletItems]).slice(0, 24);
}

function extractSkillPhrases(item) {
  const cleaned = cleanText(item);
  if (!cleaned) return [];
  const phrases = [cleaned];
  const patterns = [
    /^(.+?)としての/,
    /^(.+?)を活用した/,
    /^(.+?)を扱った/,
    /^(.+?)の分析/,
    /^(.+?)の解析/,
    /^(.+?)に.*従事/
  ];
  patterns.forEach((pattern) => {
    const match = cleaned.match(pattern);
    if (match?.[1]) phrases.push(match[1]);
  });
  return phrases.map((phrase) => phrase.replace(/^(以下のいずれかの)?/, "").trim()).filter(Boolean);
}

function isSkillLikeText(item, ignorePattern) {
  if (!item || item.length < 2 || item.length > 24) return false;
  if (isExcludedSkillText(item)) return false;
  if (ignorePattern.test(item)) return false;
  if (/[のにをはがでへもとや]/.test(item)) return false;
  if (/[（）()]/.test(item)) return false;
  if (/[。！？!?]/.test(item)) return false;
  if (/(方|こと|もの|ため|場合|いずれか|下記|要件|満たす|お持ち|興味|ある|できる|したい|いただく|いただき|ください|経験がある|経験をお持ち|活用したこと|業界|会社|領域向け)$/.test(item)) return false;
  if (/(に関する|について|として|もしくは|または|および|ならびに|かつ|等において|どこかの|若手の方|経験あり|経験があり|経験を有する|担当経験|開発経験を|知見もしくは|業務知見もしくは)/.test(item)) return false;
  if (/(をお持ち|を活用|を担当|を推進|を支援|を行|を実施|を経験|を目指|に興味|に精通|に参画|に従事|に携わ|における|に向け|に至る|から|まで|より)/.test(item)) return false;
  if (/(下記|以下|上記|例|目安|歓迎|必須|応募|募集|求める|対象|職務|業務|待遇|勤務地|語学|資格|経験|知識|スキル).{4,}/.test(item)) return false;
  if (item.length > 14 && !/[A-Za-z0-9]/.test(item)) return false;
  return true;
}

function isExcludedSkillText(item) {
  const normalized = normalizeSkill(item);
  if (!normalized) return true;
  return EXCLUDED_SKILL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function extractCertificationsFromText(raw) {
  if (!raw) return [];
  const dictionary = window.JobParserConfig?.certificationDictionary || [];
  return [...new Set(dictionary
    .filter((name) => new RegExp(escapeRegExp(name), "i").test(raw))
    .map(normalizeCertification)
    .filter(Boolean))];
}

function normalizeCertification(certification) {
  const normalized = normalizeSkill(certification);
  if (!normalized) return "";
  const key = normalized.toLowerCase();
  if (EXCLUDED_CERTIFICATIONS.has(key)) return "";
  return CERTIFICATION_ALIASES[key] || normalized;
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

function normalizeSavedSkill(skill) {
  const normalized = normalizeSkill(skill);
  if (!normalized) return "";
  const dictionary = window.JobParserConfig?.skillDictionary || [];
  const matched = dictionary.find((term) => term.toLowerCase() === normalized.toLowerCase());
  return matched || normalized;
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
