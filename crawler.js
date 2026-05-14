"use strict";

(function () {
  const knownSkills = [
    "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Ruby", "PHP",
    "SQL", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "React", "Vue", "Angular",
    "Spring", "Linux", "Git", "要件定義", "設計", "クラウド", "データ分析", "機械学習",
    "生成AI", "プロジェクトマネジメント", "チームリード", "アジャイル", "セキュリティ",
    "ネットワーク", "データ基盤", "ETL", "BI"
  ];

  window.crawlJobsBrowser = async function crawlJobsBrowser(listUrl, company, limit, onStatus = () => {}) {
    const listHtml = await fetchText(listUrl);
    const detailUrls = extractJobLinks(listHtml, listUrl).slice(0, limit);
    if (!detailUrls.length) {
      const parsed = parseJobDetail(listHtml, listUrl, company);
      return parsed.description ? [parsed] : [];
    }

    const jobs = [];
    for (const detailUrl of detailUrls) {
      onStatus(`詳細ページを取得しています... ${jobs.length + 1}/${detailUrls.length}`);
      try {
        const html = await fetchText(detailUrl);
        const job = parseJobDetail(html, detailUrl, company);
        if (job.description || job.requiredSkills.length || job.preferredSkills.length) jobs.push(job);
      } catch (error) {
        console.warn("detail fetch failed", detailUrl, error);
      }
    }
    return jobs;
  };

  async function fetchText(url) {
    try {
      const response = await fetch(url, { credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    } catch (error) {
      throw new Error(
        `ブラウザから求人ページを取得できませんでした。APIなし構成では取得先サイトがCORSを許可している必要があります。詳細: ${error.message}`
      );
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
    const found = knownSkills.filter((skill) => new RegExp(escapeRegExp(skill), "i").test(raw));
    const bulletItems = raw
      .split(/\n|・|●|■|,|、|;/)
      .map((item) => cleanText(item).replace(/^[\-\u30fb\s]+/, ""))
      .filter((item) => item.length >= 2 && item.length <= 28)
      .filter((item) => !isSentenceLikeSkill(item))
      .filter((item) => !/(必須|歓迎|条件|経験|以上|以下|年収|勤務地|勤務)/.test(item));
    return [...new Set([...found, ...bulletItems].map(normalizeSkill).filter(Boolean))].slice(0, 18);
  }

  function isSentenceLikeSkill(item) {
    if (/[のにをはがでへもとや]/.test(item)) return true;
    if (/[（）()。！？!?]/.test(item)) return true;
    return /(方|こと|もの|ため|場合|いずれか|下記|要件|お持ち|興味|ある|できる|経験がある|経験をお持ち|活用したこと|業界|会社|領域向け)$/.test(item)
      || /(に関する|について|として|もしくは|または|および|ならびに|等において|をお持ち|を活用|を担当|における|に向け|から|まで|より)/.test(item);
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
})();
