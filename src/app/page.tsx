import Link from "next/link";

export default function Home() {
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
