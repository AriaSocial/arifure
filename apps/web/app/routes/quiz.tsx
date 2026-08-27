import { useMemo, useState } from "react"
import { Circle, X } from "lucide-react"

import quizData from "@/data/quiz.json"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type QuizEntry = {
  question: string
  answer: "y" | "n"
}

type SearchableQuizEntry = QuizEntry & {
  normalizedQuestion: string
}

// Quiz data is immutable for the lifetime of the static bundle. Normalize once
// at module initialization instead of lower-casing every question on every keystroke.
const quizzes: readonly SearchableQuizEntry[] = (quizData as QuizEntry[]).map((quiz) => ({
  ...quiz,
  normalizedQuestion: quiz.question.toLocaleLowerCase("ja-JP"),
}))

export function meta() {
  return [{ title: "クイズ正誤検索 | Arifure Tools" }]
}

export default function QuizSearch() {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP")

  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return []
    return quizzes.filter((quiz) => quiz.normalizedQuestion.includes(normalizedQuery))
  }, [normalizedQuery])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>クイズ正誤検索</CardTitle>
          <CardDescription>問題文の一部を2文字以上入力すると、既存のクイズデータから部分一致で検索します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="quiz-query">問題文を検索</Label>
          <Input
            id="quiz-query"
            type="search"
            placeholder="検索語を入力"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </CardContent>
      </Card>

      {normalizedQuery.length < 2 ? (
        <p className="text-sm text-muted-foreground">2文字以上入力してください。</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">検索条件に一致するクイズは見つかりませんでした。</p>
      ) : (
        <section className="space-y-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">{results.length.toLocaleString("ja-JP")}件見つかりました。</p>
          {results.map((quiz, index) => (
            <Card key={`${quiz.question}-${index}`}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base leading-relaxed">{quiz.question}</CardTitle>
                  <Badge variant={quiz.answer === "y" ? "secondary" : "destructive"}>
                    {quiz.answer === "y" ? (
                      <Circle aria-hidden="true" className="size-4" strokeWidth={2.5} />
                    ) : (
                      <X aria-hidden="true" className="size-4" strokeWidth={2.5} />
                    )}
                    <span className="sr-only">{quiz.answer === "y" ? "正しい" : "誤り"}</span>
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
