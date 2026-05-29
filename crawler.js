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
    const isFujitsu = isFujitsuJobsUrl(listUrl);
    if (isFujitsu && isFujitsuJobDetailUrl(listUrl)) {
      const html = await fetchText(listUrl);
      const parsed = parseJobDetail(html, listUrl, company);
      return parsed.description ? [parsed] : [];
    }

    const listHtml = isFujitsu ? "" : await fetchText(listUrl);
    const detailUrls = (isFujitsu
      ? await extractFujitsuJobLinks(listUrl, limit, onStatus)
      : extractJobLinks(listHtml, listUrl)).slice(0, limit);
    if (!detailUrls.length) {
      if (isFujitsu) return [];
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
      const response = await fetchWithProxyFallback(url, { credentials: "omit" });
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

  async function extractFujitsuJobLinks(listUrl, limit, onStatus) {
    const url = new URL(listUrl);
    const locale = url.searchParams.get("locale") || "ja_JP";
    const pageSize = 25;
    const startPage = Number.parseInt(url.searchParams.get("pageNumber"), 10) || 0;
    const links = [];
    let pageNumber = startPage;
    let totalJobs = Infinity;

    while (links.length < limit && pageNumber * pageSize < totalJobs) {
      onStatus(`富士通の求人一覧APIを取得しています... ${links.length}/${limit}`);
      const result = await fetchFujitsuSearchPage(url, pageNumber, locale);
      totalJobs = Number.isFinite(result.totalJobs) ? result.totalJobs : links.length;
      const pageLinks = (result.jobSearchResult || [])
        .map((item) => item.response || item)
        .map((job) => buildFujitsuJobUrl(url.origin, job, locale))
        .filter(Boolean);
      links.push(...pageLinks);
      if (!pageLinks.length) break;
      pageNumber += 1;
    }

    return [...new Set(links)];
  }

  async function fetchFujitsuSearchPage(listUrl, pageNumber, locale) {
    const body = {
      keywords: listUrl.searchParams.get("q") || "",
      locale,
      location: listUrl.searchParams.get("locationsearch") || "",
      pageNumber,
      sortBy: listUrl.searchParams.get("sortBy") || "recent"
    };
    const facetFilters = parseFacetFilters(listUrl.searchParams.get("facetFilters"));
    const candidates = facetFilters
      ? [{ ...body, facetFilters }, body]
      : [body];

    for (const payload of candidates) {
      const response = await fetchWithProxyFallback(`${listUrl.origin}/services/recruiting/v1/jobs`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        if (payload.facetFilters) continue;
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
    return { jobSearchResult: [], totalJobs: 0 };
  }

  async function fetchWithProxyFallback(url, options = {}) {
    try {
      return await fetch(url, options);
    } catch (directError) {
      if (!/^https?:$/.test(window.location.protocol)) throw directError;
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method: options.method || "GET",
          headers: options.headers || {},
          body: options.body || null
        })
      });
      return response;
    }
  }

  function parseFacetFilters(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("facetFilters parse failed", error);
      return null;
    }
  }

  function buildFujitsuJobUrl(origin, job, locale) {
    const id = job.id || job.jobReqId;
    const title = job.unifiedUrlTitle || job.urlTitle || encodeURIComponent(job.unifiedStandardTitle || job.title || "job");
    if (!id) return "";
    return `${origin}/job/${title}/${id}-${locale}/`;
  }

  function parseJobDetail(html, sourceUrl, company) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const bodyText = doc.body?.innerText || doc.body?.textContent || "";
    if (isFujitsuJobsUrl(sourceUrl) || /求人ID[:：]/.test(bodyText)) {
      return parseFujitsuJobDetail(bodyText, sourceUrl, company);
    }

    const text = cleanText(bodyText);
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

  function parseFujitsuJobDetail(bodyText, sourceUrl, fallbackCompany) {
    const text = normalizeLines(bodyText);
    const title = firstNonEmpty([
      sectionBetweenLines(text, ["求人内容"], ["勤務地域", "Location Flexibility", "求人ID"]),
      lineAfter(text, "####"),
      sourceUrl.match(/\/job\/([^/]+)\//)?.[1] ? decodeURIComponent(sourceUrl.match(/\/job\/([^/]+)\//)[1]).replace(/-/g, " ") : ""
    ]);
    const company = firstNonEmpty([
      inlineValue(text, ["実施会社", "会社名"]),
      fallbackCompany,
      "富士通株式会社"
    ]);
    const description = firstNonEmpty([
      sectionAfterLabel(text, [
        "インターンシップの業務内容やチームでの役割",
        "【募集範囲と具体的業務内容】",
        "募集範囲と具体的業務内容",
        "職務内容",
        "仕事内容"
      ], [
        "赴任サポートの有無", "在留資格手配サポートの有無", "－－－求める資格", "【個人に期待する役割やミッション】",
        "【仕事の魅力・やりがい】", "【必須", "【歓迎", "Copyright"
      ]),
      sliceAround(cleanText(text), /(インターンシップの業務内容|募集範囲|職務内容|仕事内容)/)
    ]);
    const requiredRaw = sectionAfterLabel(text, [
      "【必須の経験・キャリアや資格・言語】",
      "必須の経験・キャリアや資格・言語",
      "必須条件",
      "必要条件"
    ], ["【歓迎", "【語学力】", "【日本語レベル】", "－－－待遇", "【給与】", "勤務地"]);
    const preferredRaw = sectionAfterLabel(text, [
      "【歓迎する経験・キャリアや資格・言語】",
      "歓迎する経験・キャリアや資格・言語",
      "歓迎条件"
    ], ["【語学力】", "【日本語レベル】", "－－－待遇", "【給与】", "勤務地"]);
    const location = inlineValue(text, ["勤務地域", "【勤務地】", "勤務地"]);
    const incomeRaw = firstNonEmpty([
      sectionAfterLabel(text, ["【給与】", "給与", "想定年収", "年収"], ["勤務地", "－－－勤務地", "備考", "Copyright"]),
      findIncomeText(cleanText(text))
    ]);
    const income = parseIncome(incomeRaw);
    const notes = [
      inlineValue(text, ["求人ID"]),
      inlineValue(text, ["掲載開始日"]),
      location ? `勤務地: ${location}` : "",
      sectionAfterLabel(text, ["赴任サポートの有無"], ["Copyright", "在留資格手配サポートの有無"])
    ].filter(Boolean).join(" / ");

    return {
      company,
      title: cleanText(title),
      description: cleanText(description || text.slice(0, 360)),
      annualIncomeRaw: incomeRaw,
      annualIncomeMin: income.min,
      annualIncomeMax: income.max,
      requiredSkills: extractSkills(requiredRaw || description),
      preferredSkills: extractSkills(preferredRaw),
      notes,
      location,
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

  function isFujitsuJobsUrl(url) {
    try {
      return new URL(url).hostname === "www.jobs.global.fujitsu.com";
    } catch {
      return false;
    }
  }

  function isFujitsuJobDetailUrl(url) {
    try {
      return /^\/job\//.test(new URL(url).pathname);
    } catch {
      return false;
    }
  }

  function normalizeLines(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\u00a0/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }

  function firstNonEmpty(values) {
    return values.map((value) => cleanText(value)).find(Boolean) || "";
  }

  function lineAfter(text, prefix) {
    const line = text.split("\n").find((item) => item.trim().startsWith(prefix));
    return line ? line.replace(prefix, "").trim() : "";
  }

  function inlineValue(text, labels) {
    for (const line of text.split("\n")) {
      for (const label of labels) {
        if (!line.includes(label)) continue;
        const value = line
          .slice(line.indexOf(label) + label.length)
          .replace(/^[\s:：]+/, "")
          .trim();
        if (value) return value;
      }
    }
    return "";
  }

  function sectionBetweenLines(text, startLabels, stopLabels) {
    const lines = text.split("\n");
    const start = lines.findIndex((line) => startLabels.some((label) => line.trim() === label || line.includes(label)));
    if (start < 0) return "";
    const values = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (stopLabels.some((label) => line.includes(label))) break;
      if (line) values.push(line);
    }
    return values.join("\n");
  }

  function sectionAfterLabel(text, labels, stopLabels) {
    const lines = text.split("\n");
    const start = lines.findIndex((line) => labels.some((label) => line.includes(label)));
    if (start < 0) return "";
    const values = [];
    const inline = inlineValue(lines[start], labels);
    if (inline) values.push(inline);
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line && stopLabels.some((label) => line.includes(label))) break;
      if (line) values.push(line);
    }
    return values.join("\n");
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();
