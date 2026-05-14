import { json, readJson } from "../_utils/http.js";

const knownSkills = [
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Ruby", "PHP",
  "SQL", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "React", "Vue", "Angular",
  "Spring", "Linux", "Git", "要件定義", "設計", "クラウド", "データ分析", "機械学習",
  "生成AI", "プロジェクトマネジメント", "チームリード", "アジャイル", "セキュリティ",
  "ネットワーク", "データ基盤", "ETL", "BI"
];

export async function onRequestPost({ request }) {
  try {
    const { url, company = "未設定", limit = 10 } = await readJson(request);
    if (!url) return json({ error: "url is required" }, 400);

    const listHtml = await fetchText(url);
    const detailUrls = extractJobLinks(listHtml, url).slice(0, Math.min(Number(limit) || 10, 50));
    const targets = detailUrls.length ? detailUrls : [url];
    const jobs = [];

    for (const detailUrl of targets) {
      try {
        const html = detailUrl === url && !detailUrls.length ? listHtml : await fetchText(detailUrl);
        const job = parseJobDetail(html, detailUrl, company);
        if (job.description || job.requiredSkills.length || job.preferredSkills.length) jobs.push(job);
      } catch (error) {
        console.warn("detail fetch failed", detailUrl, error);
      }
    }

    return json({ jobs });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 compatible; JobPostAnalytics/1.0"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractJobLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    const label = stripHtml(match[2]);
    const absolute = new URL(href, baseUrl).href;
    if (/job|career|recruit|posting|detail|id=|no=/i.test(`${absolute} ${label}`)) {
      links.push(absolute);
    }
  }
  return [...new Set(links)].filter((href) => href !== baseUrl);
}

function parseJobDetail(html, sourceUrl, company) {
  const text = cleanText(stripHtml(html));
  const title = pickTitle(html);
  const description = pickSection(text, ["業務内容", "仕事内容", "職務内容", "募集内容", "職務概要"]) || text.slice(0, 260);
  const incomeRaw = pickSection(text, ["年収", "給与", "想定年収", "待遇"]) || findIncomeText(text);
  const income = parseIncome(incomeRaw);
  const requiredRaw = pickSection(text, ["必須条件", "必要条件", "応募資格", "求める経験・スキル", "求めるスキル"]);
  const preferredRaw = pickSection(text, ["歓迎条件", "歓迎スキル", "歓迎経験", "尚可"]);
  const notes = pickSection(text, ["補足", "その他", "備考", "勤務地", "勤務条件"]);

  return {
    company,
    title,
    description,
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

function pickTitle(html) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(stripHtml(match?.[1] || ""));
}

function pickSection(text, labels) {
  for (const label of labels) {
    const index = text.indexOf(label);
    if (index >= 0) return text.slice(index, index + 420);
  }
  return "";
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
  return [...new Set(knownSkills.filter((skill) => new RegExp(escapeRegExp(skill), "i").test(raw)))];
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|dt|dd|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
