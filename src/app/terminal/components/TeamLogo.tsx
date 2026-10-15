"use client";

import Image from "next/image";
import { useState } from "react";
import type { OpportunityTeam } from "@/lib/terminal/opportunity-types";
import styles from "./TeamLogo.module.css";

export default function TeamLogo({ team, size = "small" }: { team: OpportunityTeam; size?: "small" | "large" }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const available = team.logoUrl && failedUrl !== team.logoUrl;
  return <span className={styles.logo} data-size={size} title={team.name} aria-hidden="true">
    {available ? <Image src={team.logoUrl!} alt="" width={64} height={64} unoptimized referrerPolicy="no-referrer" onError={() => setFailedUrl(team.logoUrl)}/> : <span className={styles.fallback}>{team.code}</span>}
  </span>;
}

export function MatchupLogos({ teams, size = "small" }: { teams: OpportunityTeam[]; size?: "small" | "large" }) {
  if (!teams.length) return null;
  return <span className={styles.matchup} data-size={size} aria-hidden="true">{teams.map(team => <TeamLogo key={`${team.league}:${team.code}`} team={team} size={size}/>)}</span>;
}
