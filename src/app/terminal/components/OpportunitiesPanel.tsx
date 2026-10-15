"use client";

import { useMemo, useRef, useState } from "react";
import type { Opportunity, OpportunityFeed, OpportunityMarket, OpportunityPair, OpportunityPairDirection } from "@/lib/terminal/opportunity-types";
import type { MonitorDraft } from "./SavedMonitorsPanel";
import { useTerminalData } from "./useTerminalData";
import { cents, contracts, dateTime } from "./format";
import VenueMark from "./VenueMark";
import TeamLogo, { MatchupLogos } from "./TeamLogo";
import styles from "./WorkspacePanels.module.css";

function fresh(market: OpportunityMarket, now: number) {
  const time = now || Date.now();
  return market.book.status === "live" && Boolean(market.book.fetchedAt) && [market.book.fetchedAt, market.book.exchangeTimestamp].filter((value): value is string => Boolean(value)).every((value) => Number.isFinite(Date.parse(value)) && time - Date.parse(value) <= 45_000 && Date.parse(value) <= time + 5_000);
}
function bestPair(opportunity: Opportunity) {
  return [...opportunity.pairs].sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || (b.grossSpread ?? -Infinity) - (a.grossSpread ?? -Infinity))[0];
}
function spread(value: number | null | undefined) { return value == null ? "—" : `${value > 0 ? "+" : ""}${cents(value)}`; }
function quoteAge(value: string | null, now: number) { return value && now && Number.isFinite(Date.parse(value)) ? `Received ${Math.max(0, Math.floor((now - Date.parse(value)) / 1000))}s ago` : "Read time unavailable"; }
function matchupName(opportunity: Opportunity) { return opportunity.teams?.length === 2 ? opportunity.teams.map(team => team.name).join(" vs ") : opportunity.title; }

function Contract({ market, now, failed }: { market: OpportunityMarket; now: number; failed: boolean }) {
  const current = !failed && fresh(market, now);
  return <div className={styles.contractCard}>
    <VenueMark venue={market.venue}/><h3>{market.title}</h3>
    <dl><div><dt>YES resolves to</dt><dd>{market.yesOutcome}</dd></div><div><dt>Trading closes</dt><dd>{dateTime(market.closeTime)}</dd></div><div><dt>Expected settlement</dt><dd>{dateTime(market.expectedSettlementTime)}</dd></div><div><dt>Book received</dt><dd>{dateTime(market.book.fetchedAt)} <span className={styles.quoteStatus} data-live={current}>{current ? "FRESH" : market.book.status === "unavailable" ? "UNAVAILABLE" : "DELAYED"}</span></dd></div>{market.book.exchangeTimestamp && <div><dt>Exchange timestamp</dt><dd>{dateTime(market.book.exchangeTimestamp)}</dd></div>}</dl>
    <details><summary>Resolution rules</summary><p>{market.rules || "Rules unavailable. Read the original contract before drawing conclusions."}</p><a href={market.rulesUrl} target="_blank" rel="noopener noreferrer">Original rules ↗</a></details>
    <details><summary>Fee assumptions</summary><p>{market.fee.note}</p><a href={market.fee.sourceUrl} target="_blank" rel="noopener noreferrer">Venue fee schedule ↗</a></details>
    <a className={styles.contractLink} href={market.url} target="_blank" rel="noopener noreferrer">{market.venue === "kalshi" ? "Open Kalshi contract" : "View source contract data"} ↗</a>
  </div>;
}

function PairQuote({ opportunity, pair, now, failed, onMonitor }: { opportunity: Opportunity; pair: OpportunityPair; now: number; failed: boolean; onMonitor: (draft: MonitorDraft) => void }) {
  const current = !failed && pair.status === "live" && fresh(opportunity.kalshi, now) && fresh(opportunity.polymarketUS, now);
  const yesTeam = opportunity.teams?.find(team => team.isYesOutcome);
  return <>
    <div className={styles.pairLegs}>{([{ market: opportunity.kalshi, outcome: pair.kalshiOutcome, ask: pair.kalshiAsk }, { market: opportunity.polymarketUS, outcome: pair.polymarketOutcome, ask: pair.polymarketAsk }] as const).map(({ market, outcome, ask }) => <div className={styles.pairLeg} key={market.venue}>
      <VenueMark venue={market.venue}/><div><span>BUY {outcome.toUpperCase()}</span><strong>{cents(ask)}</strong></div><p className={styles.teamOutcome}>{yesTeam && <TeamLogo team={yesTeam}/>}<span>{outcome === "yes" ? yesTeam?.name || market.yesOutcome : `Not ${yesTeam?.name || market.yesOutcome}`}</span></p><small>{contracts(market.book[outcome === "yes" ? "yesAsks" : "noAsks"][0]?.size ?? null)} at best ask</small><small className={styles.legAge}>{quoteAge(market.book.fetchedAt, now)}</small>
    </div>)}</div>
    <div className={styles.spreadSummary}><div><span>COMBINED COST</span><strong>{cents(pair.combinedPrice)}</strong></div><div><span>GROSS SPREAD</span><strong data-positive={current && (pair.grossSpread ?? 0) > 0}>{spread(pair.grossSpread)}</strong></div><div><span>NET EDGE</span><strong>Unverified</strong></div></div>
    <div className={styles.liquidityLine}><span>{contracts(pair.availableSize)} paired contracts at displayed asks</span><span className={styles.quoteStatus} data-live={current}>{current ? "FRESH QUOTES" : "QUOTES UNAVAILABLE / DELAYED"}</span></div>
    <p className={styles.spreadExplanation}>Gross spread = $1 − both asks. The $1 payout assumes complementary settlement, which has not been verified. Fees, slippage and the risk of only one leg filling are excluded.</p>
    {pair.warnings.length > 0 && <p className={styles.inlineNotice}>{pair.warnings.join(" ")}</p>}
    <button className={styles.primaryAction} onClick={() => onMonitor({ target: { kind: "opportunity", candidateId: opportunity.id, pairDirection: pair.direction }, label: `${opportunity.outcome} · ${opportunity.league} · ${opportunity.eventDate}` })}>Monitor this spread <span>◎</span></button>
  </>;
}

