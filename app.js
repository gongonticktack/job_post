"use strict";

const DB_NAME = "job-post-analytics";
const DB_VERSION = 1;
const STORE = "jobs";

const sampleJobs = [
  {
    company: "NTT DATA",
    title: "データ活用基盤エンジニア",
    description: "データ基盤の設計、ETL開発、分析環境の運用改善を担当します。",
    annualIncomeRaw: "650万円 - 1,050万円",
    annualIncomeMin: 650,
    annualIncomeMax: 1050,
    requiredSkills: ["SQL", "Python", "クラウド", "データ基盤"],
    preferredSkills: ["AWS", "生成AI", "プロジェクトマネジメント"],
    notes: "サンプルデータです。Supabase接続前の表示確認にも使えます。",
    sourceUrl: "https://nttdata-career.jposting.net/joblist/sample-1",
    crawledAt: new Date().toISOString()
  },
  {
    company: "NTT DATA",
    title: "業務アプリケーション開発リーダー",
    description: "顧客業務の要件定義から開発、保守改善までをリードします。",
    annualIncomeRaw: "600万円 - 900万円",
    annualIncomeMin: 600,
    annualIncomeMax: 900,
    requiredSkills: ["Java", "要件定義", "SQL", "チームリード"],
    preferredSkills: ["Spring", "クラウド", "アジャイル"],
    notes: "サンプルデータです。",
    sourceUrl: "https://nttdata-career.jposting.net/joblist/sample-2",
    crawledAt: new Date().toISOString()
  }
];

const state = {
  jobs: [],
  db: null,
  supabase: null,
  crawlApiAvailable: true
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  jobCount: document.querySelector("#jobCount"),
  companyCount: document.querySelector("#companyCount"),
  requiredSkillCount: document.querySelector("#requiredSkillCount"),
  avgIncome: document.querySelector("#avgIncome"),
  skillTypeFilter: document.querySelector("#skillTypeFilter"),
  skillChart: document.querySelector("#skillChart"),
  searchInput: document.querySelector("#searchInput"),
  jobList: document.querySelector("#jobList"),
  crawlForm: document.querySelector("#crawlForm"),
  crawlUrl: document.querySelector("#crawlUrl"),
  companyName: document.querySelector("#companyName"),
  crawlLimit: document.querySelector("#crawlLimit"),
  crawlStatus: document.querySelector("#crawlStatus"),
  crawlPreview: document.querySelector("#crawlPreview"),
  seedButton: document.querySelector("#seedButton"),
  template: document.querySelector("#jobCardTemplate")
};

init();

async function init() {
  state.db = await openDb();
  state.supabase = await loadSupabaseConfig();
  bindEvents();
  await refresh();
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  els.skillTypeFilter.addEventListener("change", render);
  els.searchInput.addEventListener("input", render);
  els.seedButton.addEventListener("click", async () => {
    await saveJobs(sampleJobs);
    setStatus("サンプル求人を保存しました。TOPでスキル傾向を確認できます。");
    await refresh();
  });
  els.crawlForm.addEventListener("submit", handleCrawl);
}

