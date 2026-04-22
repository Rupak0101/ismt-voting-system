import type { Metadata } from "next";
import { Mulish, Oswald } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ISMT College : British Degree in Nepal | Voting",
  description: "Secure and anti-redundant voting system for ISMT College events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mulish.variable} ${oswald.variable}`}>
      <body>
        <nav className="navbar">
          <Link href="/" className="nav-brand">
            <img src="/ismtlogo.jpg" alt="ISMT College Logo" className="nav-brand-logo" />
            <span>ISMT College</span>
          </Link>
          <div className="nav-links">
            <Link href="/">Home</Link>
            <Link href="/register">Register</Link>
            <Link href="/results">Live Results</Link>
            <Link href="/admin">Admin Panel</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
