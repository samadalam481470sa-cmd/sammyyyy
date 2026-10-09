import {
  EMPTY_DISCOVER,
  TEXAS_MAP_TILES,
  discoverNote,
  fetchOverpassTile,
  inspectCompanyCareers,
  nextDiscoverStatus,
  rankMapCompanies,
  type DiscoverStatus,
  type EmployerRecord,
} from "@fillglen/core";

let busy = false;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    if (!r.ok) return null;
    return (await r.text()).slice(0, 160_000);
  } catch {
    return null;
  }
}

export async function loadDiscover(): Promise<{
  status: DiscoverStatus;
  employers: EmployerRecord[];
}> {
  const { discoverStatus, discoveredEmployers } = await chrome.storage.local.get(["discoverStatus", "discoveredEmployers"]);
  return {
    status: (discoverStatus as DiscoverStatus) || { ...EMPTY_DISCOVER },
    employers: (discoveredEmployers as EmployerRecord[]) || [],
  };
}

export async function runDiscoverTick(): Promise<DiscoverStatus> {
  if (busy) {
    const { status } = await loadDiscover();
    return status;
  }
  busy = true;
  try {
    const { keepApplying } = await chrome.storage.local.get(["keepApplying"]);
    if (!keepApplying) {
      const { status } = await loadDiscover();
      const off = nextDiscoverStatus(status, { running: false });
      await chrome.storage.local.set({ discoverStatus: { ...off, note: discoverNote(off) } });
      return off;
    }
    let { status, employers } = await loadDiscover();
    const idx = status.tileIndex % TEXAS_MAP_TILES.length;
    const tile = TEXAS_MAP_TILES[idx];
    status = nextDiscoverStatus(status, {
      running: true,
      lastTile: tile.name,
      note: `Scanning ${tile.name} for companies with public websites…`,
    });
    await chrome.storage.local.set({ discoverStatus: { ...status, note: discoverNote(status) } });

    const companies = rankMapCompanies(await fetchOverpassTile(tile));
    status = nextDiscoverStatus(status, {
      tileIndex: idx + 1,
      companiesSeen: status.companiesSeen + companies.length,
      lastTile: tile.name,
    });

    const known = new Set(employers.map((e) => e.company.toLowerCase()));
    let sites = 0;
    for (const co of companies) {
      if (sites >= 6) break;
      if (known.has(co.name.toLowerCase())) continue;
      const rec = await inspectCompanyCareers(co, fetchHtml);
      sites += 1;
      status = nextDiscoverStatus(status, { sitesChecked: status.sitesChecked + 1 });
      if (!rec) continue;
      employers.push(rec);
      known.add(rec.company.toLowerCase());
      if (rec.slug) status = nextDiscoverStatus(status, { mappedFeeds: status.mappedFeeds + 1 });
    }
    if (employers.length > 400) employers = employers.slice(-400);
    status = nextDiscoverStatus(status, { running: true });
    const stored = { ...status, note: discoverNote(status) };
    await chrome.storage.local.set({ discoverStatus: stored, discoveredEmployers: employers });
    return stored;
  } finally {
    busy = false;
  }
}
