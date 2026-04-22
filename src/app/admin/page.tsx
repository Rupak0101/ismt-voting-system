import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">Welcome to the ISMT College Voting Control Center</p>
      
      <div className="grid grid-cols-2">
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Users Database</h2>
          <p style={{ color: 'var(--text-muted)' }}>Upload and manage the student and faculty list securely.</p>
          <Link href="/admin/users" style={{ display: 'inline-block', marginTop: '1rem', color: 'var(--primary)' }}>Go to Users &rarr;</Link>
        </div>
        
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Voting Events</h2>
          <p style={{ color: 'var(--text-muted)' }}>Create events, add candidates, and view QR codes.</p>
          <Link href="/admin/events" style={{ display: 'inline-block', marginTop: '1rem', color: 'var(--primary)' }}>Go to Events &rarr;</Link>
        </div>
      </div>
    </div>
  );
}
