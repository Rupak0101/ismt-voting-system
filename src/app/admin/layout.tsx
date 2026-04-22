"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  if (isLoginPage) {
    return (
      <main className="container" style={{ maxWidth: "560px", marginTop: "8vh" }}>
        {children}
      </main>
    );
  }

  return (
    <div className="container" style={{ display: "flex", gap: "2rem" }}>
      <aside style={{ width: "260px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>Admin Menu</h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.2rem" }}>
            <li>
              <Link href="/admin">Dashboard</Link>
            </li>
            <li>
              <Link href="/admin/users">Manage Students/Faculty</Link>
            </li>
            <li>
              <Link href="/admin/events">Manage Events</Link>
            </li>
            <li>
              <Link href="/admin/registrations">Program Registrations</Link>
            </li>
          </ul>
          <button type="button" className="secondary-cta" onClick={handleLogout} disabled={isLoggingOut} style={{ width: "100%" }}>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
