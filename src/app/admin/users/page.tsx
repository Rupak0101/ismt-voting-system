"use client";
import { useCallback, useEffect, useState } from "react";

type User = {
  college_id: string;
  name: string;
  role: string;
  email: string | null;
};

type ManualUserForm = {
  name: string;
  role: string;
  email: string;
};

export default function AdminUsersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [manualForm, setManualForm] = useState<ManualUserForm>({
    name: "",
    role: "student",
    email: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users/import');
      if (res.ok) {
        setUsers((await res.json()) as User[]);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchUsers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchUsers]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setMessage(""); setError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        void fetchUsers();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); setError("");

    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setManualForm({
          name: "",
          role: "student",
          email: "",
        });
        void fetchUsers();
      } else {
        setError(data.error || "Failed to register voter");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div>
      <h1 className="page-title">Manage Students & Faculty</h1>
      <p className="page-subtitle">Register voters manually or upload CSV with name, role (student/faculty), and email. Email is required for voter verification.</p>
      
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className="card mb-4">
        <h2 style={{ marginBottom: "1rem" }}>Manual Registration</h2>
        <form onSubmit={handleManualRegister} className="grid grid-cols-2">
          <div>
            <label>Name</label>
            <input
              required
              value={manualForm.name}
              onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
            />
          </div>
          <div>
            <label>Role</label>
            <select
              required
              value={manualForm.role}
              onChange={(e) => setManualForm({ ...manualForm, role: e.target.value })}
            >
              <option value="student">student</option>
              <option value="faculty">faculty</option>
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label>Email</label>
            <input
              type="email"
              required
              value={manualForm.email}
              onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: "span 2", textAlign: "right" }}>
            <button type="submit" className="primary">Register Voter</button>
          </div>
        </form>
      </div>

      <div className="card mb-4">
        <h2 style={{ marginBottom: "1rem" }}>CSV Import</h2>
        <form onSubmit={handleUpload} className="flex gap-4 items-center">
          <input 
            type="file" 
            accept=".csv" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit" className="primary" disabled={!file}>Upload CSV</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "1rem" }}>Current Users ({users.length})</h2>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Role</th>
                <th style={{ padding: '0.5rem' }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={`${u.email ?? "unknown"}-${u.college_id}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem' }}>{u.name}</td>
                  <td style={{ padding: '0.5rem' }}>{u.role}</td>
                  <td style={{ padding: '0.5rem' }}>{u.email ?? '-'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
