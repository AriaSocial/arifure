import type { ReactNode } from "react"
import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"

import "./styles/globals.css"

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="isolate min-h-screen bg-background text-foreground">
          <header className="border-b bg-background/95">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <Link to="/" className="font-semibold tracking-tight">Arifure Tools</Link>
              <nav className="flex items-center gap-4 text-sm text-muted-foreground" aria-label="メインナビゲーション">
                <Link to="/gp-calculator" className="transition-colors hover:text-foreground">GP計算</Link>
                <Link to="/quiz" className="transition-colors hover:text-foreground">クイズ検索</Link>
              </nav>
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
