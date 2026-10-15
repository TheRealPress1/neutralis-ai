import { teamBrand } from "./team-brands.ts";
import type {
  Opportunity, OpportunityBook, OpportunityDataStatus, OpportunityFeed, OpportunityLevel,
  OpportunityMarket, OpportunityPair, OpportunityTeam, OpportunityVenue, OpportunityVenueHealth,
} from "./opportunity-types";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const POLY = "https://gateway.polymarket.us/v1";
const SERIES = ["KXNBAGAME", "KXNHLGAME", "KXNFLGAME", "KXMLBGAME"] as const;
const TTL = 30_000;
const MAX_STALE = 120_000;
const FAILURE_TTL = 10_000;
const MAX_CANDIDATES = 12;
const SCOPE = "Review candidates from NBA, NHL, NFL and MLB game winners on Kalshi and Polymarket US. Bounded discovery: up to 200 markets per Kalshi series, 500 US moneyline markets, and 12 compared contracts. Not a complete market scan.";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
type Raw = Record<string, unknown>;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type Snapshot = { data: Raw | null; at: number | null; status: OpportunityDataStatus; missing?: boolean };
type Identity = { league: string; date: string; teams: string[]; yes: string; outcome: string; key: string; event: string; scheduledTime: string | null };
type Candidate = { kalshi: Raw; poly: Raw; identity: Identity; kalshiAt: number; polyAt: number; metadataStatus: OpportunityDataStatus };

