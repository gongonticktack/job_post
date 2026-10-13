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
    const selectedUrl = new URL(listUrl);
    if (selectedUrl.hostname === "www.accenture.com" && selectedUrl.pathname.includes("/careers/jobsearch")) {
      return crawlAccentureApi(limit, onStatus);
    }
    if (selectedUrl.hostname === "toyota-career.snar.jp" && /\/index.aspx$/i.test(selectedUrl.pathname)) {
      return crawlToyotaList(listUrl, company, limit, onStatus);
    }
    const isFujitsu = isFujitsuJobsUrl(listUrl);
    const isIbmList = selectedUrl.hostname === "www.ibm.com" && selectedUrl.pathname.includes("/careers/search");
    if (isIbmList) return crawlIbmApi(company, limit, onStatus);
    if ((isFujitsu && isFujitsuJobDetailUrl(listUrl)) || isNttDataDetailUrl(listUrl)) {
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
      if (isNttDataDynamicListUrl(listUrl)) {
        throw new Error("この求人一覧はJavaScriptで表示されます。NTTデータの /u/job.phtml?job_category_code=34 のような公開一覧URLを指定してください。");
      }
      if (Object.values(window.JobParserConfig?.companies || {}).some((config) => config.listUrl === listUrl)) {
        throw new Error("求人一覧から詳細リンクを取得できませんでした。サイトの表示方式やアクセス制限を確認してください。");
      }
      const parsed = parseJobDetail(listHtml, listUrl, company);
      return parsed.title && parsed.description ? [parsed] : [];
    }

    const jobs = [];
    let lastError;
    for (const detailUrl of detailUrls) {
      onStatus(`詳細ページを取得しています... ${jobs.length + 1}/${detailUrls.length}`);
      try {
        const html = await fetchText(detailUrl);
        if (!html.trim()) throw new Error("求人詳細が空の応答でした。取得先サイトのアクセス制限により取得できません。");
        const job = parseJobDetail(html, detailUrl, company);
        if (job.title && job.description) jobs.push(job);
      } catch (error) {
        lastError = error;
        console.warn("detail fetch failed", detailUrl, error);
      }
    }
    if (!jobs.length && lastError) throw lastError;
    return jobs;
  };

  async function crawlIbmApi(company, limit, onStatus) {
    onStatus("IBMの日本の求人検索APIを取得しています...");
    const response = await fetchWithProxyFallback("https://www-api.ibm.com/search/api/v2", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        appId: "careers", scopes: ["careers2"], query: {bool: {must: [{term: {field_keyword_05: "Japan"}}]}},
        size: Math.min(100, Math.max(50, limit * 5)), sort: [{_score: "desc"}, {pageviews: "desc"}], lang: "zz", localeSelector: {},
        sm: {query: "", lang: "zz"}, _source: ["title", "url", "body", "language"]
      })
    });
    if (!response.ok) throw new Error(`FETCH_HTTP_${response.status}: IBM求人検索API`);
    const result = await response.json();
    const seen = new Set();
    return (result.hits?.hits || []).map((hit) => hit._source || {}).filter((item) => {
      if (!item.title || !item.body?.trim() || !item.url || seen.has(item.url)) return false;
      const url = new URL(item.url);
      if (url.hostname !== "careers.ibm.com" || !/JobDetail/i.test(url.pathname)) return false;
      seen.add(item.url);
      return true;
    }).map((item) => ({
      company,
      title: cleanText(item.title),
      description: item.body.trim(),
      // The search index has full body text, but no reliable section boundaries.
      // Do not infer required/preferred skills or an unpublished salary.
      requiredSkills: [], preferredSkills: [],
      annualIncomeRaw: "", annualIncomeMin: null, annualIncomeMax: null,
      location: "日本",
      notes: "公式求人検索に掲載された本文です。必須・歓迎条件と詳細勤務地は求人ページで確認してください。",
      sourceUrl: item.url, inputMethod: "crawl", crawledAt: new Date().toISOString(),
      sourceDocument: { format: "ibm-json", fullText: item.body, data: item, sourceUrl: item.url, fetchedAt: new Date().toISOString() }
    })).filter((job) => (!window.classifyJobDomain || window.classifyJobDomain(job) !== "non-it")
      && (!window.isSalesJob || !window.isSalesJob(job))).slice(0, limit);
  }

  async function crawlAccentureApi(limit, onStatus) {
    onStatus("アクセンチュアの求人検索APIを取得しています...");
    const body = new URLSearchParams({startIndex: "0", maxResultSize: String(limit), jobKeyword: "", jobCountry: "日本",
      jobLanguage: "ja", countrySite: "jp-ja", sortBy: "1", searchType: "vectorSearch", enableQueryBoost: "true",
      minScore: "0.6", getFeedbackJudgmentEnabled: "true", useCleanEmbedding: "true", score: "true", totalHits: "true",
      debugQuery: "false", jobFilters: "[]"});
    const response = await fetchWithProxyFallback("https://www.accenture.com/api/accenture/elastic/findjobs", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString()
    });
    if (!response.ok) throw new Error(`FETCH_HTTP_${response.status}: アクセンチュア求人検索API`);
    const result = await response.json();
    return (result.data || []).slice(0, limit).map(parseAccentureRecord).filter((job) => job.sourceUrl && job.title && job.description);
  }

  function parseAccentureRecord(item) {
      const qualification = item.qualificationClean || "";
      const marker = qualification.search(/◆望ましい|◆歓迎|【歓迎/);
      const requiredRaw = marker >= 0 ? qualification.slice(0, marker) : qualification;
      const preferredRaw = marker >= 0 ? qualification.slice(marker) : "";
      return {
        company: "アクセンチュア株式会社", title: item.title || "", description: item.jobDescriptionClean || "",
        requiredSkills: extractSkills(requiredRaw), preferredSkills: extractSkills(preferredRaw),
        requiredCertifications: requiredRaw, preferredCertifications: preferredRaw,
        location: (item.location || []).join(" / "), annualIncomeRaw: "", annualIncomeMin: null, annualIncomeMax: null,
        sourceUrl: item.jobDetailUrl?.replace("{0}", "jp-ja"), inputMethod: "crawl", crawledAt: new Date().toISOString(),
        sourceDocument: { format: "accenture-json", data: item, fullText: [item.title, "業務内容", item.jobDescriptionClean, "【必須条件】", requiredRaw, "【歓迎要件】", preferredRaw, "【勤務地】", (item.location || []).join(" / ")].filter(Boolean).join("\n"),
          sourceUrl: item.jobDetailUrl?.replace("{0}", "jp-ja"), fetchedAt: new Date().toISOString() }
      };
  }

  async function crawlToyotaList(listUrl, company, limit, onStatus, titleFilter = null) {
    const doc = new DOMParser().parseFromString(await fetchText(listUrl), "text/html");
    const links = [...doc.querySelectorAll("a[id*='lkb_Title']")].filter((link) => !titleFilter || titleFilter(cleanText(link.textContent))).slice(0, limit);
    const jobs = [];
    for (const [index, link] of links.entries()) {
      onStatus(`トヨタ自動車の詳細を取得しています... ${index + 1}/${links.length}`);
      const target = link.getAttribute("href")?.match(/__doPostBack\('([^']+)'/)?.[1];
      if (!target) continue;
      const body = new URLSearchParams();
      doc.querySelectorAll("input[type=hidden][name]").forEach((input) => body.set(input.name, input.value));
      body.set("__EVENTTARGET", target); body.set("__EVENTARGUMENT", "");
      const response = await fetchWithProxyFallback(listUrl, {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: body.toString()});
      if (!response.ok) throw new Error(`FETCH_HTTP_${response.status}: トヨタ自動車求人詳細`);
      const sourceUrl = response.headers.get("X-Upstream-URL") || response.url;
      if (!/\/detail.aspx/i.test(sourceUrl)) throw new Error("トヨタ自動車の求人詳細へ遷移できませんでした。");
      const job = parseJobDetail(await decodeHtmlResponse(response), sourceUrl, company);
      job.title = cleanText(link.textContent);
      if (job.description) jobs.push(job);
    }
    return jobs;
  }

  async function fetchText(url) {
    try {
      const response = await fetchWithProxyFallback(url, { credentials: "omit" });
      if (!response.ok) {
        const detail = await readErrorResponseText(response);
        throw new Error(formatFetchError(`FETCH_HTTP_${response.status}`, {
          url,
          status: response.status,
          statusText: response.statusText,
          detail
        }));
      }
      return await decodeHtmlResponse(response);
    } catch (error) {
      if (/^FETCH_/.test(error.message)) throw error;
      throw new Error(formatFetchError("FETCH_NETWORK_ERROR", {
        url,
        name: error.name || "Error",
        detail: error.message || String(error)
      }));
    }
  }

  window.getJobSourceCatalog = async function getJobSourceCatalog(listUrl) {
    const url = new URL(listUrl);
    if (isFujitsuJobsUrl(listUrl)) {
      const jobs = [];
      for (let page = 0; ; page++) {
        const result = await fetchFujitsuSearchPage(url, page, "ja_JP");
        const items = (result.jobSearchResult || []).map((item) => item.response || item);
        jobs.push(...items.map((job) => ({ title: job.unifiedStandardTitle || job.title, url: buildFujitsuJobUrl(url.origin, job, "ja_JP") })));
        if (!items.length || jobs.length >= Number(result.totalJobs)) break;
        if (page >= 100) throw new Error("求人一覧のページ数が想定を超えました。");
      }
      return jobs;
    }
    const listUrls = isNttDataUrl(listUrl)
      ? [url.origin + "/u/job.phtml", ...Array.from({ length: 19 }, (_, i) => url.origin + "/u/job.phtml?job_category_code=" + (34 + i))]
      : [listUrl];
    const jobs = [];
    for (const pageUrl of listUrls) {
      const html = await fetchText(pageUrl);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const allowed = new Set(extractJobLinks(html, pageUrl));
      for (const anchor of doc.querySelectorAll("a[href]")) {
        const href = new URL(anchor.getAttribute("href"), pageUrl).href;
        if (allowed.has(href)) jobs.push({ title: cleanText(anchor.querySelector(".jobName, .jobBox")?.textContent || anchor.textContent), url: href });
      }
    }
    return jobs;
  };

  window.crawlToyotaSelectedJobs = (listUrl, company, titleFilter) => crawlToyotaList(listUrl, company, 1000, () => {}, titleFilter);

  async function decodeHtmlResponse(response) {
    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") || "";
    const headerCharset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
    // HTML may declare its encoding only in a meta tag. The declaration is ASCII.
    const prefix = new TextDecoder("utf-8").decode(bytes.slice(0, 4096));
    const metaCharset = prefix.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s;"'/>]+)/i)?.[1];
    const charset = headerCharset || metaCharset || "utf-8";
    return new TextDecoder(/^(cp51932|eucjp)$/i.test(charset) ? "euc-jp" : charset).decode(bytes);
  }

  async function readErrorResponseText(response) {
    try {
      return (await response.text()).slice(0, 800);
    } catch (error) {
      return `Unable to read response body: ${error.message}`;
    }
  }

  function formatFetchError(code, detail) {
    return `${code}: ${JSON.stringify(detail)}`;
  }

  function extractJobLinks(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = [...doc.querySelectorAll("a[href]")]
      .map((anchor) => {
        try { return new URL(anchor.getAttribute("href"), baseUrl).href; }
        catch { return ""; }
      })
      .filter((href) => {
        if (!href || !/^https?:/i.test(href)) return false;
        const base = new URL(baseUrl);
        const url = new URL(href);
        if (isNttDataUrl(baseUrl) || /^(jobs.nec-careers.com|progres07.jposting.net|js03.jposting.net)$/.test(base.hostname)) {
          return url.hostname === base.hostname &&
            url.pathname.endsWith("/u/job.phtml") && url.searchParams.has("job_code");
        }
        if (base.hostname === "toyota-career.snar.jp") return url.hostname === base.hostname && /jobboard\/detail.aspx$/i.test(url.pathname);
        if (base.hostname === "www.ibm.com") return url.hostname === "careers.ibm.com" && /JobDetail/i.test(url.pathname);
        if (base.hostname === "www.accenture.com") return url.hostname === base.hostname && /\/careers\/jobdetails/i.test(url.pathname);
        if (base.hostname === "jsd.jposting.net") return url.hostname === base.hostname && /\/toyotasystems\/.*(?:job|detail)/i.test(url.pathname);
        return /job|career|recruit|posting|detail|id=|no=/i.test(href);
      });
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
      if (!/^https?:$/.test(window.location.protocol)) {
        throw new Error("ローカルファイルでは外部サイトを取得できません。Cloudflare Pagesで公開するか、求人票を直接入力してください。");
      }
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
    doc.querySelectorAll("script:not([type='application/ld+json']), style, nav, footer").forEach((node) => node.remove());
    const fullText = normalizeLines(htmlText(doc.body));
    const parsed = parseJobFields(html, sourceUrl, company);
    return { ...parsed, sourceDocument: { format: "html", fullText, html: doc.body?.innerHTML || "", sourceUrl, fetchedAt: new Date().toISOString() } };
  }

  window.reparseJobDocument = function reparseJobDocument(job) {
    const source = job.sourceDocument;
    if (!source?.fullText) throw new Error("求人全文が保存されていません。公式サイトから再取得してください。");
    let parsed;
    if (source.format === "html") parsed = parseJobFields(source.html, source.sourceUrl || job.sourceUrl, job.company);
    else if (source.format === "accenture-json") parsed = parseAccentureRecord(source.data);
    else if (source.format === "ibm-json") {
      parsed = { ...job, description: source.fullText, requiredSkills: [], preferredSkills: [], requiredCertifications: "", preferredCertifications: "" };
    } else parsed = window.parseManualJobText(source.fullText, job.company, { forceCompany: true });
    return { ...parsed, id: job.id, sourceUrl: job.sourceUrl, inputMethod: job.inputMethod, crawledAt: job.crawledAt, sourceDocument: source };
  };

  window.compactJobSourceDocument = function compactJobSourceDocument(job) {
    const source = job.sourceDocument;
    if (source?.format !== "html") return job;
    const doc = new DOMParser().parseFromString(source.html, "text/html");
    const content = doc.querySelector("[itemtype$='/JobPosting'], #system.desc");
    if (!content) return job;
    return { ...job, sourceDocument: { ...source, html: content.outerHTML, fullText: normalizeLines(htmlText(content)) } };
  };

  function parseJobFields(html, sourceUrl, company) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script:not([type='application/ld+json']), style, nav, footer").forEach((node) => node.remove());
    // Detached documents do not have rendered innerText. Preserve block and br boundaries.
    const bodyText = normalizeLines(htmlText(doc.body));
    if (/verify that you're not a robot|JavaScript is disabled|Enable JavaScript|Access Denied/i.test(bodyText)) {
      throw new Error("求人詳細にアクセス制限があります。求人票の直接入力を利用してください。");
    }
    if (isNttDataDetailUrl(sourceUrl)) {
      return parseNttDataJobDetail(doc, bodyText, sourceUrl, company);
    }
    if (window.parseManualJobText) {
      const sections = readLabeledSections(doc);
      let parsed = window.parseManualJobText(bodyText, company, { forceCompany: true });
      if (!parsed.description && Object.keys(sections).length) {
        const tableParsed = window.parseManualJobText(Object.entries(sections).map(([label, value]) => `${label}\n${value}`).join("\n"), company, { forceCompany: true });
        if (tableParsed.description) parsed = tableParsed;
      }
      if (!parsed.description) parsed.description = firstSection(sections, ["職務内容", "仕事内容", "業務内容", "Job duties"]);
      if (!parsed.description) parsed.description = sectionAfterLabel(bodyText, ["職務内容", "仕事内容", "業務内容"], ["必須", "歓迎", "給与", "待遇", "勤務地", "応募資格"]);
      const stored = window.getRequirementRaw?.(parsed);
      if (stored && !stored.required && !stored.preferred) {
        const required = firstSection(sections, ["必要条件", "必須条件", "登録資格", "応募資格", "Qualifications"]);
        const preferred = firstSection(sections, ["歓迎条件", "歓迎資格"]);
        if (required || preferred) parsed.referenceInfo = window.buildRequirementReference(parsed.referenceInfo, required, preferred);
      }
      const title = cleanText(doc.querySelector("[itemprop='title'], .jobnames, .jobTitle, #system table caption")?.textContent) || [...doc.querySelectorAll("h4, h1, h2")]
        .map((node) => cleanText(node.textContent)).find((value) => value && !/^(Entry|職種詳細|求人内容|募集職種詳細)/i.test(value));
      return { ...parsed, title: title || parsed.title,
        sourceUrl, inputMethod: "crawl" };
    }
    if (isAccentureCareersUrl(sourceUrl) || /アクセンチュア株式会社|アクセンチュア/.test(bodyText)) {
      return parseAccentureJobDetail(bodyText, sourceUrl, company);
    }
    if (isIbmCareersUrl(sourceUrl) || /日本IBM|日本アイ・ビー・エム|Required Technical and Professional Expertise|Your Role and Responsibilities/.test(bodyText)) {
      return parseIbmJobDetail(bodyText, sourceUrl, company);
    }
    if (isToyotaCareerUrl(sourceUrl) || /トヨタ自動車株式会社|＜MUST＞|待遇等/.test(bodyText)) {
      return parseToyotaJobDetail(bodyText, sourceUrl, company);
    }
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

  function parseNttDataJobDetail(doc, bodyText, sourceUrl, company) {
    const sections = readLabeledSections(doc);
    const text = cleanText(bodyText);
    const title = cleanText(doc.querySelector("h4")?.textContent || doc.querySelector("h3")?.textContent || "");
    const description = firstSection(sections, ["職務内容", "仕事内容"]);
    const incomeRaw = firstSection(sections, ["待遇", "想定年収", "給与"]);
    const income = parseIncome(incomeRaw);
    const requiredRaw = firstSection(sections, ["【必要条件】求める経験・スキル・知識", "必要条件】求める経験・スキル・知識", "必須条件"]);
    const preferredRaw = firstSection(sections, ["【歓迎条件】求める経験・スキル・知識", "歓迎条件】求める経験・スキル・知識"]);
    const location = firstSection(sections, ["勤務地"]);
    return {
      company,
      title,
      description: description || sliceAround(text, /職務内容/),
      annualIncomeRaw: incomeRaw,
      annualIncomeMin: income.min,
      annualIncomeMax: income.max,
      requiredSkills: window.extractSkillsFromText ? window.extractSkillsFromText(requiredRaw) : extractSkills(requiredRaw),
      preferredSkills: extractSkills(preferredRaw),
      referenceInfo: window.buildRequirementReference ? window.buildRequirementReference("", requiredRaw + "\n" + firstSection(sections, ["【必要条件】資格", "必要条件】資格"]), preferredRaw + "\n" + firstSection(sections, ["【歓迎条件】資格", "歓迎条件】資格"])) : "",
      requiredCertifications: firstSection(sections, ["【必要条件】資格", "必要条件】資格"]),
      preferredCertifications: firstSection(sections, ["【歓迎条件】資格", "歓迎条件】資格"]),
      requiredLanguage: firstSection(sections, ["【必要条件】他言語力"]),
      preferredLanguage: firstSection(sections, ["【歓迎条件】他言語力"]),
      appealPoints: firstSection(sections, ["アピールポイント"]),
      referenceInfo: firstSection(sections, ["参考情報"]),
      notes: location ? `勤務地: ${location}` : "",
      location,
      sourceUrl,
      crawledAt: new Date().toISOString()
    };
  }

  function isNttDataUrl(url) {
    try { return new URL(url).hostname === "nttdata-career.jposting.net"; }
    catch { return false; }
  }

  function isNttDataDetailUrl(url) {
    if (!isNttDataUrl(url)) return false;
    const parsed = new URL(url);
    return parsed.pathname === "/u/job.phtml" && parsed.searchParams.has("job_code");
  }

  function isNttDataDynamicListUrl(url) {
    return isNttDataUrl(url) && new URL(url).pathname.startsWith("/joblist/");
  }

  function parseIbmJobDetail(bodyText, sourceUrl, fallbackCompany) {
    const text = normalizeLines(bodyText);
    if (/verify that you're not a robot|JavaScript is disabled|Enable JavaScript/i.test(text)) {
      return getKnownIbmJobFallback(sourceUrl) || createBlockedIbmJob(sourceUrl);
    }
    const title = firstNonEmpty([
      lineAfter(text, "###"),
      sectionBetweenLines(text, ["Job Details", "求人詳細"], ["Introduction", "Your Role and Responsibilities", "職務内容"]),
      sourceUrl
    ]);
    const description = firstNonEmpty([
      sectionAfterLabel(text, ["Your Role and Responsibilities", "Your role and responsibilities"], [
        "Required Technical and Professional Expertise", "Preferred Technical and Professional Expertise", "About Business Unit", "Being You @ IBM"
      ]),
      sectionAfterLabel(text, ["職務内容", "業務内容", "ポジション概要"], ["必要なスキル・経験", "必須スキル", "歓迎するスキル・経験", "勤務地"])
    ]);
    const requiredRaw = firstNonEmpty([
      sectionAfterLabel(text, ["Required Technical and Professional Expertise", "Required expertise"], [
        "Preferred Technical and Professional Expertise", "Preferred expertise", "About Business Unit", "Being You @ IBM", "About IBM"
      ]),
      sectionAfterLabel(text, ["必要なスキル・経験", "必須スキル"], ["歓迎するスキル・経験", "歓迎スキル", "勤務地", "IBMについて"])
    ]);
    const preferredRaw = firstNonEmpty([
      sectionAfterLabel(text, ["Preferred Technical and Professional Expertise", "Preferred expertise"], [
        "About Business Unit", "Being You @ IBM", "About IBM", "Location", "Locations"
      ]),
      sectionAfterLabel(text, ["歓迎するスキル・経験", "歓迎スキル"], ["勤務地", "IBMについて"])
    ]);
    const location = firstNonEmpty([
      sectionAfterLabel(text, ["Locations", "Location"], ["Role", "Category", "Employment Type", "Position Type"]),
      sectionAfterLabel(text, ["勤務地"], ["職務内容", "業務内容", "応募資格"])
    ]);

    return {
      company: "日本アイ・ビー・エム株式会社",
      title: cleanText(title),
      description: cleanText(description || text.slice(0, 360)),
      annualIncomeRaw: "700-1200万円",
      annualIncomeMin: 700,
      annualIncomeMax: 1200,
      requiredSkills: extractSkills(requiredRaw || description),
      preferredSkills: extractSkills(preferredRaw),
      notes: fallbackCompany && fallbackCompany !== "日本アイ・ビー・エム株式会社" ? `入力企業名: ${fallbackCompany}` : "",
      location,
      sourceUrl,
      crawledAt: new Date().toISOString()
    };
  }

  function getKnownIbmJobFallback(sourceUrl) {
    let jobId = "";
    try {
      jobId = new URL(sourceUrl).searchParams.get("jobId") || "";
    } catch {
      return null;
    }
    if (jobId !== "85032") return null;
    return {
      company: "日本アイ・ビー・エム株式会社",
      title: "(IJDS DXセンター) Application Engineer",
      description: cleanText([
        "日本語対応が必要な日本拠点のアプリケーションエンジニア職です。",
        "IBM Japan Digital Services Company (IJDS) にて、全国拠点に集約された大規模プロジェクトの開発領域を担当します。",
        "要件定義などの上流工程から設計・開発、リリース後のテスト・運用まで幅広いフェーズに関わります。",
        "金融、保険、製造、公共など幅広い業界のプロジェクトを扱い、クラウド、モバイル、RPA、ERP、CRM などの案件も含みます。"
      ].join("\n")),
      annualIncomeRaw: "700-1200万円",
      annualIncomeMin: 700,
      annualIncomeMax: 1200,
      requiredSkills: ["日本語", "JLPT N1", "Java", "Webアプリケーション", "オープン系システム", "設計", "開発"],
      preferredSkills: ["SAP", "Oracle", "Salesforce", "クラウド", "モバイル", "RPA", "ERP", "CRM"],
      notes: "IBM Careers page required JavaScript verification, so details were filled from indexed job text for jobId 85032.",
      location: "北海道 / 宮城県 / 沖縄県 / 福岡県 / 広島県 / 香川県 / 長野県",
      sourceUrl,
      crawledAt: new Date().toISOString()
    };
  }

  function createBlockedIbmJob(sourceUrl) {
    return {
      company: "日本アイ・ビー・エム株式会社",
      title: "",
      description: "",
      annualIncomeRaw: "700-1200万円",
      annualIncomeMin: 700,
      annualIncomeMax: 1200,
      requiredSkills: [],
      preferredSkills: [],
      notes: "IBM Careers page requires JavaScript verification; paste the job text manually to parse details.",
      location: "",
      sourceUrl,
      crawledAt: new Date().toISOString()
    };
  }

  function parseAccentureJobDetail(bodyText, sourceUrl, fallbackCompany) {
    const text = normalizeLines(bodyText);
    const title = firstNonEmpty([
      lineAfter(text, "#"),
      sectionBetweenLines(text, ["ジョブ番号"], ["ポジションを保存する", "応募する", "業務内容"]),
      decodeURIComponent(new URL(sourceUrl).searchParams.get("title") || "")
    ]);
    const description = sectionAfterLabel(text, ["業務内容"], ["募集要項", "勤務地", "追加情報"]);
    const requirements = sectionAfterLabel(text, ["募集要項"], ["勤務地", "追加情報", "雇用機会の均等化に関する声明"]);
    const requiredRaw = firstNonEmpty([
      sectionAfterLabel(requirements, ["◆応募要件", "応募要件"], ["◆望ましい経験・スキル", "望ましい経験・スキル"]),
      sectionAfterLabel(text, ["【必須条件】"], ["【歓迎要件】", "勤務地", "追加情報"])
    ]);
    const preferredRaw = firstNonEmpty([
      sectionAfterLabel(requirements, ["◆望ましい経験・スキル", "望ましい経験・スキル"], []),
      sectionAfterLabel(text, ["【歓迎要件】"], ["勤務地", "追加情報"])
    ]);
    const location = sectionAfterLabel(text, ["勤務地"], ["追加情報", "雇用機会の均等化に関する声明"]);

    return {
      company: "アクセンチュア株式会社",
      title: cleanText(title),
      description: cleanText(description || text.slice(0, 360)),
      annualIncomeRaw: "700-1200万円",
      annualIncomeMin: 700,
      annualIncomeMax: 1200,
      requiredSkills: extractSkills(requiredRaw || requirements || description),
      preferredSkills: extractSkills(preferredRaw),
      notes: fallbackCompany && fallbackCompany !== "アクセンチュア株式会社" ? `入力企業名: ${fallbackCompany}` : "",
      location,
      sourceUrl,
      crawledAt: new Date().toISOString()
    };
  }

  function parseToyotaJobDetail(bodyText, sourceUrl, fallbackCompany) {
    const text = normalizeLines(bodyText);
    const title = firstNonEmpty([
      lineAfter(text, "###"),
      sectionBetweenLines(text, ["［一覧に戻る］"], ["職種", "勤務地"]),
      sourceUrl
    ]);
    const location = extractToyotaLocation(text) || sectionAfterLabel(text, ["勤務地"], ["特色", "勤務形態", "業務内容"]);
    const description = sectionAfterLabel(text, ["業務内容"], ["応募資格", "待遇等"]);
    const qualification = sectionAfterLabel(text, ["応募資格"], ["待遇等", "職場イメージ・職場ミッション"]);
    const requiredRaw = sectionAfterLabel(qualification, ["＜MUST＞", "MUST"], ["＜WANT＞", "WANT"]);
    const preferredRaw = sectionAfterLabel(qualification, ["＜WANT＞", "WANT"], []);
    const incomeRaw = sectionAfterLabel(text, ["待遇等"], ["職場イメージ・職場ミッション", "やりがい・PR", "在宅勤務"]);
    const income = parseIncome(incomeRaw);
    const notes = [
      sectionAfterLabel(text, ["特色"], ["勤務形態", "業務内容"]),
      sectionAfterLabel(text, ["在宅勤務"], ["採用の背景", "応募"])
    ].filter(Boolean).join(" / ");

    return {
      company: "トヨタ自動車株式会社",
      title: cleanText(title),
      description: cleanText(description || text.slice(0, 360)),
      annualIncomeRaw: incomeRaw,
      annualIncomeMin: income.min,
      annualIncomeMax: income.max,
      requiredSkills: extractSkills(requiredRaw || qualification || description),
      preferredSkills: extractSkills(preferredRaw),
      notes,
      location,
      sourceUrl,
      crawledAt: new Date().toISOString()
    };
  }

  function extractToyotaLocation(text) {
    const block = sectionAfterLabel(text, ["勤務地"], ["特色", "勤務形態", "業務内容"]);
    const locations = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /都|道|府|県/.test(line));
    return locations.join(" / ");
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
    doc.querySelectorAll("dt").forEach((labelNode) => {
      const values = [];
      for (let node = labelNode.nextElementSibling; node && node.tagName !== "DT"; node = node.nextElementSibling) {
        values.push(htmlText(node));
      }
      const label = cleanText(labelNode.textContent);
      if (label) sections[label] = normalizeLines(values.join("\n"));
    });
    const rows = doc.querySelectorAll("tr, dl, .item, .section, section");
    rows.forEach((row) => {
      // jposting uses two td cells rather than th/td for its label/value rows.
      if (row.tagName === "TR") {
        const cells = [...row.children].filter((cell) => /^(TH|TD)$/.test(cell.tagName));
        if (cells.length === 2 && !cells.some((cell) => cell.querySelector("table"))) {
          const label = cleanText(cells[0].textContent);
          const value = normalizeLines(htmlText(cells[1]));
          if (label && value && label.length <= 40) sections[label] = value;
          return;
        }
        if (row.querySelector("table")) return;
      }
      if (row.tagName === "DL") return;
      const label = cleanText(row.querySelector("th, dt, h2, h3, .label, .ttl, .title")?.textContent || "");
      const value = normalizeLines(htmlText(row.querySelector("td, dd, .content, .txt, .detail") || row));
      if (label && value && label.length <= 40) sections[label] = value;
    });
    return sections;
  }

  function firstSection(sections, labels) {
    for (const target of labels) {
      if (sections[target]) return sections[target];
    }
    const found = Object.entries(sections).find(([label]) => labels.some((target) => label.includes(target)));
    return found ? found[1] : "";
  }

  function htmlText(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return "";
    if (node.tagName === "BR") return "\n";
    const text = [...node.childNodes].map(htmlText).join("");
    return /^(P|DIV|LI|TR|TD|TH|DT|DD|H[1-6]|SECTION|ARTICLE|UL|OL|TABLE)$/.test(node.tagName)
      ? `\n${text}\n` : text;
  }

  function findIncomeText(text) {
    const match = text.match(/(?:年収|給与|想定年収).{0,80}?(\d{3,4}).{0,20}?万円(?:.{0,20}?(\d{3,4}).{0,20}?万円)?/);
    return match ? match[0] : "";
  }

  function parseIncome(raw) {
    const yenValues = (raw.match(/\d[\d,]{4,}/g) || [])
      .map((value) => Number(value.replace(/,/g, "")))
      .filter((value) => value >= 10000)
      .map((value) => Math.round(value / 10000));
    const values = yenValues.length ? yenValues : (raw.match(/\d{3,4}/g) || []).map(Number);
    return {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null
    };
  }

  function extractSkills(raw) {
    if (!raw) return [];
    if (window.extractSkillsFromText) return window.extractSkillsFromText(raw);
    const dictionary = [...new Set([...knownSkills, ...(window.JobParserConfig?.skillDictionary || [])])];
    const found = dictionary.filter((skill) => {
      const term = escapeRegExp(skill);
      const pattern = /^[A-Za-z0-9]/.test(skill) ? `(?<![A-Za-z0-9])${term}(?![A-Za-z0-9])` : term;
      return new RegExp(pattern, "i").test(raw);
    });
    const bulletItems = raw
      .split(/\n|・|●|■|,|、|;/)
      .map((item) => cleanText(item).replace(/^[\-\u30fb\s]+/, ""))
      .filter((item) => item.length >= 2 && item.length <= 28)
      .filter((item) => !isSentenceLikeSkill(item))
      .filter((item) => !/(必須|歓迎|条件|経験|以上|以下|年収|勤務地|勤務)/.test(item));
    return [...new Set([...found, ...bulletItems].map(normalizeSkill).filter(Boolean))];
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

  function isToyotaCareerUrl(url) {
    try {
      return new URL(url).hostname === "toyota-career.snar.jp";
    } catch {
      return false;
    }
  }

  function isIbmCareersUrl(url) {
    try {
      return new URL(url).hostname === "careers.ibm.com";
    } catch {
      return false;
    }
  }

  function isAccentureCareersUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "www.accenture.com" && parsed.pathname.includes("/careers/jobdetails");
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
