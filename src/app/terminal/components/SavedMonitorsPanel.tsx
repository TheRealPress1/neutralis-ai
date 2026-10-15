"use client";

import Link from "next/link";
import { useState } from "react";
import type { MonitorTarget, PersistentMonitor } from "@/lib/terminal/persistent-monitor-types";
import type { SavedMonitorController } from "./useSavedMonitors";
import { cents, dateTime } from "./format";
import styles from "./WorkspacePanels.module.css";

export interface MonitorDraft { target: MonitorTarget; label: string }

function targetLabel(target: MonitorTarget) {
  return target.kind === "market" ? "Kalshi · YES last trade" : target.pairDirection === "kalshi_yes_polymarket_no" ? "Kalshi YES + Polymarket US NO · gross spread" : "Kalshi NO + Polymarket US YES · gross spread";
}

export default function SavedMonitorsPanel({ signedIn, draft, controller, onOpenTarget, onBrowse }: {
  signedIn: boolean;
  draft: MonitorDraft | null;
  controller: SavedMonitorController;
  onOpenTarget: (target: MonitorTarget) => void;
  onBrowse: () => void;
}) {
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState(draft?.target.kind === "opportunity" ? "2" : "50");
  const [saved, setSaved] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const { data, error, loading, pending, mutationError } = controller;
  const health = data?.workerHealth;
  const monitors = data?.monitors ?? [];
  const alerts = data?.alerts ?? [];
  const value = threshold.trim() === "" ? NaN : Number(threshold) / 100;
  const pair = draft?.target.kind === "opportunity";
  const valid = Number.isFinite(value) && (pair ? value > -1 && value < 1 : value > 0 && value < 1);
  const available = signedIn && Boolean(health?.configured) && !error && !loading && !controller.createUncertain;
  const watching = monitors.filter((monitor) => monitor.state === "watching").length;
  const returnParams = new URLSearchParams({ view: "monitors" });
  if (draft) {
    returnParams.set("monitorLabel", draft.label);
    if (draft.target.kind === "market") returnParams.set("monitorMarket", draft.target.ticker);
    else { returnParams.set("monitorPair", draft.target.candidateId); returnParams.set("monitorDirection", draft.target.pairDirection); }
  }
  const signInUrl = `/login?redirect=${encodeURIComponent(`/terminal?${returnParams.toString()}`)}`;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !valid || !available || pending) return;
    setSaved(null);
    const result = await controller.create({ target: draft.target, direction, threshold: value, label: draft.label });
    if (result) setSaved(result.monitor.label);
  }

  async function remove(monitor: PersistentMonitor) {
    if (await controller.remove(monitor)) setRemoveId(null);
  }

  return <section className={styles.savedMonitors} aria-labelledby="saved-monitors-title">
    <div className={styles.pageHeading}>
      <div><span className={styles.kicker}>YOUR OBSERVATION DESK</span><h1 id="saved-monitors-title">Monitors</h1><p>Save a condition. Keep the evidence when it happens.</p></div>
      <span className={styles.readOnlyBadge}>OBSERVE ONLY</span>
    </div>
    <div className={styles.workerBanner} data-state={health?.status ?? "not_configured"} role="status">
      <span className={styles.healthDot} />
      <div><strong>{!signedIn ? "Your monitors, across sessions" : loading ? "Checking monitoring service…" : error ? "Monitoring service unavailable" : health?.status === "healthy" ? "Background checks are active" : health?.status === "degraded" ? "Some checks need attention" : health?.status === "stale" ? "Background checks are delayed" : health?.status === "never_run" ? "Waiting for the first background check" : "Background monitoring is not configured"}</strong>
        <p>{!signedIn ? "Sign in to save server-side monitors and view their alert history." : error || health?.message || "The monitoring service must be connected before a saved monitor can run."}</p>
      </div>
      {signedIn && <button onClick={controller.refresh} disabled={loading || Boolean(pending)} aria-label="Refresh saved monitors">Refresh ↻</button>}
      {health?.lastCompletedAt && <span className={styles.workerTime}>Last run {dateTime(health.lastCompletedAt)}</span>}
    </div>

    <div className={styles.savedMonitorGrid}>
      <form className={styles.monitorComposer} onSubmit={create}>
        <div className={styles.sectionLabel}>NEW MONITOR <span>01</span></div>
        <label htmlFor="saved-monitor-target">Watching</label>
        <div className={styles.targetBox} id="saved-monitor-target">
          {draft ? <><small>{targetLabel(draft.target)}</small><strong>{draft.label}</strong>{pair && <span>Fixed pair direction · before fees · settlement unverified</span>}</> : <><strong>Select a market or a comparison</strong><span>Open a market to watch its price, or a comparison to watch its spread.</span></>}
          <button type="button" onClick={onBrowse}>{draft ? "Choose another comparison" : "Browse opportunities"} ↗</button>
        </div>
        <label htmlFor="saved-monitor-direction">Record an alert when {pair ? "gross spread" : "YES last trade"} is</label>
        <div className={styles.conditionInputs}>
          <select id="saved-monitor-direction" value={direction} onChange={(event) => { setDirection(event.target.value as "above" | "below"); setSaved(null); }}>
            <option value="above">At or above</option><option value="below">At or below</option>
          </select>
          <div><input aria-label="Saved monitor threshold in cents" type="number" min={pair ? "-99.99" : "0.01"} max="99.99" step="0.01" value={threshold} onChange={(event) => { setThreshold(event.target.value); setSaved(null); }} required /><span>¢</span></div>
        </div>
        <p className={styles.composerExplanation}>{pair ? "Watches the selected two-leg gross spread using fresh quotes. An alert does not establish equivalent settlement or a net profit." : "Watches the most recent traded YES price on Kalshi. The last trade is an observation, not an available execution price."}</p>
        {signedIn ? <button className={styles.primaryAction} disabled={!available || !draft || !valid || Boolean(pending) || monitors.length >= 25}>{pending === "create" ? "Saving…" : "Save monitor"}<span>＋</span></button> : <Link className={styles.primaryAction} href={signInUrl}>Sign in to save a monitor <span>↗</span></Link>}
        {saved && <p className={styles.formSuccess} role="status">Saved: {saved}. The worker will check this condition on its next run.</p>}
        {mutationError && <p className={styles.formError} role="alert">{mutationError}</p>}
        <div className={styles.monitorPromise}><span>01</span><p>Saved to your account. Checks continue without an open browser when the worker is active.</p></div>
        <div className={styles.monitorPromise}><span>02</span><p>One alert per trigger. Rearm explicitly to watch again. Alerts appear in this workspace.</p></div>
        <div className={styles.monitorPromise}><span>03</span><p>Monitors never place orders or access exchange credentials.</p></div>
      </form>

      <div className={styles.savedMonitorList}>
        <div className={styles.listToolbar}>
          <div role="group" aria-label="Monitor activity view"><button aria-pressed={!showAlerts} onClick={() => setShowAlerts(false)}>Saved monitors <small>{data ? monitors.length : "—"}</small></button><button aria-pressed={showAlerts} onClick={() => setShowAlerts(true)}>Alert history <small>{data ? alerts.length : "—"}</small></button></div>
          <span>{data ? watching + " watching" : "ACCOUNT PRIVATE"}</span>
        </div>
        {error && data && <p className={styles.inlineNotice} role="status">Showing the last loaded records. Refresh failed; current status is unverified.</p>}
        {!signedIn || loading || !data ? <div className={styles.panelEmpty}><span>◎</span><h2>{!signedIn ? "A watchlist that keeps watching." : loading ? "Loading your monitors…" : "Your saved monitors could not be loaded."}</h2><p>{!signedIn ? "Monitor a market price or comparison spread, then return to a timestamped record of each trigger." : loading ? "Reading your private monitors and alert history." : "No empty result is assumed. Try refreshing when the service is available."}</p></div> : showAlerts ? alerts.length === 0 ? <div className={styles.panelEmpty}><span>↗</span><h2>No alerts yet.</h2><p>A fresh observation that meets a saved condition will appear here.</p></div> : <div className={styles.alertHistory}>{alerts.map((alert) => <article key={alert.id} className={styles.alertCard}>
          <span className={styles.alertGlyph}>↗</span><div><span className={styles.kicker}>CONDITION OBSERVED</span><button className={styles.targetLink} onClick={() => onOpenTarget(alert.target)}>{alert.label}</button><p>{targetLabel(alert.target)} · {cents(alert.observedValue)} {alert.direction === "above" ? "≥" : "≤"} {cents(alert.threshold)}</p><small>Source observed {dateTime(alert.observedAt)} · Recorded {dateTime(alert.createdAt)}</small><p className={styles.alertDisclaimer}>{alert.disclaimer}</p></div>
        </article>)}</div> : monitors.length === 0 ? <div className={styles.panelEmpty}><span>◎</span><h2>Set your first condition.</h2><p>Your saved market and spread monitors will appear here, with each observation and its original timestamp.</p></div> : monitors.map((monitor) => <article key={monitor.id} className={styles.savedMonitorCard}>
          <div className={styles.savedMonitorTop}><span className={styles.stateBadge} data-state={monitor.state}>{monitor.state === "watching" && health?.status !== "healthy" ? "Watching · check service status" : monitor.state}</span><small>{targetLabel(monitor.target)}</small></div>
          <button className={styles.targetLink} onClick={() => onOpenTarget(monitor.target)}>{monitor.label}</button>
          <div className={styles.conditionReadout}><span>{monitor.target.kind === "market" ? "YES" : "GROSS SPREAD"}</span><strong>{monitor.direction === "above" ? "≥" : "≤"} {cents(monitor.threshold)}</strong><div><span>LAST OBSERVED</span><b>{cents(monitor.lastValue)}</b></div></div>
          <div className={styles.observationLine}><span>{monitor.lastObservedAt ? dateTime(monitor.lastObservedAt) : "No successful observation yet"}</span><span>{monitor.state === "triggered" ? "Triggered " + dateTime(monitor.triggeredAt) : monitor.lastCheckStatus === "unavailable" || monitor.lastCheckStatus === "closed" ? monitor.lastError || "Fresh data unavailable" : monitor.lastCheckedAt ? "Checked " + dateTime(monitor.lastCheckedAt) : "Waiting for a check"}</span></div>
          <div className={styles.cardActions}>{removeId === monitor.id ? <><span>Remove this monitor and its alert history?</span><button onClick={() => remove(monitor)} disabled={Boolean(pending)}>Remove</button><button onClick={() => setRemoveId(null)} disabled={Boolean(pending)}>Keep</button></> : <><button onClick={() => controller.update(monitor, monitor.state === "watching" ? "pause" : monitor.state === "triggered" ? "rearm" : "resume")} disabled={Boolean(pending)}>{pending === monitor.id ? "Updating…" : monitor.state === "watching" ? "Pause" : monitor.state === "triggered" ? "Rearm" : "Resume"}</button><button onClick={() => setRemoveId(monitor.id)} disabled={Boolean(pending)}>Remove</button><span>Saved {dateTime(monitor.createdAt)}</span></>}</div>
        </article>)}
      </div>
    </div>
  </section>;
}