const obj = (value: unknown): Raw => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const str = (value: unknown): string => typeof value === "string" ? value : "";
const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const iso = (value: number): string => new Date(value).toISOString();
function number(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function date(value: unknown): string | null {
  const v = str(value);
  return v && Number.isFinite(Date.parse(v)) ? v : null;
}
const rounded = (n: number) => Math.round(n * 1e8) / 1e8;
function canonicalTeam(league: string, value: unknown): string {
  const code = str(value).toUpperCase();
  // Explicit exchange abbreviation aliases, not fuzzy team-name matching.
  const aliases: Record<string, Record<string, string>> = {
    nhl: { LAK: "LA", TBL: "TB", NJD: "NJ", SJS: "SJ", MON: "MTL", WAS: "WSH" },
    nba: { PHO: "PHX", BRK: "BKN", GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS" },
    nfl: { JAC: "JAX", WSH: "WAS" }, mlb: { TBR: "TB", SDP: "SD", SFG: "SF", KCR: "KC", WSN: "WSH", CHW: "CWS" },
  };
  return /^[A-Z]{2,3}$/.test(code) ? aliases[league]?.[code] ?? code : "";
}
function teamPresentation(raw: Raw, identity: Identity): OpportunityTeam[] {
  // Presentation comes from the same explicit sides that passed the identity join.
  const sides = arr(raw.marketSides).map(obj);
  return identity.teams.map(code => {
    const side = sides.find(value => canonicalTeam(identity.league, obj(value.team).abbreviation) === code)!;
    const team = obj(side.team), name = str(team.name).trim(), safe = str(team.safeName).trim();
    const fullName = safe && name
      ? safe.toLowerCase().endsWith(name.toLowerCase()) ? safe
        : name.toLowerCase().includes(safe.toLowerCase()) ? name
          : identity.league === "nba" ? `${safe} ${name}` : name
      : name || safe || code;
    const brand = teamBrand(identity.league, code);
    return { league: identity.league.toUpperCase(), code, name: brand?.name || fullName, logoUrl: brand?.logoUrl ?? null, isYesOutcome: code === identity.yes };
  });
}
function validDay(year: string, month: string, day: string): string | null {
  const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(parsed) && iso(parsed).slice(0, 10) === value ? value : null;
}
function ruleDate(rules: string): string | null {
  const match = rules.match(/(?:originally )?scheduled for ([A-Za-z]+) (\d{1,2}), (\d{4})/i);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].slice(0, 3).toUpperCase()) + 1;
  return month ? validDay(match[3], String(month), match[2]) : null;
}
function openKalshi(raw: Raw, now: number): boolean {
  return ["active", "open"].includes(str(raw.status)) && !str(raw.result) && raw.market_type === "binary"
    && number(raw.notional_value_dollars) === 1 && !!date(raw.close_time) && Date.parse(str(raw.close_time)) > now;
}
function openPoly(raw: Raw, now: number): boolean {
  return raw.active === true && raw.closed === false && raw.archived !== true && raw.hidden !== true
    && raw.status === "MARKET_STATUS_OPEN" && raw.ep3Status === "OPEN"
    && !!date(raw.endDate) && Date.parse(str(raw.endDate)) > now;
}
export function polyIdentity(raw: Raw): Identity | null {
  if (raw.sportsMarketTypeV2 !== "SPORTS_MARKET_TYPE_MONEYLINE") return null;
  const sides = arr(raw.marketSides).map(obj);
  if (sides.length !== 2 || sides.some(s => s.tradable !== true)) return null;
  const longs = sides.filter(s => s.long === true), shorts = sides.filter(s => s.long === false);
  if (longs.length !== 1 || shorts.length !== 1) return null;
  const team = obj(longs[0].team), other = obj(shorts[0].team);
  const league = str(team.league).toLowerCase();
  if (!["nba", "nhl", "nfl", "mlb"].includes(league) || other.league !== team.league) return null;
  const yes = canonicalTeam(league, team.abbreviation), no = canonicalTeam(league, other.abbreviation);
  if (!yes || !no || yes === no) return null;
  const slug = str(raw.slug).match(/^aec-(nba|nhl|nfl|mlb)-([a-z]{2,3})-([a-z]{2,3})-(\d{4})-(\d{2})-(\d{2})$/);
  if (!slug || slug[1] !== league) return null;
  const teams = [yes, no].sort();
  if ([canonicalTeam(league, slug[2]), canonicalTeam(league, slug[3])].sort().join() !== teams.join()) return null;
  const day = validDay(slug[4], slug[5], slug[6]);
  if (!day || ruleDate(str(raw.description)) !== day) return null;
  let scheduledTime: string | null = null;
  if (league === "mlb") {
    // MLB can have doubleheaders. Require original rule time AND current source start time
    // to corroborate the time encoded in the Kalshi ticker, otherwise exclude the join.
    const time = str(raw.description).match(/scheduled for [A-Za-z]+ \d{1,2}, \d{4} at (\d{1,2}):(\d{2})\s*(AM|PM) ET/i);
    const sourceTime = date(raw.gameStartTime);
    if (time && sourceTime) {
      const hour = Number(time[1]) % 12 + (time[3].toUpperCase() === "PM" ? 12 : 0);
      const expected = `${String(hour).padStart(2, "0")}${time[2]}`;
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(sourceTime));
      const part = (kind: string) => parts.find(p => p.type === kind)?.value;
      if (`${part("year")}-${part("month")}-${part("day")}` === day && `${part("hour")}${part("minute")}` === expected) scheduledTime = expected;
    }
    if (!scheduledTime) return null;
  }
  return { league, date: day, teams, yes, scheduledTime, outcome: str(team.safeName) || str(team.name) || yes,
    key: `${league}:${day}:${teams.join(":")}:${yes}`, event: `${league}:${day}:${teams.join(":")}` };
}
function kalshiMatches(raw: Raw, identity: Identity): boolean {
  const series = `KX${identity.league.toUpperCase()}GAME`;
  const m = str(raw.ticker).match(new RegExp(`^${series}-(\\d{2})([A-Z]{3})(\\d{2})(\\d{4})?([A-Z]{4,6})-([A-Z]{2,3})$`));
  if (!m || str(raw.event_ticker) !== str(raw.ticker).slice(0, -(m[6].length + 1))) return false;
  const day = validDay(`20${m[1]}`, String(MONTHS.indexOf(m[2]) + 1), m[3]);
  if (day !== identity.date || ruleDate(str(raw.rules_primary)) !== day || !/\bwins\b/i.test(str(raw.rules_primary))) return false;
  if (identity.league === "mlb" && m[4] !== identity.scheduledTime) return false;
  if (canonicalTeam(identity.league, m[6]) !== identity.yes) return false;
  // Split only against the two independently supplied US team codes. No substring score.
  const letters = m[5];
  const splits = [2, 3].map(n => [canonicalTeam(identity.league, letters.slice(0, n)), canonicalTeam(identity.league, letters.slice(n))]);
  return splits.some(parts => parts.every(Boolean) && parts.sort().join() === identity.teams.join());
}
export function opportunityId(kalshiTicker: string, polySlug: string): string { return `v1~${kalshiTicker}~${polySlug}`; }
export function parseOpportunityId(id: string): { ticker: string; slug: string } | null {
  if (id.length > 220) return null;
  const m = id.match(/^v1~(KX(?:NBA|NHL|NFL|MLB)GAME-[A-Z0-9]{10,24}-[A-Z]{2,3})~(aec-(?:nba|nhl|nfl|mlb)-[a-z]{2,3}-[a-z]{2,3}-\d{4}-\d{2}-\d{2})$/);
  return m ? { ticker: m[1], slug: m[2] } : null;
}
function emptyBook(at: number | null = null): OpportunityBook {
  return { yesAsks: [], noAsks: [], status: "unavailable", fetchedAt: at === null ? null : iso(at), exchangeTimestamp: null };
}
function levels(raw: unknown, complement: boolean, poly: boolean): OpportunityLevel[] {
  const grouped = new Map<number, number>();
  for (const item of arr(raw)) {
    const value = obj(item), px = obj(value.px);
    if (poly && px.currency !== "USD") continue;
    const price = number(poly ? px.value : arr(item)[0]);
    const size = number(poly ? value.qty : arr(item)[1]);
    if (price === null || price <= 0 || price >= 1 || size === null || size <= 0) continue;
    const ask = rounded(complement ? 1 - price : price);
    const total = rounded((grouped.get(ask) ?? 0) + size);
    if (ask <= 0 || ask >= 1 || !Number.isFinite(total) || total <= 0) continue;
    grouped.set(ask, total);
  }
  return [...grouped].map(([price, size]) => ({ price, size })).sort((a, b) => a.price - b.price).slice(0, 10);
}
export function normalizeOpportunityBook(venue: OpportunityVenue, snapshot: Snapshot, expectedId: string, now: number): OpportunityBook {
  if (!snapshot.data || snapshot.at === null) return emptyBook();
  let yesAsks: OpportunityLevel[], noAsks: OpportunityLevel[], exchangeTimestamp: string | null = null;
  if (venue === "kalshi") {
    const book = obj(snapshot.data.orderbook_fp);
    if (!Object.hasOwn(book, "yes_dollars") || !Object.hasOwn(book, "no_dollars")) return emptyBook(snapshot.at);
    if (snapshot.data.ticker && snapshot.data.ticker !== expectedId) return emptyBook(snapshot.at);
    yesAsks = levels(book.no_dollars, true, false);
    noAsks = levels(book.yes_dollars, true, false);
  } else {
    const book = obj(snapshot.data.marketData);
    if (book.marketSlug !== expectedId || book.state !== "MARKET_STATE_OPEN") return emptyBook(snapshot.at);
    if (!Object.hasOwn(book, "bids") || !Object.hasOwn(book, "offers")) return emptyBook(snapshot.at);
    yesAsks = levels(book.offers, false, true);
    noAsks = levels(book.bids, true, true);
    exchangeTimestamp = date(book.transactTime);
    if (!exchangeTimestamp || Date.parse(exchangeTimestamp) > now + 30_000) return emptyBook(snapshot.at);
  }
  // Crossed books cannot be used to manufacture a positive pair signal.
  if (yesAsks[0] && noAsks[0] && yesAsks[0].price + noAsks[0].price < 1 - 1e-8) return emptyBook(snapshot.at);
  const oldExchange = exchangeTimestamp !== null && now - Date.parse(exchangeTimestamp) > 45_000;
  return { yesAsks, noAsks, status: oldExchange ? "stale" : snapshot.status, fetchedAt: iso(snapshot.at), exchangeTimestamp };
}
export function comparePairs(kalshi: OpportunityBook, poly: OpportunityBook, metadataStatus: OpportunityDataStatus = "live"): OpportunityPair[] {
  return (["kalshi_yes_polymarket_no", "polymarket_yes_kalshi_no"] as const).map(direction => {
    const kYes = direction === "kalshi_yes_polymarket_no";
    const k = (kYes ? kalshi.yesAsks : kalshi.noAsks)[0], p = (kYes ? poly.noAsks : poly.yesAsks)[0];
    const status: OpportunityDataStatus = !k || !p || [kalshi.status, poly.status, metadataStatus].includes("unavailable") ? "unavailable"
      : [kalshi.status, poly.status, metadataStatus].includes("stale") ? "stale" : "live";
    const sum = k && p ? rounded(k.price + p.price) : null;
    return { direction, kalshiOutcome: kYes ? "yes" : "no", polymarketOutcome: kYes ? "no" : "yes",
      kalshiAsk: k?.price ?? null, polymarketAsk: p?.price ?? null,
      combinedPrice: sum, grossSpread: sum === null ? null : rounded(1 - sum), netEdge: null,
      availableSize: k && p ? Math.min(k.size, p.size) : null, status,
      warnings: ["Before fees. Settlement equivalence is unverified; $1 combined payout is hypothetical.",
        "Displayed depth is a snapshot, not a fill guarantee. Two venues cannot execute atomically.",
        ...(status === "stale" ? ["At least one source is stale; do not use this signal as a current quote."] : []),
        ...(status === "unavailable" ? ["A current executable ask or market state is unavailable."] : [])] };
  });
}

