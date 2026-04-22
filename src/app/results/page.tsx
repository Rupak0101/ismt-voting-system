"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

type EventRecord = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
};

type CandidateResult = {
  id: number;
  name: string;
  image_url: string | null;
  vote_count: number;
};

type EventResults = {
  event: EventRecord;
  results: CandidateResult[];
};

const CHART_COLORS = ["#3f5efb", "#ff4aa5", "#ff9f1c", "#2ec4b6", "#9b5de5", "#f15bb5", "#00bbf9"];

function formatShare(share: number): string {
  return `${share.toFixed(1)}%`;
}

function getCandidateColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function buildDonutGradient(results: CandidateResult[], totalVotes: number): string {
  if (results.length === 0 || totalVotes <= 0) {
    return "conic-gradient(#d9e0ff 0% 100%)";
  }

  let cursor = 0;
  const segments = results.map((candidate, index) => {
    const share = (candidate.vote_count / totalVotes) * 100;
    const start = cursor;
    cursor += share;
    return `${getCandidateColor(index)} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

export default function ResultsPage() {
  const [eventResults, setEventResults] = useState<EventResults[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadResults = async () => {
      try {
        setError("");
        const eventsRes = await fetch("/api/events", { cache: "no-store" });
        if (!eventsRes.ok) throw new Error("Failed to fetch events");

        const events = (await eventsRes.json()) as EventRecord[];
        const resultPayloads = await Promise.all(
          events.map(async (event) => {
            const res = await fetch(`/api/admin/results/${event.id}`, { cache: "no-store" });
            if (!res.ok) return null;
            return (await res.json()) as EventResults;
          })
        );

        setEventResults(resultPayloads.filter((item): item is EventResults => item !== null));
      } catch {
        setError("Unable to load live results right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadResults();
    const intervalId = window.setInterval(() => {
      void loadResults();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  const overview = useMemo(() => {
    const totalEvents = eventResults.length;
    const totalVotes = eventResults.reduce(
      (sum, eventBlock) => sum + eventBlock.results.reduce((eventSum, candidate) => eventSum + candidate.vote_count, 0),
      0
    );
    const totalCandidates = eventResults.reduce((sum, eventBlock) => sum + eventBlock.results.length, 0);
    const averageVotesPerEvent = totalEvents > 0 ? totalVotes / totalEvents : 0;

    let closestRace: { title: string; marginShare: number } | null = null;
    for (const eventBlock of eventResults) {
      if (eventBlock.results.length < 2) continue;
      const totalEventVotes = eventBlock.results.reduce((sum, candidate) => sum + candidate.vote_count, 0);
      if (totalEventVotes <= 0) continue;

      const leaderVotes = eventBlock.results[0]?.vote_count ?? 0;
      const runnerUpVotes = eventBlock.results[1]?.vote_count ?? 0;
      const marginShare = ((leaderVotes - runnerUpVotes) / totalEventVotes) * 100;

      if (!closestRace || marginShare < closestRace.marginShare) {
        closestRace = { title: eventBlock.event.title, marginShare };
      }
    }

    return { totalEvents, totalVotes, totalCandidates, averageVotesPerEvent, closestRace };
  }, [eventResults]);

  return (
    <div className="container">
      <div className="results-header">
        <div>
          <h1 className="page-title">Live Results</h1>
          <p className="page-subtitle">Auto-refreshing scoreboard and analytics for all ISMT FRESTival events.</p>
        </div>
        <Link href="/">
          <button className="secondary-cta">Back to Home</button>
        </Link>
      </div>

      {isLoading && <div className="card">Loading live scores...</div>}
      {error && <div className="message error">{error}</div>}

      {!isLoading && !error && (
        <>
          <section className="results-overview-grid">
            <div className="card stat-tile">
              <div className="stat-label">Total Votes</div>
              <div className="stat-value">{overview.totalVotes}</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-label">Events Tracked</div>
              <div className="stat-value">{overview.totalEvents}</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-label">Candidates</div>
              <div className="stat-value">{overview.totalCandidates}</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-label">Closest Race</div>
              <div className="stat-value small">
                {overview.closestRace ? formatShare(overview.closestRace.marginShare) : "N/A"}
              </div>
              <div className="stat-subtext">{overview.closestRace ? overview.closestRace.title : "No comparable event yet"}</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-label">Avg Votes / Event</div>
              <div className="stat-value">{overview.averageVotesPerEvent.toFixed(1)}</div>
            </div>
          </section>

          <div className="results-grid">
            {eventResults.map((eventBlock) => {
              const totalVotes = eventBlock.results.reduce((sum, item) => sum + item.vote_count, 0);
              const leader = eventBlock.results[0] ?? null;
              const runnerUp = eventBlock.results[1] ?? null;
              const marginVotes = leader ? leader.vote_count - (runnerUp?.vote_count ?? 0) : 0;
              const leaderShare = leader && totalVotes > 0 ? (leader.vote_count / totalVotes) * 100 : 0;
              const donutStyle: CSSProperties = { background: buildDonutGradient(eventBlock.results, totalVotes) };

              return (
                <div className="card results-card" key={eventBlock.event.id}>
                  <div className="results-card-head">
                    <h2>{eventBlock.event.title}</h2>
                    <span>{totalVotes} total votes</span>
                  </div>
                  {eventBlock.event.description && <p className="results-card-description">{eventBlock.event.description}</p>}

                  <div className="results-highlight">
                    <div>
                      <span className="results-highlight-label">Leader</span>
                      <strong>{leader ? leader.name : "No leader yet"}</strong>
                    </div>
                    <div>
                      <span className="results-highlight-label">Lead</span>
                      <strong>{leader ? `${marginVotes} votes` : "0 votes"}</strong>
                    </div>
                    <div>
                      <span className="results-highlight-label">Vote Share</span>
                      <strong>{leader ? formatShare(leaderShare) : "0.0%"}</strong>
                    </div>
                  </div>

                  <div className="results-card-layout">
                    <div className="event-visuals">
                      <div className="donut-chart" style={donutStyle}>
                        <div className="donut-hole">
                          <strong>{totalVotes}</strong>
                          <span>votes</span>
                        </div>
                      </div>

                      <div className="chart-legend">
                        {eventBlock.results.slice(0, 5).map((candidate, index) => {
                          const share = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0;
                          return (
                            <div key={candidate.id} className="chart-legend-item">
                              <span className="legend-dot" style={{ backgroundColor: getCandidateColor(index) }} />
                              <span className="legend-name">{candidate.name}</span>
                              <span className="legend-value">{formatShare(share)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="candidate-results-list">
                      {eventBlock.results.length === 0 && <p style={{ color: "var(--text-muted)" }}>No candidates added yet.</p>}
                      {eventBlock.results.map((candidate, index) => {
                        const share = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0;
                        const barWidth = share > 0 ? Math.max(share, 6) : 0;
                        return (
                          <div className="candidate-result-row" key={candidate.id}>
                            <div className="candidate-result-main">
                              {candidate.image_url ? (
                                <img src={candidate.image_url} alt={candidate.name} className="candidate-avatar" />
                              ) : (
                                <div className="candidate-avatar placeholder">{candidate.name.slice(0, 1).toUpperCase()}</div>
                              )}
                              <div>
                                <span>{candidate.name}</span>
                                <div className="candidate-rank">#{index + 1} in this event</div>
                              </div>
                            </div>
                            <div className="vote-bar-meta">
                              <strong>{candidate.vote_count} votes</strong>
                              <span>{formatShare(share)}</span>
                            </div>
                            <div className="vote-bar-track">
                              <div
                                className="vote-bar-fill"
                                style={{ width: `${barWidth}%`, backgroundColor: getCandidateColor(index) }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
