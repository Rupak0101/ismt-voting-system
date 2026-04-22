"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/admin";
    if (next.startsWith("/admin/login")) return "/admin";
    return next;
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h1 className="page-title" style={{ marginBottom: "0.6rem" }}>
        Admin Login
      </h1>
      <p className="page-subtitle">Enter your admin credentials to access dashboard controls.</p>

      {error && <div className="message error">{error}</div>}

      <form onSubmit={handleSubmit} className="flex" style={{ flexDirection: "column", gap: "1rem" }}>
        <div>
          <label htmlFor="admin-username" style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
            Username
          </label>
          <input
            id="admin-username"
            required
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="admin-password" style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
            Password
          </label>
          <input
            id="admin-password"
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button type="submit" className="primary" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="card">Loading admin login...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
