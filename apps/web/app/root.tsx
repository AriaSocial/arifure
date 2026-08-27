import type { ReactNode } from "react"
import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"

import { ThemeToggle } from "@/components/theme-toggle"

import "./styles/globals.css"

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("arifure-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch {}
})();
`

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
        <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
        <meta name="format-detection" content="telephone=no" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="isolate min-h-screen bg-background text-foreground">
          <header className="border-b bg-background/95">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <Link to="/" className="font-semibold tracking-tight">Arifure Tools</Link>
              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-4 text-sm text-muted-foreground" aria-label="メインナビゲーション">
                  <Link to="/gp-calculator" className="transition-colors hover:text-foreground">GP計算</Link>
                  <Link to="/quiz" className="transition-colors hover:text-foreground">クイズ検索</Link>
                </nav>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}