async function apiRequest(path, options = {}) {
  if (!state.crawlApiAvailable) throw new Error("API unavailable");
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error ${response.status}`);
  }
  return response.json();
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
    throw new Error(body?.message || body?.hint || response.statusText);
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
    notes: row.notes || "",
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
    notes: job.notes || "",
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

function switchView(viewId) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));
}

function render() {
  renderMetrics();
  renderSkillChart();
  renderJobList(els.jobList, filterJobs(state.jobs));
}

function renderMetrics() {
  const companies = new Set(state.jobs.map((job) => job.company).filter(Boolean));
  const requiredSkills = new Set(state.jobs.flatMap((job) => job.requiredSkills || []));
  const incomeValues = state.jobs.map((job) => job.annualIncomeMax).filter(Number.isFinite);
  const avg = incomeValues.length
    ? Math.round(incomeValues.reduce((sum, value) => sum + value, 0) / incomeValues.length)
    : null;

  els.jobCount.textContent = state.jobs.length;
  els.companyCount.textContent = companies.size;
  els.requiredSkillCount.textContent = requiredSkills.size;
  els.avgIncome.textContent = avg ? `${avg}万円` : "-";
}

function renderSkillChart() {
  const key = els.skillTypeFilter.value === "preferred" ? "preferredSkills" : "requiredSkills";
  const counts = countSkills(state.jobs, key);
  els.skillChart.innerHTML = "";
  els.skillChart.classList.toggle("empty", counts.length === 0);
  if (!counts.length) {
    els.skillChart.textContent = "データがありません";
    return;
  }

  const max = counts[0].count;
  counts.slice(0, 12).forEach(({ name, count }) => {
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML = `
      <span class="skill-name"></span>
      <span class="skill-bar"><span style="width: ${Math.max(8, (count / max) * 100)}%"></span></span>
      <span class="skill-count"></span>
    `;
    row.querySelector(".skill-name").textContent = name;
    row.querySelector(".skill-count").textContent = count;
    els.skillChart.appendChild(row);
  });
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
    card.querySelector(".required").textContent = (job.requiredSkills || []).join(", ") || "-";
    card.querySelector(".preferred").textContent = (job.preferredSkills || []).join(", ") || "-";
    card.querySelector(".notes").textContent = job.notes || "";
    const source = card.querySelector(".source");
    source.href = job.sourceUrl || "#";
    source.hidden = !job.sourceUrl;
    container.appendChild(card);
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

async function crawlJobs(listUrl, company, limit) {
  if (state.crawlApiAvailable) {
    try {
      const data = await apiRequest("/api/crawl", {
        method: "POST",
        body: JSON.stringify({ url: listUrl, company, limit })
      });
      return data.jobs || [];
    } catch (error) {
      state.crawlApiAvailable = false;
      setStatus(`CloudflareのクロールAPIが使えないためブラウザから取得します: ${error.message}`);
    }
  }
  const listHtml = await fetchText(listUrl);
  const detailUrls = extractJobLinks(listHtml, listUrl).slice(0, limit);
  if (!detailUrls.length) {
    const parsed = parseJobDetail(listHtml, listUrl, company);
    return parsed.description ? [parsed] : [];
  }

  const jobs = [];
  for (const detailUrl of detailUrls) {
    setStatus(`詳細ページを取得しています... ${jobs.length + 1}/${detailUrls.length}`);
    try {
      const html = await fetchText(detailUrl);
      const job = parseJobDetail(html, detailUrl, company);
      if (job.description || job.requiredSkills.length || job.preferredSkills.length) jobs.push(job);
    } catch (error) {
      console.warn("detail fetch failed", detailUrl, error);
    }
  }
  return jobs;
}

async function fetchText(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractJobLinks(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [...doc.querySelectorAll("a[href]")]
    .map((anchor) => new URL(anchor.getAttribute("href"), baseUrl).href)
    .filter((href) => /job|career|recruit|posting|detail|id=|no=/i.test(href));
  return [...new Set(links)].filter((href) => href !== baseUrl);
}

function parseJobDetail(html, sourceUrl, company) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = cleanText(doc.body?.innerText || "");
  const title = cleanText(doc.querySelector("h1, h2, .jobTitle, .title")?.textContent || "");
  const incomeRaw = findIncomeText(text);
  const income = parseIncome(incomeRaw);
  return {
    company,
    title,
    description: sliceAround(text, /(業務内容|仕事内容|職務内容)/) || text.slice(0, 260),
    annualIncomeRaw: incomeRaw,
    annualIncomeMin: income.min,
    annualIncomeMax: income.max,
    requiredSkills: extractSkills(text),
    preferredSkills: [],
    notes: "",
    sourceUrl,
    crawledAt: new Date().toISOString()
  };
}

function findIncomeText(text) {
  const match = text.match(/(?:年収|給与|想定年収).{0,80}?(\d{3,4}).{0,20}?万円(?:.{0,20}?(\d{3,4}).{0,20}?万円)?/);
  return match ? match[0] : "";
}

function parseIncome(raw) {
  const values = (raw.match(/\d{3,4}/g) || []).map(Number);
  return {
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null
  };
}

function extractSkills(raw) {
  if (!raw) return [];
  const known = [
    "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Ruby", "PHP",
    "SQL", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "React", "Vue", "Angular",
    "Spring", "Linux", "Git", "要件定義", "設計", "クラウド", "データ分析", "機械学習",
    "生成AI", "プロジェクトマネジメント", "チームリード", "アジャイル", "セキュリティ",
    "ネットワーク", "データ基盤", "ETL", "BI"
  ];
  return [...new Set(known.filter((skill) => new RegExp(escapeRegExp(skill), "i").test(raw)))];
}

function normalizeSkill(skill) {
  return cleanText(skill).replace(/経験$/, "").replace(/スキル$/, "").trim();
}

function sliceAround(text, pattern) {
  const index = text.search(pattern);
  return index >= 0 ? text.slice(index, index + 360) : "";
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
