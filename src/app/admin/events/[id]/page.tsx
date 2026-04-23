"use client";

import { use, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";

type CandidateResult = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  vote_count: number;
};

type EventPayload = {
  event: {
    id: number;
    title: string;
    description: string | null;
    voting_status: "not_started" | "running" | "paused" | "stopped";
  };
  candidates: CandidateResult[];
};

type NewCandidate = {
  name: string;
  description: string;
  image_url: string;
};

type Candidate = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
};

const CHART_COLORS = ["#3f5efb", "#ff4aa5", "#ff9f1c", "#2ec4b6", "#9b5de5", "#f15bb5", "#00bbf9"];

function formatShare(share: number): string {
  return `${share.toFixed(1)}%`;
}

function getCandidateColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function buildDonutGradient(results: CandidateResult[], totalVotes: number): string {
  if (results.length === 0 || totalVotes <= 0) return "conic-gradient(#d9e0ff 0% 100%)";

  let cursor = 0;
  const segments = results.map((candidate, index) => {
    const share = (candidate.vote_count / totalVotes) * 100;
    const start = cursor;
    cursor += share;
    return `${getCandidateColor(index)} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function formatVotingStatus(status: EventPayload["event"]["voting_status"]): string {
  if (status === "running") return "Running";
  if (status === "paused") return "Paused";
  if (status === "stopped") return "Stopped";
  return "Not Started";
}

export default function AdminEventDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const eventId = params.id;

  const [eventData, setEventData] = useState<EventPayload | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voteQrCodeDataUrl, setVoteQrCodeDataUrl] = useState("");
  const [newCandidate, setNewCandidate] = useState<NewCandidate>({ name: "", description: "", image_url: "" });
  const [candidateImagePreview, setCandidateImagePreview] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [editingCandidateId, setEditingCandidateId] = useState<number | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<number | null>(null);
  const [editCandidateForm, setEditCandidateForm] = useState<NewCandidate>({ name: "", description: "", image_url: "" });
  const [editCandidateImagePreview, setEditCandidateImagePreview] = useState("");
  const candidateImageInputRef = useRef<HTMLInputElement | null>(null);
  const editCandidateImageInputRef = useRef<HTMLInputElement | null>(null);

  const fetchEventDetails = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (res.ok) setEventData((await res.json()) as EventPayload);
  }, [eventId]);

  const fetchResults = useCallback(async () => {
    const res = await fetch(`/api/admin/results/${eventId}`);
    if (res.ok) {
      const data = (await res.json()) as { results: CandidateResult[] };
      setResults(data.results);
    }
  }, [eventId]);

  const fetchCandidates = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/candidates`);
    if (res.ok) {
      setCandidates((await res.json()) as Candidate[]);
    }
  }, [eventId]);

  const generateVotingQR = useCallback(async () => {
    const voteUrl = `${window.location.origin}/vote/${eventId}`;
    try {
      const voteQr = await QRCode.toDataURL(voteUrl, { width: 220, color: { dark: "#0b0f19", light: "#f8fafc" } });
      setVoteQrCodeDataUrl(voteQr);
    } catch (err) {
      console.error(err);
    }
  }, [eventId]);

  useEffect(() => {
    const initialLoadTimeout = window.setTimeout(() => {
      void fetchEventDetails();
      void fetchResults();
      void fetchCandidates();
      void generateVotingQR();
    }, 0);

    const intervalId = window.setInterval(() => {
      void fetchResults();
      void fetchEventDetails();
    }, 15000);

    return () => {
      window.clearTimeout(initialLoadTimeout);
      window.clearInterval(intervalId);
    };
  }, [fetchEventDetails, fetchResults, fetchCandidates, generateVotingQR]);

  const updateVotingStatus = async (action: "start" | "pause" | "unpause" | "stop") => {
    if (isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    setStatusMessage("");
    try {
      const res = await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string; voting_status?: EventPayload["event"]["voting_status"] };

      if (!res.ok) {
        setStatusMessage(data.error || "Failed to update voting status.");
        return;
      }

      setStatusMessage(`Voting status updated to ${formatVotingStatus(data.voting_status ?? "not_started")}.`);
      void fetchEventDetails();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const startEditCandidate = (candidate: Candidate) => {
    setEditingCandidateId(candidate.id);
    setEditCandidateForm({
      name: candidate.name,
      description: candidate.description ?? "",
      image_url: candidate.image_url ?? "",
    });
    setEditCandidateImagePreview(candidate.image_url ?? "");
  };

  const cancelEditCandidate = () => {
    setEditingCandidateId(null);
    setEditCandidateForm({ name: "", description: "", image_url: "" });
    setEditCandidateImagePreview("");
    if (editCandidateImageInputRef.current) editCandidateImageInputRef.current.value = "";
  };

  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidateId) return;

    const res = await fetch(`/api/events/${eventId}/candidates?candidate_id=${editingCandidateId}`, {
      method: "PATCH",
      body: JSON.stringify(editCandidateForm),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      cancelEditCandidate();
      void fetchCandidates();
      void fetchEventDetails();
      void fetchResults();
    }
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    if (!window.confirm(`Delete candidate "${candidate.name}"? This cannot be undone.`)) return;

    setDeletingCandidateId(candidate.id);
    const res = await fetch(`/api/events/${eventId}/candidates?candidate_id=${candidate.id}`, {
      method: "DELETE",
    });
    setDeletingCandidateId(null);

    if (res.ok) {
      void fetchCandidates();
      void fetchEventDetails();
      void fetchResults();
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/events/${eventId}/candidates`, {
      method: "POST",
      body: JSON.stringify(newCandidate),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      setNewCandidate({ name: "", description: "", image_url: "" });
      setCandidateImagePreview("");
      if (candidateImageInputRef.current) candidateImageInputRef.current.value = "";
      void fetchCandidates();
      void fetchEventDetails();
      void fetchResults();
    }
  };

  const handleCandidateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCandidateImagePreview("");
      setNewCandidate((current) => ({ ...current, image_url: "" }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setCandidateImagePreview(result);
      setNewCandidate((current) => ({ ...current, image_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditCandidateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setEditCandidateImagePreview("");
      setEditCandidateForm((current) => ({ ...current, image_url: "" }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setEditCandidateImagePreview(result);
      setEditCandidateForm((current) => ({ ...current, image_url: result }));
    };
    reader.readAsDataURL(file);
  };

  if (!eventData) return <div>Loading...</div>;

  const totalVotes = results.reduce((sum, candidate) => sum + candidate.vote_count, 0);
  const leader = results[0] ?? null;
  const runnerUp = results[1] ?? null;
  const marginVotes = leader ? leader.vote_count - (runnerUp?.vote_count ?? 0) : 0;
  const leaderShare = leader && totalVotes > 0 ? (leader.vote_count / totalVotes) * 100 : 0;
  const donutStyle: CSSProperties = { background: buildDonutGradient(results, totalVotes) };
  const votingPageUrl = typeof window !== "undefined" ? `${window.location.origin}/vote/${eventId}` : `/vote/${eventId}`;
  const votingStatus = eventData.event.voting_status ?? "not_started";

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">{eventData.event.title}</h1>
          <p className="page-subtitle">{eventData.event.description}</p>
          <div style={{ marginTop: "0.4rem", fontWeight: 700 }}>
            Voting Status:{" "}
            <span style={{ color: votingStatus === "running" ? "var(--success)" : votingStatus === "paused" ? "#b45309" : "var(--danger)" }}>
              {formatVotingStatus(votingStatus)}
            </span>
          </div>
          {statusMessage && (
            <div style={{ marginTop: "0.5rem", color: statusMessage.toLowerCase().includes("failed") ? "var(--danger)" : "var(--success)" }}>
              {statusMessage}
            </div>
          )}
        </div>
        <div
          className="card"
          style={{ width: "360px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <div style={{ textAlign: "center" }}>
            <h3 style={{ marginBottom: "0.5rem", fontSize: "1.05rem" }}>Voting QR</h3>
            {voteQrCodeDataUrl && (
              <img
                src={voteQrCodeDataUrl}
                alt="Voting QR Code"
                style={{ borderRadius: "8px", border: "2px solid var(--primary)" }}
              />
            )}
            <div style={{ fontSize: "0.875rem", marginTop: "0.5rem", color: "var(--primary)" }}>Scan to Vote</div>
            <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
              {votingPageUrl}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.55rem", display: "grid", gap: "0.45rem" }}>
            <button
              type="button"
              className={votingStatus === "not_started" ? "primary" : "secondary-cta"}
              disabled={isUpdatingStatus || votingStatus !== "not_started"}
              onClick={() => updateVotingStatus("start")}
            >
              Start Voting
            </button>
            <button
              type="button"
              className={votingStatus === "running" ? "primary" : "secondary-cta"}
              disabled={isUpdatingStatus || votingStatus !== "running"}
              onClick={() => updateVotingStatus("pause")}
            >
              Pause Voting
            </button>
            <button
              type="button"
              className={votingStatus === "paused" ? "primary" : "secondary-cta"}
              disabled={isUpdatingStatus || votingStatus !== "paused"}
              onClick={() => updateVotingStatus("unpause")}
            >
              Unpause Voting
            </button>
            <button
              type="button"
              className={votingStatus === "stopped" ? "primary" : "secondary-cta"}
              disabled={isUpdatingStatus || votingStatus === "stopped"}
              onClick={() => updateVotingStatus("stop")}
            >
              Stop Voting
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="card results-card">
          <div className="results-card-head">
            <h2>Live Results & Analytics</h2>
            <span>{totalVotes} total votes</span>
          </div>

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

          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1.5rem", alignItems: "start" }}>
            <div className="event-visuals" style={{ textAlign: "center" }}>
              <div className="donut-chart" style={donutStyle}>
                <div className="donut-hole">
                  <strong>{totalVotes}</strong>
                  <span>votes</span>
                </div>
              </div>
            </div>

            <div>
              {results.length === 0 ? (
                <p className="text-muted">No candidates or votes yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  {results.map((candidate, index) => {
                    const share = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0;

                    return (
                      <div
                        key={candidate.id}
                        style={{
                          padding: "1rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-color)",
                          background: "rgba(255,255,255,0.3)",
                          textAlign: "center",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: getCandidateColor(index) }}>
                          #{index + 1}
                        </div>
                        {candidate.image_url ? (
                          <img
                            src={candidate.image_url}
                            alt={candidate.name}
                            style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              margin: "0 auto",
                              border: `3px solid ${getCandidateColor(index)}`,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "50%",
                              margin: "0 auto",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "2rem",
                              fontWeight: 700,
                              background: getCandidateColor(index),
                              color: "white",
                              border: `3px solid ${getCandidateColor(index)}`,
                            }}
                          >
                            {candidate.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                            {candidate.name}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {candidate.vote_count} votes
                          </div>
                        </div>
                        <div
                          style={{
                            height: "6px",
                            borderRadius: "3px",
                            background: "rgba(0,0,0,0.1)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${share > 0 ? share : 0}%`,
                              background: getCandidateColor(index),
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: getCandidateColor(index) }}>
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

        <div className="card">
          <h2 style={{ marginBottom: "1rem" }}>Manage Candidates</h2>
          {candidates.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No candidates yet. Add one below.</p>
          ) : (
            <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "1rem" }}>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      background: "rgba(255,255,255,0.5)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{candidate.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {candidate.description || "No description"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="secondary-cta"
                        onClick={() => startEditCandidate(candidate)}
                        disabled={editingCandidateId !== null || deletingCandidateId !== null}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCandidate(candidate)}
                        disabled={deletingCandidateId === candidate.id || editingCandidateId !== null}
                        style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingCandidateId !== null && (
            <div style={{ padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.3)", marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>Edit Candidate</h3>
              <form onSubmit={handleUpdateCandidate} className="flex" style={{ flexDirection: "column", gap: "0.75rem" }}>
                <input
                  required
                  placeholder="Candidate Name"
                  value={editCandidateForm.name}
                  onChange={(e) => setEditCandidateForm({ ...editCandidateForm, name: e.target.value })}
                />
                <textarea
                  placeholder="Description"
                  value={editCandidateForm.description}
                  onChange={(e) => setEditCandidateForm({ ...editCandidateForm, description: e.target.value })}
                />
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Candidate Image (optional)</label>
                  <input ref={editCandidateImageInputRef} type="file" accept="image/*" onChange={handleEditCandidateImageUpload} />
                </div>
                {editCandidateImagePreview && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "10px",
                      border: "1px solid var(--border-color)",
                      background: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <img
                      src={editCandidateImagePreview}
                      alt="Candidate preview"
                      style={{ width: "52px", height: "52px", borderRadius: "999px", objectFit: "cover" }}
                    />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Updated image</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" className="secondary-cta" onClick={cancelEditCandidate}>
                    Cancel
                  </button>
                  <button type="submit" className="primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: "1rem" }}>Add Candidate</h2>
          <form onSubmit={handleAddCandidate} className="flex" style={{ flexDirection: "column", gap: "1rem" }}>
            <input
              required
              placeholder="Candidate Name"
              value={newCandidate.name}
              onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
            />
            <textarea
              placeholder="Description"
              value={newCandidate.description}
              onChange={(e) => setNewCandidate({ ...newCandidate, description: e.target.value })}
            />
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Candidate Image (optional)</label>
              <input ref={candidateImageInputRef} type="file" accept="image/*" onChange={handleCandidateImageUpload} />
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                Upload an image file to show candidate photo in voting and results.
              </p>
            </div>
            {candidateImagePreview && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "10px",
                  border: "1px solid var(--border-color)",
                  background: "rgba(255,255,255,0.45)",
                }}
              >
                <img
                  src={candidateImagePreview}
                  alt="Candidate preview"
                  style={{ width: "52px", height: "52px", borderRadius: "999px", objectFit: "cover" }}
                />
                <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Image ready for upload</span>
              </div>
            )}
            <button type="submit" className="primary">
              Add Candidate
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
