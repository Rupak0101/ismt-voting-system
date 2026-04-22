"use client";
import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";

type Candidate = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
};

type EventData = {
  event: {
    title: string;
    description: string | null;
  };
  candidates: Candidate[];
};

export default function VotePage(props: { params: Promise<{ event_id: string }> }) {
  const params = use(props.params);
  const eventId = params.event_id;
  const searchParams = useSearchParams();
  const queryVerificationState = searchParams.get("verification");
  const queryVerificationToken = searchParams.get("verification_token");
  const queryEmail = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const isVerifiedFromEmailLink = Boolean(queryVerificationState === "success" && queryVerificationToken);
  const isAlreadyVotedFromEmailLink = queryVerificationState === "already_voted" || queryVerificationState === "already_used";

  const [step, setStep] = useState<"VERIFY" | "VOTE" | "SUCCESS" | "ERROR">(
    isVerifiedFromEmailLink ? "VOTE" : isAlreadyVotedFromEmailLink ? "ERROR" : "VERIFY"
  );
  const [email, setEmail] = useState(queryEmail);
  const [verificationToken, setVerificationToken] = useState(isVerifiedFromEmailLink ? queryVerificationToken! : "");
  const [message, setMessage] = useState(() => {
    if (isVerifiedFromEmailLink) {
      return "Email confirmed. You can vote now.";
    }
    if (queryVerificationState === "expired") {
      return "Verification link expired. Please request a new link.";
    }
    if (queryVerificationState === "not_registered") {
      return "Complete program registration first, then return here to vote.";
    }
    if (isAlreadyVotedFromEmailLink) {
      return "You have already voted in this event.";
    }
    if (queryVerificationState === "missing" || queryVerificationState === "failed") {
      return "Email confirmation link is invalid. Request a new verification link.";
    }
    return "";
  });
  const [isMessageError, setIsMessageError] = useState(!isVerifiedFromEmailLink);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  useEffect(() => {
    const loadEventData = async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (res.ok) setEventData(await res.json());
    };

    void loadEventData();
  }, [eventId]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCheckingEligibility) return;

    setIsCheckingEligibility(true);
    setMessage("");
    setIsMessageError(true);

    try {
      const res = await fetch(`/api/vote/${eventId}/verify`, {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        verified?: boolean;
        verification_token?: string;
        user?: { name?: string };
        code?: string;
        error?: string;
      };

      if (res.ok && data.verified && data.verification_token) {
        setVerificationToken(data.verification_token);
        setStep("VOTE");
        setMessage(
          data.user?.name
            ? `Registration verified for ${data.user.name}. You can vote now.`
            : "Registration verified. You can vote now."
        );
        setIsMessageError(false);
        return;
      }

      if (data.code === "ALREADY_VOTED") {
        setStep("ERROR");
      }
      setMessage(data.error || "Voting eligibility check failed");
      setIsMessageError(true);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedCandidate || !verificationToken) return;

    setMessage("");
    const res = await fetch(`/api/vote/${eventId}/submit`, {
      method: "POST",
      body: JSON.stringify({
        candidate_id: selectedCandidate,
        verification_token: verificationToken
      }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();

    if (res.ok) {
      setStep("SUCCESS");
      setMessage("");
    } else {
      if (data.code === "VERIFICATION_EXPIRED" || data.code === "NOT_VERIFIED" || data.code === "VERIFICATION_USED") {
        setStep("VERIFY");
        setVerificationToken("");
        setIsMessageError(true);
      } else {
        setStep("ERROR");
      }
      setMessage(data.error || "Failed to submit vote");
    }
  };

  if (!eventData) return <div className="container" style={{ textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: "600px", marginTop: "10vh" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 className="page-title">{eventData.event.title}</h1>
        <p className="page-subtitle">{eventData.event.description}</p>
      </div>

      <div className="card" style={{ padding: "2rem" }}>
        {step === "VERIFY" && (
          <form onSubmit={handleVerify} className="flex" style={{ flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Registration Check</h2>
              <p style={{ color: "var(--text-muted)" }}>
                Enter your email used for event registration. Only confirmed attendees can vote.
              </p>
            </div>
            {message && <div className={`message ${isMessageError ? "error" : "success"}`}>{message}</div>}
            <input
              required
              type="email"
              style={{ fontSize: "1rem", textAlign: "center", padding: "1rem" }}
              placeholder="Registered Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={isCheckingEligibility}
              className="primary"
              style={{
                padding: "1rem",
                fontSize: "1.125rem",
                opacity: isCheckingEligibility ? 0.7 : 1,
                cursor: isCheckingEligibility ? "not-allowed" : "pointer"
              }}
            >
              {isCheckingEligibility ? "Checking..." : "Continue to Vote"}
            </button>
          </form>
        )}

        {step === "VOTE" && (
          <div className="flex" style={{ flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Cast Your Vote</h2>
              <p style={{ color: "var(--text-muted)" }}>Select one candidate carefully. Your choice is final.</p>
            </div>
            {message && <div className={`message ${isMessageError ? "error" : "success"}`}>{message}</div>}
            
            <div className="grid grid-cols-1" style={{ gap: "1rem" }}>
              {eventData.candidates.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedCandidate(c.id)}
                  style={{ 
                    padding: "1.5rem", 
                    borderRadius: "12px", 
                    cursor: "pointer",
                    border: `2px solid ${selectedCandidate === c.id ? "var(--primary)" : "var(--border-color)"}`,
                    background: selectedCandidate === c.id ? "rgba(0, 35, 102, 0.05)" : "var(--surface-color)",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} style={{ width: "50px", height: "50px", borderRadius: "999px", objectFit: "cover", border: "2px solid rgba(0,0,0,0.1)" }} />
                    ) : (
                      <div style={{ width: "50px", height: "50px", borderRadius: "999px", display: "grid", placeItems: "center", background: "rgba(72, 88, 201, 0.12)", fontWeight: 800 }}>
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{c.name}</div>
                      {c.description && <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{c.description}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleSubmitVote} 
              disabled={!selectedCandidate}
              className="primary" 
              style={{ padding: "1rem", fontSize: "1.125rem", marginTop: "1rem" }}
            >
              Submit Final Vote
            </button>
          </div>
        )}

        {step === "SUCCESS" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ fontSize: "1.75rem", color: "var(--success)", marginBottom: "0.5rem" }}>Vote Recorded</h2>
            <p style={{ color: "var(--text-muted)" }}>Thank you for voting. Your response has been securely logged.</p>
          </div>
        )}

        {step === "ERROR" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>❌</div>
            <h2 style={{ fontSize: "1.75rem", color: "var(--danger)", marginBottom: "0.5rem" }}>Access Denied</h2>
            <p style={{ color: "var(--text-muted)" }}>{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
