import { useState, type FormEvent } from "react"
import { calculateGp, emptyHammerCounts, type CalculateGpResult, type HammerCounts, type HammerType } from "@arifure/gp-calculator"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { createPageMeta } from "@/lib/meta"

export function meta() {
  return createPageMeta(
    "ガチャポイント計算機 | Arifure Tools",
    "所持している槌から、報酬として獲得する槌の再投入まで含めた最終ガチャポイントを計算します。",
  )
}

const HAMMERS: ReadonlyArray<{ type: HammerType; label: string }> = [
  { type: "wooden", label: "木槌" },
  { type: "iron", label: "鉄槌" },
  { type: "copper", label: "銅槌" },
  { type: "silver", label: "銀槌" },
  { type: "gold", label: "金槌" },
]

function initialResult(): CalculateGpResult {
  return calculateGp({ hammers: emptyHammerCounts(), weeklyEvent: false })
}

export default function GpCalculator() {
  const [hammers, setHammers] = useState<HammerCounts>(() => emptyHammerCounts())
  const [weeklyEvent, setWeeklyEvent] = useState(false)
  const [result, setResult] = useState<CalculateGpResult>(initialResult)
  const [error, setError] = useState<string | null>(null)

  function updateHammer(type: HammerType, rawValue: string) {
    const value = rawValue === "" ? 0 : Math.max(0, Math.trunc(Number(rawValue)))
    setHammers((current) => ({ ...current, [type]: Number.isFinite(value) ? value : 0 }))
    setError(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setResult(calculateGp({ hammers, weeklyEvent }))
      setError(null)
    } catch (cause) {
      if (cause instanceof RangeError) {
        setError("入力値が大きすぎて安全に計算できません。各槌の個数を小さくしてください。")
        return
      }
      throw cause
    }
  }

  function reset() {
    const empty = emptyHammerCounts()
    setHammers(empty)
    setWeeklyEvent(false)
    setResult(initialResult())
    setError(null)
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
                    aria-invalid={error !== null}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="weekly-event">週間イベント</Label>
                <p className="text-sm text-muted-foreground">週間イベントの追加鉄槌報酬を計算に含めます。</p>
              </div>
              <Switch
                id="weekly-event"
                checked={weeklyEvent}
                onCheckedChange={(checked) => {
                  setWeeklyEvent(checked)
                  setError(null)
                }}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            ) : null}
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
