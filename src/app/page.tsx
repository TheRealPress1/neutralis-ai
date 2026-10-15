import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LandingNav from "./components/landing/LandingNav";
import MarketTicker from "./components/landing/MarketTicker";
import MarketTerminal from "./components/landing/MarketTerminal";
import TerminalDemo from "./components/landing/TerminalDemo";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Neutralis.ai — The Bloomberg terminal for prediction markets",
  description: "One terminal for prediction market intelligence. Compare Kalshi and Polymarket, discover arbitrage opportunities, and put your strategy into motion.",
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}</svg>;
}

function FeatureIcon({ kind }: { kind: "scan" | "edge" | "shield" }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "scan" && <><path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4M2 12h20" /><path d="m8 9 3-3 5 3v6l-5 3-3-3Z" /></>}
    {kind === "edge" && <><path d="M4 19V5m0 14h16M7 14l4-4 4 2 5-7" /><path d="M15 5h5v5" /></>}
    {kind === "shield" && <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>}
  </svg>;
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user;
  const destination = "/terminal";
  return (
    <div className={styles.landing}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <LandingNav signedIn={signedIn} />
      <MarketTicker />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroCoordinate} aria-hidden="true">INTELLIGENCE / EXECUTION / EDGE</div>
          <div className={styles.heroContent}>
            <h1 id="hero-title">The Bloomberg terminal<br className={styles.desktopBreak} /> <span>for prediction markets.</span></h1>
            <p className={styles.heroDescription}>The whole market. The price differences. The next opportunity.<br className={styles.desktopBreak} /> Your command center for Kalshi and Polymarket.</p>
            <div className={styles.heroActions}>
              <Link href={destination} className={styles.primaryButton}>{signedIn ? "Open your terminal" : "Launch terminal"}<Arrow /></Link>
              <a href="#terminal" className={styles.secondaryButton}><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 3 7 5-7 5V3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> Explore the demo</a>
            </div>
            <div className={styles.heroNotes}><span><i>✓</i> Free to get started</span><span><i>✓</i> No credit card required</span><span><i>✓</i> Your accounts. Your capital.</span></div>
          </div>
          <div className={styles.heroFooter}><span>BUILT FOR THE INFORMED TRADER</span><span>SCROLL TO EXPLORE <span>↓</span></span></div>
        </section>
        <section id="terminal" className={styles.terminalSection} aria-label="Explore the interactive prediction market terminal">
          <div className={styles.terminalOverline}><span><span className={styles.statusDot} /> YOUR NEXT OPPORTUNITY STARTS HERE</span><span>01 / THE TERMINAL</span></div>
          <MarketTerminal />
          <div className={styles.terminalCaption}><span>A feel for the real thing. Explore markets, compare prices, find the spread.</span><span>Illustrative data · No trades placed</span></div>
        </section>
        <section className={styles.venues} aria-label="Supported exchanges">
          <p>TWO EXCHANGES.<br /><span>ONE BIGGER PICTURE.</span></p>
          <div className={styles.exchangeLogos}>
            <span className={styles.kalshiLogo}>Kalshi<span>↗</span></span><span className={styles.exchangeDivider}>×</span>
            <span className={styles.polyLogo}><svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 7 20-4v24L5 23V7Zm0 0 20 10M5 23l20-10M5 15l20 2" /></svg>Polymarket</span>
          </div>
          <span className={styles.venueFootnote}>Independent intelligence.<br />Cross-platform perspective.</span>
        </section>
        <section id="features" className={styles.features} aria-labelledby="features-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.sectionKicker}>02 / BUILT FOR YOUR EDGE</p><h2 id="features-title">Less noise.<br /><span>More signal.</span></h2></div>
            <p>A fragmented market is full of possibilities.<br />Put them all in one place—and know what<br className={styles.desktopBreak} /> you’re looking at.</p>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}><FeatureIcon kind="scan" /><span>01</span></div>
              <h3>The market, in one view.</h3>
              <p>Compare matching markets across Kalshi and Polymarket. Less tab switching. More time to see what matters.</p>
              <div className={styles.comparisonVisual} aria-label="Example quote comparison">
                <div><span><i className={styles.kalshiDot} /> Kalshi</span><span>YES <strong>62¢</strong></span></div>
                <div><span><i className={styles.polyDot} /> Polymarket</span><span>YES <strong>66¢</strong></span></div>
                <div className={styles.comparisonResult}><span>SAME EVENT. DIFFERENT ODDS.</span><strong>4¢ spread <Arrow diagonal /></strong></div>
              </div>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}><FeatureIcon kind="edge" /><span>02</span></div>
              <h3>Find the gap. See the trade.</h3>
              <p>Surface cross-platform arbitrage with paired prices, fee estimates, and a clear view of the potential edge.</p>
              <div className={styles.edgeVisual} aria-label="Illustrative opportunity: 4 cents gross edge before fees">
                <span>ILLUSTRATIVE GROSS EDGE</span><strong>+4.00<span>¢</span><svg width="80" height="30" viewBox="0 0 80 30" fill="none" aria-hidden="true"><path d="M1 27 10 22 17 24 25 14 34 18 43 9 52 13 62 4 70 7 79 1" stroke="currentColor" strokeWidth="1.5" /></svg></strong>
                <div><span>62¢ YES + 34¢ NO</span><span>96¢ total cost</span></div><div className={styles.edgeBar}><span /></div>
              </div>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}><FeatureIcon kind="shield" /><span>03</span></div>
              <h3>Your strategy. Your rules.</h3>
              <p>Go from signal to execution with configurable risk controls. Set your limits and keep control of your capital.</p>
              <div className={styles.guardVisual}>
                <div><span>Position size limits</span><span><i /> CONFIGURABLE</span></div>
                <div><span>Exposure checks</span><span><i /> BUILT IN</span></div>
                <div><span>Execution mode</span><span className={styles.manualMode}>YOUR CHOICE</span></div>
              </div>
            </article>
          </div>
          <p className={styles.featureFootnote}>Price examples are illustrative. Gross spreads exclude fees and execution costs.</p>
        </section>
        <TerminalDemo />
        <section className={styles.closingCta} aria-labelledby="cta-title">
          <div className={styles.ctaDecoration} aria-hidden="true"><span /><span /><span /><span /></div>
          <p className={styles.sectionKicker}><span className={styles.statusDot} /> A BETTER VIEW STARTS HERE</p>
          <h2 id="cta-title">Stop watching the market.<br /><span>Start seeing the opportunity.</span></h2>
          <p>Your next edge could be hiding in plain sight.</p>
          <Link href={destination} className={styles.primaryButton}>{signedIn ? "Open your terminal" : "Get started for free"}<Arrow /></Link>
          <Link href="/pricing" className={styles.pricingLink}>Explore plans <Arrow diagonal /></Link>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <Link href="/" className={styles.brand} aria-label="Neutralis home">Neutralis.ai</Link>
          <p>An edge in every perspective.</p>
          <nav aria-label="Footer navigation"><Link href="/docs">Documentation</Link><Link href="/pricing">Pricing</Link><a href="mailto:neutralis.ai@gmail.com">Get in touch <Arrow diagonal /></a></nav>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Neutralis.ai</span><p>Prediction markets involve risk. An identified spread is not a guaranteed return.</p><span className={styles.footerSignature}>STAY CURIOUS. STAY AHEAD. ↗</span></div>
      </footer>
    </div>
  );
}
