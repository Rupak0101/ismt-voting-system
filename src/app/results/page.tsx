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
  description: string | null;
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
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", padding: "1rem", overflow: "hidden", backgroundColor: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>Live Results</h1>
        <Link href="/">
          <button className="secondary-cta" style={{ fontSize: "0.9rem", padding: "0.4rem 0.8rem" }}>Back</button>
        </Link>
      </div>

      {isLoading && <div className="card">Loading...</div>}
      {error && <div className="message error">{error}</div>}

      {!isLoading && !error && (
        <>
          {/* Overview Stats - 5 tiles in one row, compact */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.4rem", marginBottom: "0.5rem" }}>
            <div style={{ background: "rgba(63, 94, 251, 0.1)", border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.15rem" }}>Total Votes</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{overview.totalVotes}</div>
            </div>
            <div style={{ background: "rgba(255, 74, 165, 0.1)", border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.15rem" }}>Events</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{overview.totalEvents}</div>
            </div>
            <div style={{ background: "rgba(255, 159, 28, 0.1)", border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.15rem" }}>Candidates</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{overview.totalCandidates}</div>
            </div>
            <div style={{ background: "rgba(46, 196, 182, 0.1)", border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.15rem" }}>Closest</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{overview.closestRace ? formatShare(overview.closestRace.marginShare) : "N/A"}</div>
            </div>
            <div style={{ background: "rgba(155, 93, 229, 0.1)", border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.15rem" }}>Avg/Event</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{overview.averageVotesPerEvent.toFixed(1)}</div>
            </div>
          </div>

          {/* Event Results - each event in one row with all analytics */}
          <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
            {eventResults.map((eventBlock) => {
              const totalVotes = eventBlock.results.reduce((sum, item) => sum + item.vote_count, 0);
              const leader = totalVotes > 0 ? (eventBlock.results[0] ?? null) : null;
              const runnerUp = totalVotes > 0 ? (eventBlock.results[1] ?? null) : null;
              const marginVotes = leader ? leader.vote_count - (runnerUp?.vote_count ?? 0) : 0;
              const leaderShare = leader && totalVotes > 0 ? (leader.vote_count / totalVotes) * 100 : 0;
              const donutStyle: CSSProperties = { background: buildDonutGradient(eventBlock.results, totalVotes) };

              return (
                <div key={eventBlock.event.id} style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "0.6rem", background: "rgba(255,255,255,0.5)" }}>
                  {/* Event Title + Description + Stats Header */}
                  <div style={{ marginBottom: "0.4rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "0.75rem", alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ margin: "0", fontSize: "1.05rem", fontWeight: 700 }}>{eventBlock.event.title}</h3>
                        {eventBlock.event.description && (
                          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {eventBlock.event.description}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Leader</div>
                        <strong style={{ fontSize: "0.9rem" }}>{leader ? leader.name : "—"}</strong>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Lead</div>
                        <strong style={{ fontSize: "0.9rem" }}>{leader ? `${marginVotes}` : "—"}</strong>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Share</div>
                        <strong style={{ fontSize: "0.9rem" }}>{leader ? formatShare(leaderShare) : "—"}</strong>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Votes</div>
                        <strong style={{ fontSize: "0.9rem" }}>{totalVotes}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Candidates Grid + Chart */}
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.6rem" }}>
                    {/* Donut Chart and Legend */}
                    <div style={{ textAlign: "center" }}>
                      <div className="donut-chart" style={{ ...donutStyle, width: "110px", height: "110px", margin: "0 auto" }}>
                        <div className="donut-hole" style={{ fontSize: "0.75rem" }}>
                          <strong>{totalVotes}</strong>
                          <span>votes</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.65rem", marginTop: "0.3rem", maxHeight: "140px", overflowY: "auto" }}>
                        {totalVotes === 0 ? (
                          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", padding: "0.5rem" }}>
                            No votes yet
                          </div>
                        ) : (
                          eventBlock.results
                            .filter((candidate) => candidate.vote_count > 0)
                            .map((candidate, index) => {
                              const share = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0;
                              return (
                                <div key={candidate.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "center", lineHeight: "1.3" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: getCandidateColor(index), flexShrink: 0 }} />
                                  <span style={{ fontSize: "0.6rem" }}>#{index + 1} {candidate.name.slice(0, 8)}: {formatShare(share)}</span>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>

                    {/* Candidates as compact cards */}
                    <div>
                      {eventBlock.results.length === 0 ? (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>No candidates.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(eventBlock.results.length, 8)}, 1fr)`, gap: "0.4rem" }}>
                          {eventBlock.results.map((candidate, index) => {
                            const share = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0;

                            return (
                              <div
                                key={candidate.id}
                                style={{
                                  padding: "0.4rem",
                                  borderRadius: "6px",
                                  border: `1px solid ${getCandidateColor(index)}33`,
                                  background: `${getCandidateColor(index)}11`,
                                  textAlign: "center",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.25rem",
                                }}
                              >
                                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: getCandidateColor(index) }}>
                                  {totalVotes > 0 ? `#${index + 1}` : "—"}
                                </div>
                                {candidate.image_url ? (
                                  <img
                                    src={candidate.image_url}
                                    alt={candidate.name}
                                    style={{
                                      width: "45px",
                                      height: "45px",
                                      borderRadius: "50%",
                                      objectFit: "cover",
                                      margin: "0 auto",
                                      border: `2px solid ${getCandidateColor(index)}`,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "45px",
                                      height: "45px",
                                      borderRadius: "50%",
                                      margin: "0 auto",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "1.1rem",
                                      fontWeight: 700,
                                      background: getCandidateColor(index),
                                      color: "white",
                                      border: `2px solid ${getCandidateColor(index)}`,
                                    }}
                                  >
                                    {candidate.name.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <div style={{ lineHeight: "1.1" }}>
                                  <div style={{ fontWeight: 600, fontSize: "0.65rem", marginBottom: "0.1rem", wordBreak: "break-word" }}>
                                    {candidate.name}
                                  </div>
                                  {candidate.description && (
                                    <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", marginBottom: "0.1rem", wordBreak: "break-word" }}>
                                      {candidate.description}
                                    </div>
                                  )}
                                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{candidate.vote_count}</div>
                                </div>
                                <div style={{ height: "3px", borderRadius: "1px", background: "rgba(0,0,0,0.1)", overflow: "hidden" }}>
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${share > 0 ? share : 0}%`,
                                      background: getCandidateColor(index),
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: "0.6rem", fontWeight: 600, color: getCandidateColor(index) }}>
                                  {formatShare(share)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
