import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpportunityProvider, normalizeOpportunityBook, comparePairs, polyIdentity, parseOpportunityId, opportunityId } from './opportunities.ts';

const NOW = Date.parse('2026-10-14T20:00:00Z');
const TICKER = 'KXNFLGAME-26OCT15SEADEN-SEA';
const SLUG = 'aec-nfl-sea-den-2026-10-15';
const ID = opportunityId(TICKER, SLUG);
const clone = value => structuredClone(value);
const kalshi = () => ({ ticker: TICKER, event_ticker: 'KXNFLGAME-26OCT15SEADEN', title: 'Seattle wins',
  market_type: 'binary', notional_value_dollars: '1.00', status: 'active', result: '',
  close_time: '2026-10-18T04:15:00Z', expected_expiration_time: '2026-10-16T03:15:00Z',
  rules_primary: 'If Seattle wins the Seattle vs Denver Pro Football game originally scheduled for Oct 15, 2026, then the market resolves to Yes.',
  rules_secondary: 'If not started within 48 hours, resolve to a fair price.', yes_ask_dollars: '.01', last_price_dollars: '.99' });
const poly = () => ({ slug: SLUG, question: 'Seattle Seahawks vs Denver Broncos', active: true, closed: false, archived: false,
  status: 'MARKET_STATUS_OPEN', ep3Status: 'OPEN', sportsMarketTypeV2: 'SPORTS_MARKET_TYPE_MONEYLINE',
  endDate: '2026-10-30T04:15:00Z', gameStartTime: '2026-10-16T00:15:00Z', feeCoefficient: .0695,
  description: 'This market will settle to the winner of the Seattle Seahawks vs Denver Broncos NFL game scheduled for Oct 15, 2026. Postponement window two weeks.',
  outcomes: '["No","Yes"]', outcomePrices: '["0.01","0.99"]', bestAskQuote: { value: '.01', currency: 'USD' },
  marketSides: [ { long: false, description: 'Denver', tradable: true, team: { abbreviation: 'den', league: 'nfl', name: 'Broncos', safeName: 'Denver' } },
    { long: true, description: 'Seattle', tradable: true, team: { abbreviation: 'sea', league: 'nfl', name: 'Seahawks', safeName: 'Seattle' } } ] });
const kBook = () => ({ orderbook_fp: { yes_dollars: [['0.56', '10.25'], ['0.55', '22']], no_dollars: [['0.42', '15.75'], ['0.41', '30']] } });
const pBook = () => ({ marketData: { marketSlug: SLUG, state: 'MARKET_STATE_OPEN', transactTime: new Date(NOW).toISOString(),
  bids: [{ px: { value: '0.57', currency: 'USD' }, qty: '8.50' }], offers: [{ px: { value: '0.58', currency: 'USD' }, qty: '12.25' }],
  stats: { lastTradePx: { value: '0.01', currency: 'USD' } } } });
function fixture(options = {}) {
  let clock = NOW;
  let fail = false;
  let removed = false;
  let calls = [];
  const k = options.kalshi ?? kalshi(), p = options.poly ?? poly();
  const kb = options.kBook ?? kBook(), pb = options.pBook ?? pBook();
  const fetcher = async (input, init) => {
    calls.push(input);
    assert.equal(init?.method ?? 'GET', 'GET');
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    assert.deepEqual(Object.keys(init?.headers ?? {}), ['Accept']);
    if (fail) throw new Error('offline fixture outage');
    if (removed && input.includes('/book')) return new Response('{}', { status: 404 });
    if (input.includes('/orderbook?')) return Response.json(clone(kb));
    if (input.endsWith('/book')) return Response.json(clone(pb));
    if (input.includes('/market/slug/')) return Response.json({ market: clone(p) });
    if (input.endsWith(`/markets/${TICKER}`)) return Response.json({ market: clone(k) });
    if (input.includes('gateway.polymarket.us')) return Response.json({ markets: clone(options.polyMarkets ?? [p]) });
    return Response.json({ markets: input.includes('series_ticker=KXNFLGAME') ? clone(options.kalshiMarkets ?? [k]) : [] });
  };
  const provider = createOpportunityProvider(fetcher, () => clock, { polymarketSpacingMs: 0 });
  return { provider, k, p, kb, pb, calls, tick: value => clock += value, fail: () => { fail = true; }, remove: () => { removed = true; } };
}
const snapshot = data => ({ data, at: NOW, status: 'live' });

