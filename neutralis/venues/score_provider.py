"""Live score provider — polls ESPN public API for real-time sports scores.

Covers tennis (ATP/WTA), soccer (top leagues), and basketball (NBA).
All endpoints are free, no auth required.

Response structure (consistent across sports):
    events[].competitions[].competitors[] with:
        .team.shortDisplayName or .athlete.shortName
        .score (string)
        .linescores[].value (period scores)
        .homeAway ("home" | "away")
        .winner (bool)
    competitions[].status.type.name:
        STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL, STATUS_HALFTIME
"""

from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass, field

import httpx

from neutralis.config import ScoreConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"

# Status mapping from ESPN to our internal representation
_STATUS_MAP = {
    "STATUS_IN_PROGRESS": "in_progress",
    "STATUS_HALFTIME": "in_progress",
    "STATUS_FINAL": "final",
    "STATUS_SCHEDULED": "scheduled",
    "STATUS_POSTPONED": "postponed",
    "STATUS_CANCELED": "cancelled",
    "STATUS_DELAYED": "scheduled",
    "STATUS_END_PERIOD": "in_progress",
}


@dataclass
class LiveScore:
    """Live score for a single match/game."""
    sport: str                         # "tennis" | "soccer" | "basketball"
    status: str                        # "in_progress" | "scheduled" | "final" | etc.
    home_name: str                     # Short display name
    away_name: str
    home_score: int                    # Sets (tennis) | Goals (soccer) | Points (NBA)
    away_score: int
    detail_scores: list[list[int]]     # Per-period: [[6,4],[7,5]] for tennis sets
    period: int                        # Current set/half/quarter (0 if not started)
    clock: str                         # Display clock ("67'" for soccer, "Q4 2:30" for NBA)
    home_win_probability: float        # Model-estimated (0.0-1.0)
    away_win_probability: float
    source_id: str                     # ESPN event/competition ID
    updated_at: float = field(default_factory=time.monotonic)


