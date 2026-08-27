import { useState, type FormEvent } from "react"
import { calculateGp, emptyHammerCounts, type HammerCounts, type HammerType } from "@arifure/gp-calculator"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function meta() {
  return [{ title: "ガチャポイント計算機 | Arifure Tools" }]
}

const HAMMERS: ReadonlyArray<{ type: HammerType; label: string }> = [
  { type: "wooden", label: "木槌" },
  { type: "iron", label: "鉄槌" },
  { type: "copper", label: "銅槌" },
  { type: "silver", label: "銀槌" },
  { type: "gold", label: "金槌" },
]

export default function GpCalculator() {
  const [hammers, setHammers] = useState<HammerCounts>(() => emptyHammerCounts())
  const [weeklyEvent, setWeeklyEvent] = useState(false)
  const [result, setResult] = useState(() => calculateGp({ hammers, weeklyEvent }))

  function updateHammer(type: HammerType, rawValue: string) {
    const value = rawValue === "" ? 0 : Math.max(0, Math.trunc(Number(rawValue)))
    setHammers((current) => ({ ...current, [type]: Number.isFinite(value) ? value : 0 }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResult(calculateGp({ hammers, weeklyEvent }))
  }

  function reset() {
    const empty = emptyHammerCounts()
    setHammers(empty)
    setWeeklyEvent(false)
    setResult(calculateGp({ hammers: empty, weeklyEvent: false }))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>ガチャポイント計算機</CardTitle>
          <CardDescription>初期所持の槌を入力してください。獲得した槌は従来仕様どおり再度ポイント計算へ投入されます。</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {HAMMERS.map(({ type, label }) => (
                <div className="space-y-2" key={type}>
                  <Label htmlFor={`hammer-${type}`}>{label}</Label>
                  <Input
                    id={`hammer-${type}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={hammers[type]}
                    onChange={(event) => updateHammer(type, event.currentTarget.value)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="weekly-event">週間イベント</Label>
                <p className="text-sm text-muted-foreground">週間イベントの追加鉄槌報酬を計算に含めます。</p>
              </div>
              <Switch id="weekly-event" checked={weeklyEvent} onCheckedChange={setWeeklyEvent} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">ポイント計算</Button>
            <Button type="button" variant="outline" onClick={reset}>リセット</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>計算結果</CardTitle>
          <CardDescription>報酬槌の再投入まで完了した最終値です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">最終獲得ポイント</p>
            <p className="text-4xl font-bold tabular-nums">{result.totalPoints.toLocaleString("ja-JP")} <span className="text-base font-medium text-muted-foreground">Pt</span></p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">獲得した槌</p>
            <div className="flex flex-wrap gap-2">
              {HAMMERS.map(({ type, label }) => (
                <Badge key={type} variant="secondary">{label} {result.gainedHammers[type].toLocaleString("ja-JP")}</Badge>
              ))}
            </div>
          </div>

          {!result.converged ? (
            <p className="text-sm text-destructive">最大反復回数に達しました。入力値を確認してください。</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
