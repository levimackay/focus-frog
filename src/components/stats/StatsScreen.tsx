import { useEffect, useState } from "react";
import { stats as statsApi } from "../../ipc/commands";
import type { SessionSummary, StatsRange, StatsSummary } from "../../ipc/types";
import { buildSummaryLine } from "./summary";
import { formatMinutes } from "../../lib/time";
import Button from "../common/Button";
import "./StatsScreen.css";

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export interface StatsScreenProps {
  onBack: () => void;
}

export default function StatsScreen({ onBack }: StatsScreenProps) {
  const [range, setRange] = useState<StatsRange>("week");
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [recent, setRecent] = useState<SessionSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([statsApi.getStats(range), statsApi.getRecentSessions(8)])
      .then(([s, r]) => {
        if (cancelled) return;
        setSummary(s);
        setRecent(r);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="stats-screen">
      <header className="stats-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <h1>Frog Report</h1>
        <div className="stats-range-tabs" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              className={range === r.id ? "range-tab range-tab--active" : "range-tab"}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p role="alert" className="stats-error">
          Couldn't load stats: {error}
        </p>
      )}

      {loading || !summary ? (
        <div className="stats-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton stat-tile-skeleton" />
          ))}
        </div>
      ) : (
        <>
          <p className="stats-summary-line">{buildSummaryLine(summary)}</p>
          <div className="stats-grid">
            <StatTile label="Sessions" value={summary.sessions_count} />
            <StatTile label="Focused time" value={formatMinutes(summary.focused_seconds)} />
            <StatTile label="Distractions defeated" value={summary.distractions_defeated} />
            <StatTile label="Completions" value={summary.completions} />
            <StatTile label="Current streak" value={`${summary.current_streak_days}d`} />
            <StatTile label="Longest streak" value={`${summary.longest_streak_days}d`} />
          </div>
        </>
      )}

      <section aria-labelledby="recent-heading" className="recent-sessions">
        <h2 id="recent-heading">Recent sessions</h2>
        {loading || !recent ? (
          <div className="skeleton recent-list-skeleton" />
        ) : recent.length === 0 ? (
          <p className="stats-empty">Nothing logged yet.</p>
        ) : (
          <ul>
            {recent.map((s) => (
              <li key={s.id} className={`recent-item recent-item--${s.status}`}>
                <span className="recent-goal">{s.goal}</span>
                <span className="recent-meta">
                  {s.status} · {formatMinutes(s.planned_duration_secs)} · {s.distraction_count}{" "}
                  distractions
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-label">{label}</span>
    </div>
  );
}