export default function OpportunitiesPanel({ selectedId, selectedDirection, onSelect, onMonitor, onInspectKalshi, now }: {
  selectedId: string | null; selectedDirection: OpportunityPairDirection | null;
  onSelect: (id: string, direction?: OpportunityPairDirection) => void;
  onMonitor: (draft: MonitorDraft) => void; onInspectKalshi: (ticker: string) => void; now: number;
}) {
  const feed = useTerminalData<OpportunityFeed>("/api/terminal/opportunities", 30_000);
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("All");
  const [positiveOnly, setPositiveOnly] = useState(false);
  const comparison = useRef<HTMLElement>(null);
  function openComparison(id: string) {
    onSelect(id);
    if (window.matchMedia("(max-width: 1100px)").matches) requestAnimationFrame(() => comparison.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }
  const candidates = useMemo(() => feed.data?.opportunities ?? [], [feed.data]);
  const selectedFromFeed = candidates.find((item) => item.id === selectedId);
  const detail = useTerminalData<Opportunity>(selectedId && !selectedFromFeed ? `/api/terminal/opportunities/${encodeURIComponent(selectedId)}` : null, 30_000);
  const filtered = useMemo(() => candidates.filter((item) => (league === "All" || item.league === league) && `${item.title} ${matchupName(item)} ${item.outcome} ${item.league}`.toLowerCase().includes(query.trim().toLowerCase()) && (!positiveOnly || (!feed.error && fresh(item.kalshi, now) && fresh(item.polymarketUS, now) && item.pairs.some((pair) => pair.status === "live" && (pair.grossSpread ?? 0) > 0)))), [candidates, league, query, positiveOnly, now, feed.error]);
  const selected = selectedId ? selectedFromFeed ?? detail.data : filtered[0];
  const pair = selected && (selected.pairs.find((item) => item.direction === selectedDirection) ?? bestPair(selected));
  const liveCount = candidates.filter((item) => !feed.error && fresh(item.kalshi, now) && fresh(item.polymarketUS, now)).length;

  return <section className={styles.opportunities} aria-labelledby="opportunities-title">
    <div className={styles.pageHeading}><div><span className={styles.kicker}>CROSS-VENUE RESEARCH</span><h1 id="opportunities-title">Opportunities<span>{candidates.length.toString().padStart(2, "0")}</span></h1><p>One event. Two order books. Read the difference.</p></div><div className={styles.pageHeadingRight}><span className={styles.readOnlyBadge}>SETTLEMENT REVIEW REQUIRED</span><button onClick={() => { feed.refresh(); detail.refresh(); }} disabled={feed.loading}>Refresh ↻</button></div></div>
    <div className={styles.venueHealth}>{(["kalshi", "polymarket_us"] as const).map((venue) => { const health = feed.data?.venues[venue]; const current = !feed.error && health?.status === "live" && Boolean(health.fetchedAt) && (!now || now - Date.parse(health.fetchedAt!) <= 45_000); return <div key={venue}><VenueMark venue={venue}/><span className={styles.quoteStatus} data-live={current}>{feed.loading ? "CONNECTING" : current ? "CONNECTED" : health?.status === "unavailable" || !health ? "UNAVAILABLE" : "DELAYED"}</span><small>{health?.message || "Reading public market data…"}</small></div>; })}<div className={styles.coverage}><strong>{liveCount}<span> / {candidates.length}</span></strong><small>comparisons with fresh books</small><span>30s refresh · public data</span></div></div>
    {feed.error && <p className={styles.inlineNotice} role="status">{feed.error} {feed.data ? "Showing the last received data; check each quote timestamp." : "No comparison data is available yet."}</p>}
    <div className={styles.opportunityGrid}>
      <div className={styles.candidatePanel}>
        <div className={styles.candidateTools}><input aria-label="Search comparisons" placeholder="Search event or team…" value={query} onChange={(event) => setQuery(event.target.value)}/><select aria-label="Filter comparisons by league" value={league} onChange={(event) => setLeague(event.target.value)}><option>All</option>{[...new Set(candidates.map((item) => item.league))].sort().map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className={styles.candidateSubhead}><span>{filtered.length} COMPARISONS</span><label><input type="checkbox" checked={positiveOnly} onChange={(event) => setPositiveOnly(event.target.checked)}/> Positive gross only</label></div>
        <div className={styles.candidateColumns} aria-hidden="true"><span>EVENT / OUTCOME</span><span>KALSHI YES</span><span>POLY US YES</span><span>BEST GROSS</span></div>
        <div className={styles.candidateRows}>{feed.loading ? <div className={styles.panelEmpty}><span>↔</span><h2>Reading both venues…</h2><p>Matching named outcomes and event dates, then loading their order books.</p></div> : filtered.length === 0 ? <div className={styles.panelEmpty}><span>↔</span><h2>{candidates.length ? "No comparisons match." : "No comparable contracts available."}</h2><p>{candidates.length ? "Try another search or include negative gross spreads." : "This is a bounded discovery feed. Shared contracts must pass outcome and event-date checks before appearing."}</p><button onClick={feed.refresh}>Refresh public data ↻</button></div> : filtered.map((item) => { const best = bestPair(item); const current = !feed.error && fresh(item.kalshi, now) && fresh(item.polymarketUS, now); return <button key={item.id} className={styles.candidateRow} aria-pressed={selected?.id === item.id} aria-controls="opportunity-comparison" onClick={() => openComparison(item.id)}><div><small>{item.league} <span>{item.eventDate}</span></small><span className={styles.matchupIdentity}><MatchupLogos teams={item.teams ?? []}/><strong>{matchupName(item)}</strong></span><span>{item.outcome} wins</span></div><div><strong>{cents(item.kalshi.book.yesAsks[0]?.price ?? null)}</strong><small>ASK</small></div><div><strong>{cents(item.polymarketUS.book.yesAsks[0]?.price ?? null)}</strong><small>ASK</small></div><div><strong data-positive={current && best?.status === "live" && (best.grossSpread ?? 0) > 0}>{spread(best?.grossSpread)}</strong><small>{current && best?.status === "live" ? `${contracts(best.availableSize)} PAIRED` : best?.status === "unavailable" ? "UNAVAILABLE" : "DELAYED"}</small></div><p>Terms unverified <span>Compare contracts ↗</span></p></button>; })}</div>
        <div className={styles.scopeNote}><strong>DISCOVERY SCOPE</strong><p>{feed.data?.scope || "Selected sports game-winner markets on Kalshi and Polymarket US."}</p>{feed.data?.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
      </div>
      <aside ref={comparison} id="opportunity-comparison" className={styles.comparisonPanel} aria-label="Contract comparison">
        {selected && pair ? <><div className={styles.comparisonHeading}><span className={styles.kicker}>CONTRACT COMPARISON / {selected.league}</span><div className={styles.matchupHeading}><MatchupLogos teams={selected.teams ?? []} size="large"/><h2>{matchupName(selected)}</h2></div><p>Underlying outcome: <strong>{selected.outcome}</strong></p><span className={styles.reviewBadge}>↗ Settlement review required</span></div>
          {(detail.error || feed.error) && <p className={styles.inlineNotice}>Refresh failed. Retained prices are for inspection only.</p>}
          <div className={styles.pairTabs} role="group" aria-label="Comparison pair direction">{selected.pairs.map((value) => <button key={value.direction} aria-pressed={pair.direction === value.direction} onClick={() => onSelect(selected.id, value.direction)}>Kalshi {value.kalshiOutcome.toUpperCase()} <span>+</span> Poly US {value.polymarketOutcome.toUpperCase()}</button>)}</div>
          <div className={styles.pairQuote}><PairQuote opportunity={selected} pair={pair} now={now} failed={Boolean(feed.error || detail.error)} onMonitor={onMonitor}/></div>
          <div className={styles.rulesReview}><div className={styles.sectionLabel}>MATCH EVIDENCE &amp; LIMITS</div><ul>{selected.match.evidence.map((item) => <li key={item}>{item}</li>)}</ul><div className={styles.reviewWarnings}>{selected.match.unresolvedReasons.map((item) => <p key={item}>{item}</p>)}</div></div>
          <div className={styles.contractsGrid}><Contract market={selected.kalshi} now={now} failed={Boolean(feed.error || detail.error)}/><Contract market={selected.polymarketUS} now={now} failed={Boolean(feed.error || detail.error)}/></div>
          <button className={styles.inspectButton} onClick={() => onInspectKalshi(selected.kalshi.marketId)}>Inspect Kalshi market in terminal <span>↗</span></button>
        </> : <div className={styles.panelEmpty}><span>↔</span><h2>{selectedId ? detail.loading ? "Loading this comparison…" : "Comparison unavailable." : "Read across the market."}</h2><p>{detail.error || "Select a comparison to inspect both sides, the displayed liquidity, and their settlement terms."}</p>{selectedId && !detail.loading && <button onClick={detail.refresh}>Retry comparison ↻</button>}</div>}
      </aside>
    </div>
  </section>;
}