export function createOpportunityProvider(fetcher: Fetcher = fetch, now: () => number = Date.now, options: { polymarketSpacingMs?: number } = {}) {
  const cache = new Map<string, { data: Raw; at: number }>();
  const failures = new Map<string, number>();
  const inFlight = new Map<string, Promise<Snapshot>>();
  let active = 0;
  let nextPolyRequestAt = 0;
  const sourceCooldown = new Map<string, number>();
  const queue: (() => void)[] = [];
  let feedFlight: Promise<OpportunityFeed> | null = null;

  async function request(url: string): Promise<{ payload: Raw; status: number }> {
    if (active >= 8) {
      if (queue.length >= 64) throw new Error("Public data request capacity reached.");
      await new Promise<void>(resolve => queue.push(resolve));
    }
    active += 1;
    const host = new URL(url).host;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (host === "gateway.polymarket.us") {
        const start = Math.max(Date.now(), nextPolyRequestAt);
        nextPolyRequestAt = start + (options.polymarketSpacingMs ?? 250);
        const delay = start - Date.now();
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      }
      if ((sourceCooldown.get(host) ?? 0) > now()) return { payload: {}, status: 503 };
      timeout = setTimeout(() => controller.abort(), 2400);
      const response = await fetcher(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" }, redirect: "error" });
      if (response.status === 429) sourceCooldown.set(host, now() + FAILURE_TTL);
      if (!response.ok) return { payload: {}, status: response.status };
      return { payload: obj(await response.json()), status: response.status };
    } finally { clearTimeout(timeout); active -= 1; queue.shift()?.(); }
  }
  function fallback(key: string): Snapshot {
    const old = cache.get(key);
    if (old && now() - old.at <= MAX_STALE) return { data: old.data, at: old.at, status: "stale" };
    cache.delete(key);
    return { data: null, at: null, status: "unavailable" };
  }
  async function read(url: string, validate: (value: Raw) => boolean): Promise<Snapshot> {
    const hit = cache.get(url);
    if (hit && now() - hit.at < TTL) return { data: hit.data, at: hit.at, status: "live" };
    if (now() - (failures.get(url) ?? -Infinity) < FAILURE_TTL) return fallback(url);
    const pending = inFlight.get(url);
    if (pending) return pending;
    if (inFlight.size >= 64) return fallback(url);
    const work = (async (): Promise<Snapshot> => {
      try {
        const { payload, status } = await request(url);
        if (status === 404 || status === 410) { cache.delete(url); return { data: null, at: null, status: "unavailable", missing: true }; }
        if (status < 200 || status >= 300 || !validate(payload)) throw new Error("Invalid public source response.");
        const entry = { data: payload, at: now() };
        cache.delete(url); cache.set(url, entry); failures.delete(url);
        if (cache.size > 256) cache.delete(cache.keys().next().value!);
        return { ...entry, status: "live" };
      } catch {
        failures.delete(url); failures.set(url, now());
        if (failures.size > 256) failures.delete(failures.keys().next().value!);
        return fallback(url);
      }
    })();
    inFlight.set(url, work);
    try { return await work; } finally { inFlight.delete(url); }
  }
  function health(venue: OpportunityVenue, snapshots: Snapshot[], count: number): OpportunityVenueHealth {
    const successful = snapshots.filter(s => s.at !== null);
    const status = successful.length === 0 ? "unavailable" : snapshots.every(s => s.status === "live") ? "live" : "stale";
    return { venue, status, fetchedAt: successful.length ? iso(Math.min(...successful.map(s => s.at!))) : null, marketsDiscovered: count,
      message: status === "live" ? "Public discovery responded. Individual books have their own freshness." : status === "stale" ? "Some discovery data is cached or unavailable." : "Public discovery is unavailable. No substitute prices are supplied." };
  }
  function candidate(kalshi: Raw, poly: Raw, k: Snapshot, p: Snapshot): Candidate | null {
    if (k.at === null || p.at === null || !openKalshi(kalshi, now()) || !openPoly(poly, now())) return null;
    const identity = polyIdentity(poly);
    if (!identity || !kalshiMatches(kalshi, identity)) return null;
    return { kalshi, poly, identity, kalshiAt: k.at, polyAt: p.at,
      metadataStatus: k.status === "live" && p.status === "live" ? "live" : "stale" };
  }
  async function hydrate(c: Candidate): Promise<Opportunity | null> {
    const ticker = str(c.kalshi.ticker), slug = str(c.poly.slug);
    const [k, p] = await Promise.all([
      read(`${KALSHI}/markets/${ticker}/orderbook?depth=10`, v => !!v.orderbook_fp),
      read(`${POLY}/markets/${slug}/book`, v => !!v.marketData),
    ]);
    const polyState = str(obj(p.data?.marketData).state);
    if (k.missing || p.missing || ["MARKET_STATE_CLOSED", "MARKET_STATE_SETTLED", "MARKET_STATE_EXPIRED"].includes(polyState)) return null;
    const kBook = normalizeOpportunityBook("kalshi", k, ticker, now()), pBook = normalizeOpportunityBook("polymarket_us", p, slug, now());
    const kalshiUrl = `https://kalshi.com/markets_by_ticker/${ticker}`;
    // The documented market-by-slug endpoint is a verified direct source for this exact contract's rules.
    const polyUrl = `${POLY}/market/slug/${slug}`;
    const kalshi: OpportunityMarket = { venue: "kalshi", marketId: ticker, title: str(c.kalshi.title), yesOutcome: c.identity.outcome, url: kalshiUrl,
      rulesUrl: kalshiUrl, rules: [str(c.kalshi.rules_primary), str(c.kalshi.rules_secondary)].filter(Boolean).join("\n\n"),
      closeTime: date(c.kalshi.close_time), expectedSettlementTime: date(c.kalshi.expected_expiration_time), exchangeStatus: str(c.kalshi.status),
      metadataFetchedAt: iso(c.kalshiAt), book: kBook,
      fee: { status: "unknown", sourceUrl: "https://kalshi.com/docs/kalshi-fee-schedule.pdf", coefficient: null,
        note: "Market/event fee overrides, rounding and account charges have not been verified. No effective fee estimate is applied." } };
    const coefficient = number(c.poly.feeCoefficient);
    const polymarketUS: OpportunityMarket = { venue: "polymarket_us", marketId: slug, title: str(c.poly.question), yesOutcome: c.identity.outcome, url: polyUrl,
      rulesUrl: polyUrl, rules: str(c.poly.description), closeTime: date(c.poly.endDate), expectedSettlementTime: null, exchangeStatus: str(c.poly.status),
      metadataFetchedAt: iso(c.polyAt), book: pBook,
      fee: { status: coefficient === null ? "unknown" : "schedule_available", sourceUrl: "https://docs.polymarket.us/fees", coefficient,
        note: "Public market fee coefficient only. Actual fill rounding, fees and account rebates are unverified; no net edge is computed." } };
    const pairs = comparePairs(kBook, pBook, c.metadataStatus);
    const status = pairs.some(p => p.status === "live") ? "live" : pairs.some(p => p.status === "stale") ? "stale" : "unavailable";
    const observed = [c.kalshiAt, c.polyAt, k.at, p.at].filter((v): v is number => v !== null);
    return { id: opportunityId(ticker, slug), title: `${c.identity.teams.join(" vs ")} · ${c.identity.league.toUpperCase()}`,
      category: "Sports", league: c.identity.league.toUpperCase(), eventDate: c.identity.date, outcome: c.identity.outcome,
      teams: teamPresentation(c.poly, c.identity),
      status, fetchedAt: iso(Math.min(...observed)), kalshi, polymarketUS, pairs,
      match: { status: "review_required", identity: c.identity.key,
        evidence: [`Exact ${c.identity.league.toUpperCase()} league and team codes: ${c.identity.teams.join(" / ")}.`,
          `Original scheduled date agrees in both rule texts and source identifiers: ${c.identity.date}.`,
          `Kalshi YES ticker outcome and the explicit Polymarket US long side identify ${c.identity.yes}.`],
        unresolvedReasons: [
          "Identity evidence is not a reviewed settlement-equivalence determination.",
          c.identity.league === "nfl" || c.identity.league === "mlb"
            ? "Postponement windows may differ: observed US rules allow two weeks while Kalshi rules use two days/48 hours. Read these exact contracts."
            : "Postponement wording may differ: US calendar days and Kalshi 48-hour windows require contract-specific review.",
          "Cancellation, suspension, ties, official results and independently chosen fair-value payouts can break a combined $1 payout.",
          "Venue close times and expected settlement times differ and are displayed separately; scheduled start times are not assumed equivalent.",
          "Fees, slippage, funding costs and non-atomic execution remain unpriced.",
        ] } };
  }
  async function buildFeed(): Promise<OpportunityFeed> {
    const [ks, p] = await Promise.all([
      Promise.all(SERIES.map(series => read(`${KALSHI}/markets?series_ticker=${series}&status=open&limit=200&mve_filter=exclude`, v => Array.isArray(v.markets)))),
      read(`${POLY}/markets?limit=500&active=true&closed=false&marketTypes=moneyline`, v => Array.isArray(v.markets)),
    ]);
    const kalshi = ks.flatMap(s => arr(s.data?.markets).map(raw => ({ raw: obj(raw), snapshot: s })));
    const poly = arr(p.data?.markets).map(obj);
    const identities = poly.map(raw => ({ raw, identity: polyIdentity(raw) })).filter(item => item.identity && openPoly(item.raw, now()));
    const eventCounts = new Map<string, number>();
    for (const { identity } of identities) eventCounts.set(identity!.event, (eventCounts.get(identity!.event) ?? 0) + 1);
    const found: Candidate[] = [];
    let ambiguous = 0;
    for (const { raw, identity } of identities) {
      if (eventCounts.get(identity!.event)! > 1) { ambiguous += 1; continue; }
      const matches = kalshi.map(k => candidate(k.raw, raw, k.snapshot, p)).filter((v): v is Candidate => v !== null);
      // Multiple same-day games/outcomes must never be joined by a nearest string/time guess.
      if (matches.length !== 1) { if (matches.length > 1) ambiguous += 1; continue; }
      found.push(matches[0]);
    }
    found.sort((a, b) => a.identity.date.localeCompare(b.identity.date) || a.identity.key.localeCompare(b.identity.key));
    // Refresh absent/oldest US books first so a rate limit cannot starve the same tail forever.
    const selected = found.slice(0, MAX_CANDIDATES);
    const hydrationOrder = [...selected].sort((a, b) => (cache.get(`${POLY}/markets/${str(a.poly.slug)}/book`)?.at ?? 0) - (cache.get(`${POLY}/markets/${str(b.poly.slug)}/book`)?.at ?? 0));
    const hydrated = (await Promise.all(hydrationOrder.map(hydrate))).filter((value): value is Opportunity => value !== null);
    const byId = new Map(hydrated.map(value => [value.id, value]));
    const opportunities = selected.map(c => byId.get(opportunityId(str(c.kalshi.ticker), str(c.poly.slug)))).filter((value): value is Opportunity => value !== undefined);
    const venues = { kalshi: health("kalshi", ks, kalshi.length), polymarket_us: health("polymarket_us", [p], poly.length) };
    for (const [venue, host] of [["kalshi", "api.elections.kalshi.com"], ["polymarket_us", "gateway.polymarket.us"]] as const) {
      if ((sourceCooldown.get(host) ?? 0) > now()) {
        venues[venue].status = venues[venue].fetchedAt ? "stale" : "unavailable";
        venues[venue].message = "Public quote requests were rate-limited. Further requests are cooling down; missing books stay unavailable.";
      }
    }
    const status: OpportunityDataStatus = opportunities.some(o => o.status === "live") ? "live" : opportunities.some(o => o.status === "stale") ? "stale"
      : venues.kalshi.status === "live" && venues.polymarket_us.status === "live" && !opportunities.length ? "live" : "unavailable";
    const warnings = ["Settlement review required for every candidate. Gross spread is before fees and does not establish arbitrage."];
    if (poly.length >= 500 || ks.some(s => !!s.data?.cursor)) warnings.push("Discovery reached a page limit; additional markets may exist outside this scan.");
    if (found.length > MAX_CANDIDATES) warnings.push(`${found.length} identities matched; books are loaded for the first ${MAX_CANDIDATES} by scheduled date, not ranked across the full universe.`);
    const unavailable = opportunities.filter(o => o.status === "unavailable").length;
    const stale = opportunities.filter(o => o.status === "stale").length;
    if (unavailable) warnings.push(`${unavailable} candidate(s) have unavailable books or missing executable asks.`);
    if (stale) warnings.push(`${stale} candidate(s) have stale source data; their spreads are not current quotes.`);
    if (ambiguous) warnings.push(`${ambiguous} ambiguous same-day identity candidate(s) were excluded.`);
    if (Object.values(venues).some(v => v.status !== "live")) warnings.push("At least one venue discovery request failed; retained data keeps its original successful read time.");
    return { opportunities, venues, fetchedAt: iso(now()), status, warnings, scope: SCOPE };
  }
  return {
    async getOpportunities(): Promise<OpportunityFeed> {
      if (feedFlight) return feedFlight;
      feedFlight = buildFeed();
      try { return await feedFlight; } finally { feedFlight = null; }
    },
    async getOpportunity(id: string): Promise<Opportunity | null> {
      const parsed = parseOpportunityId(id);
      if (!parsed) return null;
      const [k, p] = await Promise.all([
        read(`${KALSHI}/markets/${parsed.ticker}`, v => obj(v.market).ticker === parsed.ticker),
        read(`${POLY}/market/slug/${parsed.slug}`, v => obj(v.market).slug === parsed.slug),
      ]);
      // A saved ID is revalidated against source rules and explicit sides, never trusted as a match receipt.
      const match = candidate(obj(k.data?.market), obj(p.data?.market), k, p);
      return match ? hydrate(match) : null;
    },
  };
}
export const opportunityProvider = createOpportunityProvider();
