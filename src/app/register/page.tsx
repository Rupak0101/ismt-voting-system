"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const DEFAULT_REGISTRATION_RETRY_AFTER_SECONDS = 60;

function parseRetryAfterSeconds(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.ceil(parsed));
}

export default function RegistrationPage() {
  const [step, setStep] = useState<"REGISTER" | "CHECK_EMAIL" | "SUCCESS">("REGISTER");
  const [email, setEmail] = useState("");
  const [isRequestingRegistration, setIsRequestingRegistration] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [isMessageError, setIsMessageError] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const queryRegistrationState = query.get("registration");
    const queryEmail = query.get("email")?.trim().toLowerCase() ?? "";
    const isAlreadyRegisteredFromLink = queryRegistrationState === "already";
    const isRegisteredFromLink = queryRegistrationState === "success" || isAlreadyRegisteredFromLink;

    setEmail(queryEmail);
    setStep(isRegisteredFromLink ? "SUCCESS" : "REGISTER");
    if (queryRegistrationState === "success") {
      setMessage("Registration confirmed. You can now vote in any event.");
      setIsMessageError(false);
      return;
    }
    if (isAlreadyRegisteredFromLink) {
      setMessage("You are already registered for this program.");
      setIsMessageError(false);
      return;
    }
    if (queryRegistrationState === "expired") {
      setMessage("Registration link expired. Please request a new confirmation link.");
      setIsMessageError(true);
      return;
    }
    if (queryRegistrationState === "missing" || queryRegistrationState === "failed") {
      setMessage("Registration confirmation link is invalid. Request a new confirmation link.");
      setIsMessageError(true);
      return;
    }
    setMessage("");
    setIsMessageError(false);
  }, []);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      setResendCooldownSeconds((currentValue) => (currentValue <= 1 ? 0 : currentValue - 1));
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [resendCooldownSeconds]);

  const requestRegistrationConfirmation = async () => {
    if (isRequestingRegistration || resendCooldownSeconds > 0) return;

    setIsRequestingRegistration(true);
    setMessage("");
    setIsMessageError(true);

    try {
      const res = await fetch("/api/register/verify", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });

      const data = (await res.json()) as {
        verification_sent?: boolean;
        already_registered?: boolean;
        retry_after_seconds?: unknown;
        error?: string;
      };
      const retryAfterSeconds = parseRetryAfterSeconds(data.retry_after_seconds);

      if (retryAfterSeconds) {
        setResendCooldownSeconds((currentValue) => Math.max(currentValue, retryAfterSeconds));
      }

      if (res.ok && data.already_registered) {
        setStep("SUCCESS");
        setMessage("You are already registered for the program. You can vote now.");
        setIsMessageError(false);
        return;
      }

      if (res.ok && data.verification_sent) {
        setStep("CHECK_EMAIL");
        setMessage("Confirmation link sent to your email. Open it to complete registration.");
        setIsMessageError(false);
        setResendCooldownSeconds(
          (currentValue) => Math.max(currentValue, retryAfterSeconds ?? DEFAULT_REGISTRATION_RETRY_AFTER_SECONDS)
        );
      } else {
        setMessage(data.error || "Registration confirmation failed");
        setIsMessageError(true);
      }
    } finally {
      setIsRequestingRegistration(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestRegistrationConfirmation();
  };

  return (
    <div className="container" style={{ maxWidth: "600px", marginTop: "10vh" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 className="page-title">Program Registration</h1>
        <p className="page-subtitle">Register once for attendance. Then you can vote in each event once.</p>
      </div>

      <div className="card" style={{ padding: "2rem" }}>
        {step === "REGISTER" && (
          <form onSubmit={handleRegister} className="flex" style={{ flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Attendance Registration</h2>
              <p style={{ color: "var(--text-muted)" }}>
                Enter your admin pre-registered email to confirm attendance and unlock voting access.
              </p>
            </div>
            {message && <div className={`message ${isMessageError ? "error" : "success"}`}>{message}</div>}
            <input
              required
              type="email"
              style={{ fontSize: "1rem", textAlign: "center", padding: "1rem" }}
              placeholder="Registered Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={isRequestingRegistration || resendCooldownSeconds > 0}
              className="primary"
              style={{
                padding: "1rem",
                fontSize: "1.125rem",
                opacity: isRequestingRegistration || resendCooldownSeconds > 0 ? 0.7 : 1,
                cursor: isRequestingRegistration || resendCooldownSeconds > 0 ? "not-allowed" : "pointer",
              }}
            >
              {isRequestingRegistration
                ? "Sending..."
                : resendCooldownSeconds > 0
                ? `Wait ${resendCooldownSeconds}s`
                : "Send Confirmation Link"}
            </button>
          </form>
        )}

        {step === "CHECK_EMAIL" && (
          <div className="flex" style={{ flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Confirm Attendance</h2>
              <p style={{ color: "var(--text-muted)" }}>
                Click the confirmation link sent to {email || "your email"} to complete registration.
              </p>
            </div>
            {message && <div className={`message ${isMessageError ? "error" : "success"}`}>{message}</div>}
            <button
              type="button"
              onClick={() => requestRegistrationConfirmation()}
              disabled={isRequestingRegistration || resendCooldownSeconds > 0}
              style={{
                padding: "0.75rem",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                background: "transparent",
                cursor: isRequestingRegistration || resendCooldownSeconds > 0 ? "not-allowed" : "pointer",
                opacity: isRequestingRegistration || resendCooldownSeconds > 0 ? 0.7 : 1,
              }}
            >
              {isRequestingRegistration
                ? "Sending..."
                : resendCooldownSeconds > 0
                ? `Resend in ${resendCooldownSeconds}s`
                : "Resend Confirmation Link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("REGISTER");
                setMessage("");
                setIsMessageError(true);
              }}
              style={{
                padding: "0.75rem",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Use a Different Email
            </button>
          </div>
        )}

        {step === "SUCCESS" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ fontSize: "1.75rem", color: "var(--success)", marginBottom: "0.5rem" }}>Registration Complete</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.2rem" }}>
              {message || "Your attendance is confirmed for the program."}
            </p>
            <Link href="/">
              <button className="primary" style={{ padding: "0.9rem 1.4rem" }}>
                Go to Events
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
