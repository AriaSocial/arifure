import { CalculatorIcon, SearchIcon } from "lucide-react"
import { Link } from "react-router"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function meta() {
  return [{ title: "Arifure Tools" }, { name: "description", content: "Arifure Wiki向けの補助ツール" }]
}

const tools = [
  {
    title: "ガチャポイント計算機",
    description: "所持している槌から、報酬の再投入を含めた最終獲得ポイントを計算します。",
    href: "/gp-calculator",
    icon: CalculatorIcon,
  },
  {
    title: "クイズ正誤検索",
    description: "既存のクイズデータから問題文を検索し、正誤を確認します。",
    href: "/quiz",
    icon: SearchIcon,
  },
] as const

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Arifure Tools</h1>
        <p className="text-muted-foreground">旧Wiki埋め込みツールを、独立した静的Webアプリケーションとして再構築しています。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <Card key={tool.href}>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Link to={tool.href} className={buttonVariants()}>開く</Link>
              </CardFooter>
            </Card>
          )
        })}
      </section>
    </div>
  )
}