class ScoreProvider:
    """Polls ESPN public API for live scores across tennis, soccer, basketball."""

    def __init__(self, config: ScoreConfig | None = None) -> None:
        self._cfg = config or ScoreConfig()
        self._http = httpx.Client(
            timeout=httpx.Timeout(connect=5.0, read=self._cfg.timeout_sec, write=5.0, pool=5.0),
            headers={"Accept": "application/json"},
        )

    def fetch_all_live_scores(self) -> list[LiveScore]:
        """Fetch live scores across all configured sports/leagues."""
        scores: list[LiveScore] = []
        scores.extend(self._fetch_tennis())
        scores.extend(self._fetch_soccer())
        scores.extend(self._fetch_basketball())
        return scores

    def _fetch_tennis(self) -> list[LiveScore]:
        """Fetch tennis scores from ATP and WTA scoreboard endpoints."""
        results: list[LiveScore] = []
        for league in self._cfg.tennis_leagues:
            url = f"{_ESPN_BASE}/tennis/{league}/scoreboard"
            data = self._get(url)
            if not data:
                continue
            for event in data.get("events", []):
                for grouping in event.get("groupings", []):
                    for comp in grouping.get("competitions", []):
                        score = self._parse_tennis_match(comp)
                        if score:
                            results.append(score)
        return results

    def _fetch_soccer(self) -> list[LiveScore]:
        """Fetch soccer scores from configured league scoreboard endpoints."""
        results: list[LiveScore] = []
        for league in self._cfg.soccer_leagues:
            url = f"{_ESPN_BASE}/soccer/{league}/scoreboard"
            data = self._get(url)
            if not data:
                continue
            for event in data.get("events", []):
                for comp in event.get("competitions", []):
                    score = self._parse_soccer_match(comp)
                    if score:
                        results.append(score)
        return results

    def _fetch_basketball(self) -> list[LiveScore]:
        """Fetch basketball scores from configured league scoreboard endpoints."""
        results: list[LiveScore] = []
        for league in self._cfg.basketball_leagues:
            url = f"{_ESPN_BASE}/basketball/{league}/scoreboard"
            data = self._get(url)
            if not data:
                continue
            for event in data.get("events", []):
                for comp in event.get("competitions", []):
                    score = self._parse_basketball_match(comp)
                    if score:
                        results.append(score)
        return results

    # ── Parsers ────────────────────────────────────────────────────────

    def _parse_tennis_match(self, comp: dict) -> LiveScore | None:
        """Parse an ESPN tennis competition into a LiveScore."""
        competitors = comp.get("competitors", [])
        if len(competitors) < 2:
            return None

        status_obj = comp.get("status", {})
        status_type = status_obj.get("type", {}).get("name", "")
        status = _STATUS_MAP.get(status_type, "unknown")

        # Extract player names and set scores
        players = []
        for c in competitors:
            athlete = c.get("athlete", {})
            name = athlete.get("shortName") or athlete.get("displayName") or "?"
            linescores = [int(ls.get("value", 0)) for ls in c.get("linescores", [])]
            sets_won = sum(1 for ls in c.get("linescores", []) if ls.get("winner", False))
            players.append({
                "name": name,
                "sets_won": sets_won,
                "linescores": linescores,
                "winner": c.get("winner", False),
                "home_away": c.get("homeAway", ""),
            })

        if len(players) < 2:
            return None

        p1, p2 = players[0], players[1]
        period = status_obj.get("period", 0)

        # Build detail scores: list of [p1_games, p2_games] per set
        detail = []
        max_sets = max(len(p1["linescores"]), len(p2["linescores"]))
        for i in range(max_sets):
            g1 = p1["linescores"][i] if i < len(p1["linescores"]) else 0
            g2 = p2["linescores"][i] if i < len(p2["linescores"]) else 0
            detail.append([g1, g2])

        # Score summary from notes if available
        clock = status_obj.get("type", {}).get("shortDetail", "")

        h_prob, a_prob = _tennis_win_probability(
            p1["sets_won"], p2["sets_won"], detail, period,
        )

        return LiveScore(
            sport="tennis",
            status=status,
            home_name=p1["name"],
            away_name=p2["name"],
            home_score=p1["sets_won"],
            away_score=p2["sets_won"],
            detail_scores=detail,
            period=period,
            clock=clock,
            home_win_probability=h_prob,
            away_win_probability=a_prob,
            source_id=str(comp.get("id", "")),
        )

    def _parse_soccer_match(self, comp: dict) -> LiveScore | None:
        """Parse an ESPN soccer competition into a LiveScore."""
        competitors = comp.get("competitors", [])
        if len(competitors) < 2:
            return None

        status_obj = comp.get("status", {})
        status_type = status_obj.get("type", {}).get("name", "")
        status = _STATUS_MAP.get(status_type, "unknown")

        home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
        away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

        home_name = home.get("team", {}).get("shortDisplayName", "?")
        away_name = away.get("team", {}).get("shortDisplayName", "?")
        home_score = int(home.get("score", 0) or 0)
        away_score = int(away.get("score", 0) or 0)

        clock = status_obj.get("displayClock", "0'")
        # Parse minute from clock string (e.g., "67'" or "45+2'")
        minute = _parse_soccer_minute(clock)
        period = status_obj.get("period", 0)

        h_prob, a_prob = _soccer_win_probability(home_score, away_score, minute)

        return LiveScore(
            sport="soccer",
            status=status,
            home_name=home_name,
            away_name=away_name,
            home_score=home_score,
            away_score=away_score,
            detail_scores=[],
            period=period,
            clock=clock,
            home_win_probability=h_prob,
            away_win_probability=a_prob,
            source_id=str(comp.get("id", "")),
        )

    def _parse_basketball_match(self, comp: dict) -> LiveScore | None:
        """Parse an ESPN basketball competition into a LiveScore."""
        competitors = comp.get("competitors", [])
        if len(competitors) < 2:
            return None

        status_obj = comp.get("status", {})
        status_type = status_obj.get("type", {}).get("name", "")
        status = _STATUS_MAP.get(status_type, "unknown")

        home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
        away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

        home_name = home.get("team", {}).get("shortDisplayName", "?")
        away_name = away.get("team", {}).get("shortDisplayName", "?")
        home_score = int(home.get("score", 0) or 0)
        away_score = int(away.get("score", 0) or 0)

        period = status_obj.get("period", 0)
        clock_str = status_obj.get("displayClock", "0.0")
        clock_sec = _parse_nba_clock(clock_str)

        h_prob, a_prob = _basketball_win_probability(
            home_score, away_score, period, clock_sec,
        )

        return LiveScore(
            sport="basketball",
            status=status,
            home_name=home_name,
            away_name=away_name,
            home_score=home_score,
            away_score=away_score,
            detail_scores=[],
            period=period,
            clock=f"Q{period} {clock_str}",
            home_win_probability=h_prob,
            away_win_probability=a_prob,
            source_id=str(comp.get("id", "")),
        )

    # ── HTTP ───────────────────────────────────────────────────────────

    def _get(self, url: str) -> dict | None:
        """GET with error suppression (non-critical data source)."""
        try:
            resp = self._http.get(url)
            if resp.status_code == 200:
                return resp.json()
            logger.debug("ESPN %s returned %d", url, resp.status_code)
        except Exception:
            logger.debug("ESPN fetch failed: %s", url, exc_info=True)
        return None

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> ScoreProvider:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