test('exact identity uses explicit long side, both team codes and original rule date', () => {
  const identity = polyIdentity(poly());
  assert.equal(identity.yes, 'SEA');
  assert.equal(identity.date, '2026-10-15'); // UTC start falls on Oct16; not an identity date.
  assert.equal(identity.key, 'nfl:2026-10-15:DEN:SEA:SEA');
  const p = poly(); p.marketSides.reverse();
  assert.deepEqual(polyIdentity(p), identity);
});

test('futures, contradictory date, different league, invalid sides and missing tradability never match', () => {
  const mutations = [p => p.sportsMarketTypeV2 = 'SPORTS_MARKET_TYPE_FUTURE', p => p.description = p.description.replace('Oct 15', 'Oct 16'),
    p => p.marketSides[0].team.league = 'nba', p => p.marketSides[0].long = true, p => delete p.marketSides[0].tradable,
    p => p.slug = p.slug.replace('-den-', '-dal-')];
  for (const mutate of mutations) { const p = poly(); mutate(p); assert.equal(polyIdentity(p), null); }
});

test('stable IDs are reversible and cannot supply a host, path traversal or arbitrary market family', () => {
  assert.deepEqual(parseOpportunityId(ID), { ticker: TICKER, slug: SLUG });
  for (const id of ['https://evil.example', ID + '/../../account', ID.replace('KXNFLGAME', 'KXOTHER'), ID.replace('v1', 'v2'), 'x'.repeat(221)]) assert.equal(parseOpportunityId(id), null);
});

test('Kalshi resting bids become complementary asks with fractional depth', () => {
  const book = normalizeOpportunityBook('kalshi', snapshot(kBook()), TICKER, NOW);
  assert.deepEqual(book.yesAsks[0], { price: .58, size: 15.75 });
  assert.deepEqual(book.noAsks[0], { price: .44, size: 10.25 });
  assert.equal(book.exchangeTimestamp, null);
});

test('US offers are long/YES asks; bids become short/NO asks, independent of outcomes arrays', () => {
  const book = normalizeOpportunityBook('polymarket_us', snapshot(pBook()), SLUG, NOW);
  assert.deepEqual(book.yesAsks[0], { price: .58, size: 12.25 });
  assert.deepEqual(book.noAsks[0], { price: .43, size: 8.5 });
  const pairs = comparePairs(normalizeOpportunityBook('kalshi', snapshot(kBook()), TICKER, NOW), book);
  assert.equal(pairs[0].direction, 'kalshi_yes_polymarket_no');
  assert.equal(pairs[0].combinedPrice, 1.01);
  assert.equal(pairs[0].grossSpread, -.01);
  assert.equal(pairs[0].availableSize, 8.5);
  assert.equal(pairs[1].combinedPrice, 1.02);
  assert.equal(pairs[1].availableSize, 10.25);
  assert.ok(pairs.every(p => p.netEdge === null));
});

test('invalid, zero, rounded-to-zero and non-USD levels cannot create a quote', () => {
  const book = pBook();
  book.marketData.offers = [
    { px: { value: '0.01', currency: 'EUR' }, qty: '100' },
    { px: { value: '0', currency: 'USD' }, qty: '10' },
    { px: { value: '0.000000001', currency: 'USD' }, qty: '10' },
    { px: { value: '0.5', currency: 'USD' }, qty: '0.000000001' },
    { px: { value: '0.6', currency: 'USD' }, qty: 'Infinity' },
  ];
  assert.deepEqual(normalizeOpportunityBook('polymarket_us', snapshot(book), SLUG, NOW).yesAsks, []);
});

