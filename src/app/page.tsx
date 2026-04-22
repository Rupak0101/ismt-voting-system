"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type EventItem = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
};

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (res.ok) {
          setEvents((await res.json()) as EventItem[]);
        }
      } finally {
        setIsLoadingEvents(false);
      }
    };

    void loadEvents();
  }, []);

  return (
    <div className="container home-page">
      <section className="hero-card">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker">ISMT FRESTival 2026</div>
            <h1 className="page-title">Celebrate Creativity. Vote with Confidence.</h1>
            <p className="page-subtitle">
              Official ISMT College voting platform for event contests. Fast, transparent, and secure real-time tallying for every competition.
            </p>
            <div className="festival-badges">
              <span>🎤 Live Performance</span>
              <span>🎶 Dance | Music</span>
              <span>⭐ Talent Show</span>
              <span>🚶 Ramp Walk</span>
              <span>🍽️ Food & Drinks</span>
            </div>
            <div className="hero-actions">
              <Link href="/results">
                <button className="primary">View Live Results</button>
              </Link>
              <Link href="/admin">
                <button className="secondary-cta">Admin Login</button>
              </Link>
            </div>
          </div>
          <div className="hero-poster-wrap">
            <img src="/frestivalismt.jpg" alt="ISMT FRESTival Theme Poster" className="hero-poster" />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>Program Registration & Event Voting</h2>
        <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
          Register once for attendance, confirm your email, then vote once in each event.
        </p>

        <div className="card mb-4" style={{ borderRadius: "12px" }}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "1.15rem" }}>Step 1: Register Once</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "0.8rem" }}>
            Complete one-time program registration before voting in any event.
          </p>
          <Link href="/register">
            <button className="primary">Program Registration</button>
          </Link>
        </div>

        {isLoadingEvents && <p style={{ color: "var(--text-muted)" }}>Loading events...</p>}

        {!isLoadingEvents && (
          <div className="grid grid-cols-2">
            {events.map((event) => (
              <div className="card" key={event.id} style={{ borderRadius: "12px" }}>
                <h3 style={{ marginBottom: "0.4rem", fontSize: "1.2rem" }}>{event.title}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.8rem" }}>
                  {event.description || "No description available."}
                </p>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.9rem" }}>
                  <div>Start: {new Date(event.start_time).toLocaleString()}</div>
                  <div>End: {new Date(event.end_time).toLocaleString()}</div>
                </div>
                <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                  <Link href={`/vote/${event.id}`}>
                    <button className="secondary-cta">Vote in this Event</button>
                  </Link>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>No events are available right now.</p>
            )}
          </div>
        )}
      </section>

      <section className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">🔒</div>
          <h3>One Person, One Vote</h3>
          <p>Vote once per event.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Live Scoreboard</h3>
          <p>Every vote updates results instantly, so event leaders can track progress in real time.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📱</div>
          <h3>Mobile Friendly</h3>
          <p>Scan the QR, verify your email, and cast your vote from your phone in seconds.</p>
        </div>
      </section>

      <section className="event-meta-strip">
        <div className="meta-card">
          <strong>📅 April 24, 2026</strong>
          <span>10 AM onwards</span>
        </div>
        <div className="meta-card">
          <strong>📍 Hotel Swagatam</strong>
          <span>Biratnagar</span>
        </div>
      </section>
    </div>
  );
}
