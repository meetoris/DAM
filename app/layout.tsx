import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Video Factory",
  description:
    "Turn a URL, text, or file into a produced short: AI script, fact-check, teleprompter, B-roll, and a performance feedback loop.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('svf-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <span className="brand-mark">▶</span>
              <span>
                Social Video<br />
                <strong>Factory</strong>
              </span>
            </Link>
            <nav>
              <Link href="/">Shorts</Link>
              <Link href="/new" className="nav-cta">＋ New Short</Link>
              <Link href="/insights">Insights</Link>
              <Link href="/settings">Settings</Link>
            </nav>
            <div className="sidebar-foot">
              <ThemeToggle />
              <div className="sidebar-tagline">
                A-roll → B-roll → post.
                <br />
                Scripts that learn from your numbers.
              </div>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
