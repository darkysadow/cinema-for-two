import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Film } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cinema for Two", template: "%s | Cinema for Two" },
  description: "Discover movies and save your favorites to a private Watchlist.",
  applicationName: "Cinema for Two",
  icons: { icon: "/cinema-icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <header className="site-header">
          <nav className="site-nav shell" aria-label="Main">
            <Link href="/" className="brand">
              <span className="brand-mark"><Film size={19} aria-hidden="true" /></span>
              Cinema for Two
            </Link>
            <Link href="/watchlist" className="nav-link" prefetch={false}>
              <Bookmark size={17} aria-hidden="true" />
              Watchlist
            </Link>
          </nav>
        </header>
        <main className="shell main" id="main">{children}</main>
        <footer className="shell site-footer">
          <a href="https://www.themoviedb.org/" aria-label="Movie data from TMDB">
            Movie data from TMDB
          </a>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </footer>
      </body>
    </html>
  );
}