# ── Probability Models ─────────────────────────────────────────────────

def _tennis_win_probability(
    home_sets: int, away_sets: int,
    detail_scores: list[list[int]], period: int,
) -> tuple[float, float]:
    """Estimate win probability from tennis score state.

    Best-of-3 sets. Leading 2-0 → 100%. Leading 1-0 + ahead in games → 75-90%.
    """
    # Match already won
    if home_sets >= 2:
        return 1.0, 0.0
    if away_sets >= 2:
        return 0.0, 1.0

    base = 0.50
    # Set lead bonus
    set_diff = home_sets - away_sets
    base += set_diff * 0.20  # ±20% per set lead

    # Current set game advantage
    if detail_scores and period > 0:
        current_idx = min(period - 1, len(detail_scores) - 1)
        if current_idx < len(detail_scores):
            games = detail_scores[current_idx]
            if len(games) >= 2:
                game_diff = games[0] - games[1]
                # Normalize: 5-3 lead → +0.10, 6-3 → +0.15
                base += game_diff * 0.05

    return max(0.02, min(0.98, base)), max(0.02, min(0.98, 1.0 - base))


def _soccer_win_probability(
    home_goals: int, away_goals: int, minute: int,
) -> tuple[float, float]:
    """Estimate win probability from soccer score + match minute.

    Simple model: base 50%, goal diff shifts ±15%, time progression amplifies.
    Leading by 2+ after 70' → very high confidence.
    """
    goal_diff = home_goals - away_goals
    time_factor = min(minute / 90.0, 1.0)

    # Base: 50% + goal advantage scaled by time remaining
    # More time remaining = less certain the lead holds
    goal_impact = goal_diff * 0.15 * (1.0 + time_factor)

    # Home advantage baseline
    base = 0.52 + goal_impact

    # Late-game amplification (minute 75+ with a lead)
    if minute >= 75 and abs(goal_diff) >= 1:
        late_boost = (minute - 75) / 15.0 * 0.10 * (1 if goal_diff > 0 else -1)
        base += late_boost

    # Multi-goal lead is very hard to overcome
    if abs(goal_diff) >= 2:
        base += 0.10 * (1 if goal_diff > 0 else -1)

    home_p = max(0.02, min(0.98, base))
    return home_p, max(0.02, min(0.98, 1.0 - home_p))


def _basketball_win_probability(
    home_score: int, away_score: int,
    period: int, clock_sec: float,
) -> tuple[float, float]:
    """Estimate win probability from NBA score + game state.

    Uses a logistic model based on point differential and remaining time.
    """
    if period == 0:
        return 0.52, 0.48  # Home advantage only

    diff = home_score - away_score

    # Total seconds remaining (4 quarters × 12 min = 2880 sec)
    if period <= 4:
        remaining = (4 - period) * 720 + clock_sec
    else:
        remaining = clock_sec  # Overtime

    # Avoid division by zero
    remaining = max(remaining, 1.0)

    # Logistic model: P(home wins) = sigmoid(k * diff / sqrt(remaining))
    # k calibrated so that +10 pts with 5 min left ≈ 90%
    k = 0.20
    z = k * diff / math.sqrt(remaining)
    home_p = 1.0 / (1.0 + math.exp(-z))

    # Home court bump
    home_p = home_p * 0.97 + 0.03  # Slight home advantage floor

    home_p = max(0.02, min(0.98, home_p))
    return home_p, max(0.02, min(0.98, 1.0 - home_p))


# ── Utility ────────────────────────────────────────────────────────────

def _parse_soccer_minute(clock: str) -> int:
    """Parse soccer clock string like "67'" or "45+2'" to integer minutes."""
    m = re.match(r"(\d+)", clock)
    return int(m.group(1)) if m else 0


def _parse_nba_clock(clock_str: str) -> float:
    """Parse NBA clock string like "5:30" or "0.0" to seconds."""
    if ":" in clock_str:
        parts = clock_str.split(":")
        return float(parts[0]) * 60 + float(parts[1])
    try:
        return float(clock_str)
    except ValueError:
        return 0.0
