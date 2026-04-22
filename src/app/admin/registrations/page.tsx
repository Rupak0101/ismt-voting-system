"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

type ProgramRegistration = {
  id: number;
  email: string;
  status: "pending" | "confirmed";
  created_at: string;
  confirmed_at: string | null;
  user: {
    college_id: string;
    name: string;
    role: string | null;
    email: string | null;
  };
};

type RegistrationPayload = {
  total: number;
  confirmed: number;
  pending: number;
  registrations: ProgramRegistration[];
};

export default function AdminRegistrationsPage() {
  const [data, setData] = useState<RegistrationPayload>({
    total: 0,
    confirmed: 0,
    pending: 0,
    registrations: [],
  });
  const [error, setError] = useState("");
  const [registrationQrCodeDataUrl, setRegistrationQrCodeDataUrl] = useState("");

  const fetchRegistrations = useCallback(async () => {
    setError("");
    const res = await fetch("/api/admin/registrations", { cache: "no-store" });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Failed to load registrations");
      return;
    }
    setData((await res.json()) as RegistrationPayload);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchRegistrations();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchRegistrations]);

  useEffect(() => {
    const generateRegistrationQr = async () => {
      const registrationUrl = `${window.location.origin}/register`;
      try {
        const qr = await QRCode.toDataURL(registrationUrl, {
          width: 220,
          color: { dark: "#0b0f19", light: "#f8fafc" },
        });
        setRegistrationQrCodeDataUrl(qr);
      } catch (err) {
        console.error(err);
      }
    };
    void generateRegistrationQr();
  }, []);

  const registrationPageUrl = typeof window !== "undefined" ? `${window.location.origin}/register` : "/register";

  return (
    <div>
      <h1 className="page-title">Program Registration Records</h1>
      <p className="page-subtitle">All attendees who registered for the program (one-time registration).</p>

      {error && <div className="message error">{error}</div>}

      <div className="card mb-4">
        <div className="grid grid-cols-2" style={{ alignItems: "center" }}>
          <div>
            <h2 style={{ marginBottom: "0.5rem" }}>Program Registration QR</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "0.8rem" }}>
              Use this one QR for attendance registration. There is no separate registration QR per event.
            </p>
            <ol style={{ paddingLeft: "1.1rem", color: "var(--text-muted)" }}>
              <li>Pre-registered user scans QR.</li>
              <li>Enters registered email and receives confirmation mail.</li>
              <li>Clicks confirmation link once.</li>
              <li>Then can vote in each event once from event voting QR.</li>
            </ol>
            <div style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
              {registrationPageUrl}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            {registrationQrCodeDataUrl && (
              <img
                src={registrationQrCodeDataUrl}
                alt="Program registration QR"
                style={{ borderRadius: "8px", border: "2px solid var(--primary)" }}
              />
            )}
            <div style={{ marginTop: "0.5rem", color: "var(--primary)", fontWeight: 700 }}>Scan to Register</div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
          <span style={{ padding: "0.35rem 0.65rem", borderRadius: "999px", border: "1px solid var(--border-color)" }}>
            Total: {data.total}
          </span>
          <span
            style={{
              padding: "0.35rem 0.65rem",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            Confirmed: {data.confirmed}
          </span>
          <span
            style={{
              padding: "0.35rem 0.65rem",
              borderRadius: "999px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            Pending: {data.pending}
          </span>
        </div>
      </div>

      <div className="card">
        <div style={{ maxHeight: "460px", overflowY: "auto" }}>
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>Role</th>
                <th style={{ padding: "0.5rem" }}>Email</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Confirmed At</th>
                <th style={{ padding: "0.5rem" }}>Requested At</th>
              </tr>
            </thead>
            <tbody>
              {data.registrations.map((registration) => (
                <tr key={registration.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.5rem" }}>{registration.user.name}</td>
                  <td style={{ padding: "0.5rem" }}>{registration.user.role ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{registration.email}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.55rem",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        background:
                          registration.status === "confirmed"
                            ? "rgba(16, 185, 129, 0.12)"
                            : "rgba(245, 158, 11, 0.12)",
                        border:
                          registration.status === "confirmed"
                            ? "1px solid rgba(16, 185, 129, 0.35)"
                            : "1px solid rgba(245, 158, 11, 0.35)",
                      }}
                    >
                      {registration.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {registration.confirmed_at ? new Date(registration.confirmed_at).toLocaleString() : "-"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{new Date(registration.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {data.registrations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No registration records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