test('missing book, wrong contract, crossed book, closed book and future timestamp fail closed', () => {
  const values = [ {}, { marketData: { ...pBook().marketData, marketSlug: 'wrong' } },
    { marketData: { ...pBook().marketData, state: 'MARKET_STATE_CLOSED' } },
    { marketData: { ...pBook().marketData, transactTime: new Date(NOW + 31_000).toISOString() } },
    { marketData: { ...pBook().marketData, offers: [{ px: { value: '0.40', currency: 'USD' }, qty: '10' }] } },
  ];
  for (const value of values) assert.equal(normalizeOpportunityBook('polymarket_us', snapshot(value), SLUG, NOW).status, 'unavailable');
});

test('old exchange book time cannot be called live after a fresh HTTP read', () => {
  const pb = pBook(); pb.marketData.transactTime = new Date(NOW - 46_000).toISOString();
  const book = normalizeOpportunityBook('polymarket_us', snapshot(pb), SLUG, NOW);
  assert.equal(book.status, 'stale');
  assert.equal(book.fetchedAt, new Date(NOW).toISOString());
});

test('live feed binds both source contracts, retains rules and never computes net edge', async () => {
  const f = fixture(); const feed = await f.provider.getOpportunities();
  assert.equal(feed.status, 'live'); assert.equal(feed.opportunities.length, 1);
  const row = feed.opportunities[0];
  assert.equal(row.id, ID); assert.equal(row.kalshi.marketId, TICKER); assert.equal(row.polymarketUS.marketId, SLUG);
  assert.equal(row.match.status, 'review_required'); assert.match(row.match.unresolvedReasons.join(' '), /two weeks/);
  assert.equal(row.polymarketUS.fee.coefficient, .0695); assert.equal(row.kalshi.fee.status, 'unknown');
  assert.equal(row.pairs[0].kalshiAsk, .58); // Reject metadata/last-price .01/.99 fallbacks.
  assert.equal(row.pairs[0].polymarketAsk, .43);
  assert.ok(row.pairs.every(p => p.netEdge === null)); assert.equal(f.calls.length, 7);
});

test('feed refresh and parallel callers deduplicate within 30 seconds', async () => {
  const f = fixture();
  const [a,b] = await Promise.all([f.provider.getOpportunities(), f.provider.getOpportunities()]);
  assert.deepEqual(a,b); assert.equal(f.calls.length,7);
  f.tick(29_999); await f.provider.getOpportunities(); assert.equal(f.calls.length,7);
  f.tick(1); await f.provider.getOpportunities(); assert.equal(f.calls.length,14);
});

test('outage returns stale prices with original source timestamps and expires after two minutes', async () => {
  const f = fixture(); const original = await f.provider.getOpportunities(); f.fail(); f.tick(31_000);
  const stale = await f.provider.getOpportunities();
  assert.equal(stale.status, 'stale'); assert.equal(stale.opportunities[0].pairs[0].status, 'stale');
  assert.equal(stale.opportunities[0].fetchedAt, original.opportunities[0].fetchedAt);
  assert.equal(stale.opportunities[0].polymarketUS.book.fetchedAt, original.opportunities[0].polymarketUS.book.fetchedAt);
  assert.equal(stale.venues.kalshi.fetchedAt, original.venues.kalshi.fetchedAt);
  f.tick(90_000); const expired = await f.provider.getOpportunities();
  assert.equal(expired.status, 'unavailable'); assert.equal(expired.opportunities.length,0);
});

