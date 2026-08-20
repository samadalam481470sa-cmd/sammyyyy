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
    greenhouse: [
      "stripe", "figma", "databricks", "cloudflare", "samsara", "gitlab", "duolingo", "robinhood",
      "doordash", "opendoor", "gusto", "affirm", "instacart", "coinbase", "dropbox", "twilio",
    ],
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

  // Default target areas to surface listings from (states, metros, or DC).
  const DEFAULT_AREAS = ["FL", "CA", "DC", "Chicago", "IL", "CO", "Phoenix", "AZ"];

  // True if a location string matches any of the given area tokens. Two-letter
  // tokens are treated as state abbreviations (word-boundary) and also match the
  // full state name; longer tokens (cities) are matched as substrings.
  function matchesArea(location, tokens) {
    return areaOf(location, tokens) !== null;
  }

  // Returns the first target token a location matches (canonical: 2-letter tokens
  // upper-cased, city tokens lower-cased), or null.
  function areaOf(location, tokens) {
    if (!tokens || !tokens.length) return null;
    const loc = (location || "").toLowerCase();
    if (!loc) return null;
    for (const raw of tokens) {
      const t = String(raw || "").trim().toLowerCase();
      if (!t) continue;
      const abbr = t.toUpperCase();
      if (t.length === 2 && STATE_NAMES[abbr]) {
        if (new RegExp(`\\b${t}\\b`).test(loc) || loc.includes(STATE_NAMES[abbr].toLowerCase())) return abbr;
      } else if (loc.includes(t)) {
        return t;
      }
    }
    return null;
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
    // Target areas: user-provided list, plus the ZIP's own state.
    const areaTokens = (opts.areas && opts.areas.length ? opts.areas.slice() : DEFAULT_AREAS.slice());
    if (state && !areaTokens.map((t) => String(t).toUpperCase()).includes(state)) areaTokens.push(state);

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
      // In-area = a target area (FL/CA/DC/Chicago/CO/Phoenix/AZ/your ZIP state) or US-remote.
      const matchedArea = foreign ? null : areaOf(loc, areaTokens);
      j.matchedArea = matchedArea || (isRemote ? "Remote" : null);
      j.area = !foreign && (isRemote || matchedArea) ? "in-area" : "elsewhere";

      if (matcher && opts.resumeText) {
        const m = matcher.computeMatchScore(opts.resumeText, opts.resumeSkills || [], `${j.title} ${j.location} ${j.description}`);
        j.score = m.score;
        j.matched = m.matched;
      } else {
        j.score = 0;
        j.matched = [];
      }
      j._sortKey = [-j.score, -(Date.parse(j.postedAt) || 0)];
    }

    const byScore = (a, b) => {
      for (let i = 0; i < a._sortKey.length; i++) {
        if (a._sortKey[i] !== b._sortKey[i]) return a._sortKey[i] - b._sortKey[i];
      }
      return 0;
    };

    const inArea = jobs.filter((j) => j.area === "in-area");
    const elsewhere = jobs.filter((j) => j.area !== "in-area").sort(byScore);

    // Balance across the requested areas so each one is represented (round-robin
    // by area, best-scored first), instead of a few metros filling every slot.
    const groups = new Map();
    for (const j of inArea) {
      const key = j.matchedArea || "Remote";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(j);
    }
    for (const arr of groups.values()) arr.sort(byScore);

    // Ordered keys: requested areas (in the user's order), then Remote, then any others.
    const orderedKeys = [];
    for (const raw of areaTokens) {
      const t = String(raw || "").trim();
      const key = t.length === 2 ? t.toUpperCase() : t.toLowerCase();
      if (groups.has(key) && !orderedKeys.includes(key)) orderedKeys.push(key);
    }
    if (groups.has("Remote") && !orderedKeys.includes("Remote")) orderedKeys.push("Remote");
    for (const key of groups.keys()) if (!orderedKeys.includes(key)) orderedKeys.push(key);

    const selectedSet = new Set();
    let selected = [];
    let added = true;
    while (selected.length < max && added) {
      added = false;
      for (const key of orderedKeys) {
        const arr = groups.get(key) || [];
        const next = arr.find((j) => !selectedSet.has(j));
        if (next) {
          selectedSet.add(next);
          selected.push(next);
          added = true;
          if (selected.length >= max) break;
        }
      }
    }

    // Backfill with out-of-area postings only if we couldn't fill the list.
    if (selected.length < Math.min(15, max)) {
      selected = selected.concat(elsewhere.slice(0, max - selected.length));
    }

    selected = selected.map((j) => {
      const { _sortKey, description, ...rest } = j;
      return rest; // drop the heavy description before storing
    });

    return {
      generatedAt: new Date().toISOString(),
      zip: opts.zip || "",
      state,
      areas: areaTokens,
      stats: { sourcesOk, sourcesFailed, total: selected.length, inArea: inArea.length },
      jobs: selected,
    };
  }

  global.JobFetcher = { fetchAndRankJobs, zipToState, matchesArea, DEFAULT_SOURCES, DEFAULT_AREAS };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.JobFetcher;
  }
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);
