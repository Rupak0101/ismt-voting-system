"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AdminEvent = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  voting_status?: "not_started" | "running" | "paused" | "stopped";
};

type EventForm = {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
};

function toDateTimeLocal(isoDate: string): string {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return "";
  const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
  const [formData, setFormData] = useState<EventForm>({ title: "", description: "", start_time: "", end_time: "" });
  const [editFormData, setEditFormData] = useState<EventForm>({ title: "", description: "", start_time: "", end_time: "" });

  const fetchEvents = useCallback(async () => {
    const res = await fetch('/api/events');
    if (res.ok) {
      setEvents((await res.json()) as AdminEvent[]);
      return;
    }
    setError("Failed to load events");
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchEvents();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchEvents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);
    const res = await fetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };

    setIsSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to create event");
      return;
    }

    setMessage("Event created successfully.");
    setIsCreating(false);
    setFormData({ title: "", description: "", start_time: "", end_time: "" });
    void fetchEvents();
  };

  const startEdit = (event: AdminEvent) => {
    setMessage("");
    setError("");
    setEditingEventId(event.id);
    setEditFormData({
      title: event.title,
      description: event.description ?? "",
      start_time: toDateTimeLocal(event.start_time),
      end_time: toDateTimeLocal(event.end_time),
    });
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEditFormData({ title: "", description: "", start_time: "", end_time: "" });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEventId) return;

    setMessage("");
    setError("");
    setIsSaving(true);
    const res = await fetch(`/api/events/${editingEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editFormData),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setIsSaving(false);

    if (!res.ok) {
      setError(data.error || "Failed to update event");
      return;
    }

    setMessage("Event updated successfully.");
    cancelEdit();
    void fetchEvents();
  };

  const handleDeleteEvent = async (event: AdminEvent) => {
    if (!window.confirm(`Delete event "${event.title}"? This cannot be undone.`)) return;

    setMessage("");
    setError("");
    setDeletingEventId(event.id);
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setDeletingEventId(null);

    if (!res.ok) {
      setError(data.error || "Failed to delete event");
      return;
    }

    if (editingEventId === event.id) cancelEdit();
    setMessage("Event deleted successfully.");
    void fetchEvents();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title">Manage Events</h1>
        <button className="primary" onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      {isCreating && (
        <div className="card mb-4">
          <h2 style={{ marginBottom: '1rem' }}>Create New Event</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2">
            <div style={{ gridColumn: 'span 2' }}>
              <label>Event Title</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div>
              <label>Start Time</label>
              <input type="datetime-local" required value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
            </div>
            <div>
              <label>End Time</label>
              <input type="datetime-local" required value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
            </div>
            <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
              <button type="submit" className="primary" disabled={isSaving}>Save Event</button>
            </div>
          </form>
        </div>
      )}

      {editingEventId !== null && (
        <div className="card mb-4">
          <h2 style={{ marginBottom: "1rem" }}>Edit Event</h2>
          <form onSubmit={handleUpdate} className="grid grid-cols-2">
            <div style={{ gridColumn: "span 2" }}>
              <label>Event Title</label>
              <input
                required
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label>Description</label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div>
              <label>Start Time</label>
              <input
                type="datetime-local"
                required
                value={editFormData.start_time}
                onChange={(e) => setEditFormData({ ...editFormData, start_time: e.target.value })}
              />
            </div>
            <div>
              <label>End Time</label>
              <input
                type="datetime-local"
                required
                value={editFormData.end_time}
                onChange={(e) => setEditFormData({ ...editFormData, end_time: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "span 2", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button type="button" className="secondary-cta" disabled={isSaving} onClick={cancelEdit}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={isSaving}>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2">
        {events.map(event => (
          <div className="card" key={event.id}>
            <div className="flex justify-between items-center" style={{ alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>{event.title}</h3>
              <div className="flex" style={{ gap: "0.5rem" }}>
                <button type="button" className="secondary-cta" onClick={() => startEdit(event)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(event)}
                  disabled={deletingEventId === event.id}
                  style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }}
                >
                  Delete
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>{event.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: "0.5rem", fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>Start: {new Date(event.start_time).toLocaleString()}</span>
              <span>End: {new Date(event.end_time).toLocaleString()}</span>
            </div>
            {event.voting_status && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Voting Status: {event.voting_status.replace("_", " ")}
              </div>
            )}
            <div style={{ marginTop: "0.8rem" }}>
              <Link href={`/admin/events/${event.id}`}>Open event details</Link>
            </div>
          </div>
        ))}
        {events.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No events found. Create one to get started.</p>}
      </div>
    </div>
  );
}
