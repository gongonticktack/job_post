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
    notes: "サンプルデータです。クローリング取得前の表示確認に使えます。",
    sourceUrl: "https://nttdata-career.jposting.net/joblist/",
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
  db: null
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

function tx(mode = "readonly") {
  return state.db.transaction(STORE, mode).objectStore(STORE);
}

function getAllJobs() {
  return new Promise((resolve, reject) => {
    const request = tx().getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveJobs(jobs) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    jobs.forEach((job) => store.put({ ...job, crawledAt: job.crawledAt || new Date().toISOString() }));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function refresh() {
  state.jobs = await getAllJobs();
  render();
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
      setStatus("求人情報を抽出できませんでした。ページ構造が変わっているか、ブラウザのCORS制約で詳細ページを読めない可能性があります。");
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
      if (job.description || job.requiredSkills.length || job.preferredSkills.length) {
        jobs.push(job);
      }
    } catch (error) {
      console.warn("detail fetch failed", detailUrl, error);
    }
  }
  return jobs;
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (directError) {
    const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxied);
    if (!response.ok) {
      throw new Error(`直接取得とプロキシ取得に失敗しました (${directError.message})`);
    }
    return await response.text();
  }
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
  const sections = readLabeledSections(doc);
  const title = cleanText(doc.querySelector("h1, h2, .jobTitle, .title")?.textContent || sections["職種名"] || sections["求人名"] || "");
  const description = firstSection(sections, ["業務内容", "仕事内容", "職務内容", "募集内容", "職務概要"]) || sliceAround(text, /(業務内容|仕事内容|職務内容)/);
  const incomeRaw = firstSection(sections, ["年収", "給与", "想定年収", "待遇"]) || findIncomeText(text);
  const income = parseIncome(incomeRaw);
  const requiredRaw = firstSection(sections, ["求めるスキル(必須)", "必須条件", "必要条件", "応募資格", "求める経験・スキル"]);
  const preferredRaw = firstSection(sections, ["求めるスキル(推奨)", "歓迎条件", "歓迎スキル", "歓迎経験"]);
  const notes = firstSection(sections, ["補足", "その他", "備考", "勤務地", "勤務条件"]);

  return {
    company,
    title,
    description: description || text.slice(0, 260),
    annualIncomeRaw: incomeRaw,
    annualIncomeMin: income.min,
    annualIncomeMax: income.max,
    requiredSkills: extractSkills(requiredRaw || text),
    preferredSkills: extractSkills(preferredRaw),
    notes,
    sourceUrl,
    crawledAt: new Date().toISOString()
  };
}

function readLabeledSections(doc) {
  const sections = {};
  const rows = doc.querySelectorAll("tr, dl, .item, .section, section");
  rows.forEach((row) => {
    const label = cleanText(row.querySelector("th, dt, h2, h3, .label, .ttl, .title")?.textContent || "");
    const value = cleanText(row.querySelector("td, dd, p, .content, .txt, .detail")?.textContent || "");
    if (label && value && label.length <= 40) sections[label] = value;
  });
  return sections;
}

function firstSection(sections, labels) {
  const found = Object.entries(sections).find(([label]) => labels.some((target) => label.includes(target)));
  return found ? found[1] : "";
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
  const found = known.filter((skill) => new RegExp(escapeRegExp(skill), "i").test(raw));
  const bulletItems = raw
    .split(/\n|・|●|■|,|、|;/)
    .map((item) => cleanText(item).replace(/^[\-\u30fb\s]+/, ""))
    .filter((item) => item.length >= 2 && item.length <= 28)
    .filter((item) => !/(必須|歓迎|条件|経験|以上|以下|年収|勤務地|勤務)/.test(item));
  return [...new Set([...found, ...bulletItems].map(normalizeSkill).filter(Boolean))].slice(0, 18);
}

function normalizeSkill(skill) {
  return cleanText(skill)
    .replace(/経験$/, "")
    .replace(/スキル$/, "")
    .trim();
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