test('empty books never fall back to metadata or last trades', async () => {
  const f = fixture({ pBook: { marketData: { ...pBook().marketData, bids: [], offers: [] } } });
  const row = (await f.provider.getOpportunities()).opportunities[0];
  assert.equal(row.status,'unavailable'); assert.ok(row.pairs.every(p => p.combinedPrice === null && p.availableSize === null));
});

test('closed, overdue, mismatched-date and wrong payout markets are excluded', async () => {
  const mutations = [ k => k.status = 'settled', k => k.close_time = new Date(NOW - 1).toISOString(), k => k.notional_value_dollars = '10',
    k => k.rules_primary = k.rules_primary.replace('Oct 15', 'Oct 16') ];
  for (const mutate of mutations) { const k = kalshi(); mutate(k); assert.equal((await fixture({ kalshi: k }).provider.getOpportunities()).opportunities.length, 0); }
  const p = poly(); p.closed = true;
  assert.equal((await fixture({ poly: p }).provider.getOpportunities()).opportunities.length,0);
});

test('ambiguous duplicated contracts are excluded rather than chosen by text score', async () => {
  assert.equal((await fixture({ kalshiMarkets: [kalshi(),kalshi()] }).provider.getOpportunities()).opportunities.length,0);
  assert.equal((await fixture({ polyMarkets: [poly(),poly()] }).provider.getOpportunities()).opportunities.length,0);
});

test('MLB doubleheaders require rule time and source time concordance', () => {
  const p = poly(); p.slug = 'aec-mlb-tb-cle-2026-10-15';
  p.marketSides[1].team = { league: 'mlb', abbreviation: 'tb', name: 'Tampa Bay' };
  p.marketSides[0].team = { league: 'mlb', abbreviation: 'cle', name: 'Cleveland' };
  p.description = 'Game originally scheduled for Oct 15, 2026 at 6:00PM ET.';
  p.gameStartTime = '2026-10-15T17:00:00Z'; assert.equal(polyIdentity(p), null);
  p.gameStartTime = '2026-10-15T22:00:00Z'; assert.equal(polyIdentity(p).scheduledTime, '1800');
});

test('saved identity rehydrates directly with four public requests and validates source outcome', async () => {
  const f = fixture(); const row = await f.provider.getOpportunity(ID);
  assert.equal(row.id, ID); assert.equal(f.calls.length,4);
  assert.ok(f.calls.every(url => !url.includes('/account') && !url.includes('/orders')));
  const p = poly(); p.marketSides.forEach(s => s.long = !s.long);
  assert.equal(await fixture({ poly: p }).provider.getOpportunity(ID),null);
});

test('invalid saved identity makes no network calls and unavailable metadata does not invent a candidate', async () => {
  const f = fixture(); assert.equal(await f.provider.getOpportunity(ID + '/orders'),null); assert.equal(f.calls.length,0);
  f.fail(); assert.equal(await f.provider.getOpportunity(ID),null); assert.equal(f.calls.length,2);
});

test('404 book removal purges cached book instead of serving a stale market', async () => {
  const f = fixture(); assert.ok(await f.provider.getOpportunity(ID)); f.remove(); f.tick(31_000);
  assert.equal(await f.provider.getOpportunity(ID),null);
});

test('closed US book removes a candidate even if metadata still says open', async () => {
  const pb = pBook(); pb.marketData.state = 'MARKET_STATE_CLOSED';
  assert.equal((await fixture({ pBook: pb }).provider.getOpportunities()).opportunities.length,0);
});

test('one source outage returns explicit venue health and no invented fallback', async () => {
  const provider = createOpportunityProvider(async url => {
    if (url.includes('gateway')) throw new Error('offline');
    return Response.json({markets:[kalshi()]});
  },()=>NOW,{polymarketSpacingMs:0});
  const feed=await provider.getOpportunities();
  assert.equal(feed.venues.polymarket_us.status,'unavailable');
  assert.equal(feed.opportunities.length,0); assert.equal(feed.status,'unavailable');
});
