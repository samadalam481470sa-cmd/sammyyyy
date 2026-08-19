/**
 * In-extension job discovery.
 *
 * Pulls REAL, currently-open postings from officially public job APIs (no
 * scraping, no keys), scores each against the user's saved resume with the SAME
 * matcher the on-page autofill/score uses, biases toward the user's ZIP area
 * plus remote roles, and returns a ranked shortlist.
 *
 * Runs from the background service worker (see background.js) on a schedule, so
 * a fresh batch is ready each time you open Chrome. Nothing here submits
 * anything or logs into any site — it only reads public listing APIs.
 */
(function (global) {
  // Curated set of active public boards. Users can't hit private data here — all
  // of these are the same public endpoints each company links from its careers
  // page. Invalid/expired slugs are skipped gracefully.
  const DEFAULT_SOURCES = {
    greenhouse: ["stripe", "figma", "databricks", "cloudflare", "samsara", "gitlab", "duolingo", "robinhood"],
    lever: ["plaid", "voleon", "matchgroup"],
    ashby: ["linear", "vanta", "ramp"],
    remoteok: true,
  };

  const STATE_NAMES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
    CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
    LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
    OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
    WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  };

  // 3-digit ZIP prefix ranges -> USPS state (standard SCF map).
  const ZIP_RANGES = [
    [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"],
    [50, 54, "VT"], [55, 59, "MA"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"], [150, 196, "PA"],
    [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"],
    [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"],
    [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"],
    [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"],
    [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"],
    [660, 679, "KS"], [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"],
    [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
    [850, 865, "AZ"], [870, 884, "NM"], [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"],
    [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
  ];

  function zipToState(zip) {
    const digits = String(zip || "").replace(/\D/g, "");
    if (digits.length < 3) return "";
    const prefix = parseInt(digits.slice(0, 3), 10);
    for (const [lo, hi, st] of ZIP_RANGES) {
      if (prefix >= lo && prefix <= hi) return st;
    }
    return "";
  }

  function decodeEntities(s) {
    return (s || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/g, " ");
  }

  function stripHtml(html) {
    return decodeEntities(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }

  const REMOTE_RE = /\bremote\b|\banywhere\b|\bwork from home\b|\bwfh\b|\bdistributed\b/i;
  function looksRemote(text) {
    return REMOTE_RE.test(text || "");
  }

  // Common non-US locations, so "Remote - India" isn't counted as "in your area".
  const FOREIGN_RE = new RegExp(
    "\\b(" +
      [
        "india", "bengaluru", "bangalore", "hyderabad", "pune", "canada", "toronto", "vancouver", "montreal",
        "united kingdom", "\\buk\\b", "london", "ireland", "dublin", "germany", "berlin", "munich", "france",
        "paris", "netherlands", "amsterdam", "poland", "krakow", "warsaw", "romania", "bucharest", "singapore",
        "australia", "sydney", "melbourne", "japan", "tokyo", "brazil", "sao paulo", "mexico", "spain", "madrid",
        "barcelona", "israel", "tel aviv", "china", "\\bkorea\\b", "philippines", "manila", "nigeria",
        "south africa", "portugal", "lisbon", "sweden", "stockholm", "denmark", "copenhagen", "switzerland",
        "zurich", "italy", "belgium", "austria", "norway", "finland", "colombia", "argentina", "chile",
        "uruguay", "costa rica", "\\buae\\b", "dubai", "hong kong", "taiwan", "vietnam", "thailand", "indonesia",
        "malaysia", "new zealand", "emea", "apac",
      ].join("|") +
      ")\\b",
    "i"
  );
  function looksForeign(text) {
    return FOREIGN_RE.test(text || "");
  }

  async function getJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchGreenhouse(slug) {
    const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
    return (data.jobs || []).map((j) => ({
      id: `greenhouse:${slug}:${j.id}`,
      source: "greenhouse",
      title: j.title || "",
      company: slug,
      location: (j.location && j.location.name) || "",
      url: j.absolute_url || "",
      description: stripHtml(j.content).slice(0, 4000),
      postedAt: j.updated_at || j.first_published || null,
    }));
  }

  async function fetchLever(slug) {
    const data = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
    return (data || []).map((j) => ({
      id: `lever:${slug}:${j.id}`,
      source: "lever",
      title: j.text || "",
      company: slug,
      location: (j.categories && j.categories.location) || "",
      url: j.hostedUrl || j.applyUrl || "",
      description: (j.descriptionPlain || stripHtml(j.description) || "").slice(0, 4000),
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    }));
  }

  async function fetchAshby(slug) {
    const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
    return (data.jobs || []).map((j) => ({
      id: `ashby:${slug}:${j.id || j.jobUrl}`,
      source: "ashby",
      title: j.title || "",
      company: slug,
      location: j.location || (j.address && j.address.postalAddress && j.address.postalAddress.addressLocality) || "",
      url: j.jobUrl || j.applyUrl || "",
      description: (j.descriptionPlain || stripHtml(j.descriptionHtml) || "").slice(0, 4000),
      postedAt: j.publishedAt || j.updatedAt || null,
      isRemote: j.isRemote === true,
    }));
  }

  async function fetchRemoteOk() {
    const data = await getJson("https://remoteok.com/api");
    return (Array.isArray(data) ? data : [])
      .filter((j) => j && j.id && j.position)
      .map((j) => ({
        id: `remoteok:${j.id}`,
        source: "remoteok",
        title: j.position || "",
        company: j.company || "",
        location: j.location || "Remote",
        url: j.url || j.apply_url || "",
        description: stripHtml(j.description).slice(0, 4000),
        postedAt: j.date || null,
        isRemote: true,
      }));
  }

  function withinDays(iso, days) {
    if (!iso) return true; // keep undated postings rather than silently dropping them
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return true;
    return Date.now() - t <= days * 86400000;
  }

  function dedupe(jobs) {
    const seen = new Set();
    const out = [];
    for (const j of jobs) {
      const key = `${(j.company || "").toLowerCase()}|${(j.title || "").toLowerCase()}|${j.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(j);
    }
    return out;
  }

  /**
   * Fetches, scores, and ranks jobs.
   * options: { zip, resumeText, resumeSkills, sources, max, postedWithinDays }
   * Returns { generatedAt, state, jobs: [...], stats }.
   */
  async function fetchAndRankJobs(options) {
    const opts = options || {};
    const sources = opts.sources || DEFAULT_SOURCES;
    const max = opts.max || 40;
    const postedWithinDays = opts.postedWithinDays || 45;
    const state = zipToState(opts.zip);
    const stateName = state ? (STATE_NAMES[state] || "") : "";

    const tasks = [];
    if (sources.remoteok) tasks.push(fetchRemoteOk());
    (sources.greenhouse || []).forEach((s) => tasks.push(fetchGreenhouse(s)));
    (sources.lever || []).forEach((s) => tasks.push(fetchLever(s)));
    (sources.ashby || []).forEach((s) => tasks.push(fetchAshby(s)));

    const settled = await Promise.allSettled(tasks);
    let jobs = [];
    let sourcesOk = 0;
    let sourcesFailed = 0;
    for (const r of settled) {
      if (r.status === "fulfilled") {
        sourcesOk++;
        jobs.push(...r.value);
      } else {
        sourcesFailed++;
      }
    }

    jobs = dedupe(jobs).filter((j) => j.url && j.title && withinDays(j.postedAt, postedWithinDays));

    const matcher = global.JobMatcher;
    for (const j of jobs) {
      const loc = (j.location || "");
      const foreign = looksForeign(loc);
      const isRemote = (j.isRemote === true || looksRemote(`${loc} ${j.title}`)) && !foreign;
      j.isRemote = isRemote;
      // Area: 0 = in your state or US-remote (best), 1 = elsewhere/international.
      const inState =
        !!state &&
        (new RegExp(`\\b${state}\\b`).test(loc) || (stateName && loc.toLowerCase().includes(stateName.toLowerCase())));
      j.area = !foreign && (isRemote || inState) ? "in-area" : "elsewhere";
      const areaRank = j.area === "in-area" ? 0 : 1;

      if (matcher && opts.resumeText) {
        const m = matcher.computeMatchScore(opts.resumeText, opts.resumeSkills || [], `${j.title} ${j.location} ${j.description}`);
        j.score = m.score;
        j.matched = m.matched;
      } else {
        j.score = 0;
        j.matched = [];
      }
      j._sortKey = [areaRank, -j.score, -(Date.parse(j.postedAt) || 0)];
    }

    jobs.sort((a, b) => {
      for (let i = 0; i < a._sortKey.length; i++) {
        if (a._sortKey[i] !== b._sortKey[i]) return a._sortKey[i] - b._sortKey[i];
      }
      return 0;
    });

    jobs = jobs.slice(0, max).map((j) => {
      const { _sortKey, description, ...rest } = j;
      return rest; // drop the heavy description before storing
    });

    return {
      generatedAt: new Date().toISOString(),
      zip: opts.zip || "",
      state,
      stats: { sourcesOk, sourcesFailed, total: jobs.length },
      jobs,
    };
  }

  global.JobFetcher = { fetchAndRankJobs, zipToState, DEFAULT_SOURCES };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.JobFetcher;
  }
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);
