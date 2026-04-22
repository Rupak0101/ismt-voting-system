"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AdminEvent = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', start_time: '', end_time: '' });

  const fetchEvents = useCallback(async () => {
    const res = await fetch('/api/events');
    if (res.ok) {
      setEvents((await res.json()) as AdminEvent[]);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchEvents();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchEvents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      setIsCreating(false);
      setFormData({ title: '', description: '', start_time: '', end_time: '' });
      void fetchEvents();
    } else {
      alert("Failed to create event");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title">Manage Events</h1>
        <button className="primary" onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? "Cancel" : "+ New Event"}
        </button>
      </div>

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
              <button type="submit" className="primary">Save Event</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2">
        {events.map(event => (
          <Link href={`/admin/events/${event.id}`} key={event.id}>
            <div className="card" style={{ cursor: 'pointer' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>{event.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>{event.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Start: {new Date(event.start_time).toLocaleString()}</span>
                <span>End: {new Date(event.end_time).toLocaleString()}</span>
              </div>
            </div>
          </Link>
        ))}
        {events.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No events found. Create one to get started.</p>}
      </div>
    </div>
  );
}
