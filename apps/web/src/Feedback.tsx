import { useEffect, useRef, useState } from "react";
import type { Lang, TeamState } from "@codigo-alta/shared";

/** Why the meters are about to change (the last thing the team did on THIS laptop). Other laptops see the change without a reason. */
let lastAction: { text: string; at: number } | null = null;
export const noteAction = (text: string) => { lastAction = { text, at: Date.now() }; };

type MeterKey = "trust" | "compliance" | "quality" | "score";
export interface Toast { id: number; kind: "up" | "down" | "win"; title: string; lines: string[] }
export const METER_ICON: Record<MeterKey, string> = { trust: "🤝", compliance: "🛡", quality: "🧹", score: "🏆" };
const NAME: Record<MeterKey, { es: string; gl: string }> = {
  trust: { es: "Confianza", gl: "Confianza" }, compliance: { es: "Cumplimiento", gl: "Cumprimento" }, quality: { es: "Calidad de datos", gl: "Calidade de datos" }, score: { es: "Puntos", gl: "Puntos" },
};

/**
 * Turns every change of score and meters into something you notice: a toast with the change and its reason,
 * and a short flash (+10 / −5) next to the value in the status bar.
 */
export function useMeterFeedback(s: TeamState | null, lang: Lang) {
  const prev = useRef<{ m: Record<MeterKey, number>; done: number; lock: string | null } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flash, setFlash] = useState<Partial<Record<MeterKey, number>>>({});
  const seq = useRef(0);
  useEffect(() => {
    if (!s) return;
    const now = { m: { trust: s.meters.trust, compliance: s.meters.compliance, quality: s.meters.quality, score: s.score }, done: s.locks.filter((l) => l.status === "done").length, lock: s.currentLockId };
    const p = prev.current;
    prev.current = now;
    if (!p) return;
    const deltas = (Object.keys(now.m) as MeterKey[]).map((k) => [k, now.m[k] - p.m[k]] as const).filter(([, d]) => d !== 0);
    if (!deltas.length && now.done === p.done) return;
    const gl = lang === "gl";
    const why = lastAction && Date.now() - lastAction.at < 8000 ? lastAction.text : "";
    lastAction = null;
    const lines = deltas.map(([k, d]) => `${METER_ICON[k]} ${NAME[k][lang]} ${d > 0 ? "+" : "−"}${Math.abs(d)}`);
    const solved = now.done > p.done;
    const solvedTitle = s.locks.find((l) => l.id === p.lock)?.title;
    const t: Toast = {
      id: ++seq.current,
      kind: solved ? "win" : deltas.every(([, d]) => d > 0) ? "up" : "down",
      title: solved ? `🔓 ${gl ? "Nivel superado!" : "¡Nivel superado!"}${solvedTitle ? ` ${solvedTitle}` : ""}` : why || (gl ? "Cambiaron os vosos medidores" : "Han cambiado vuestros medidores"),
      lines: solved && why && !why.startsWith("Entrega") ? [why, ...lines] : lines,
    };
    setToasts((x) => [...x.slice(-2), t]);
    setFlash(Object.fromEntries(deltas));
    // not cleared on the next state: a quick second update must not keep the first toast forever
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 6500);
    setTimeout(() => setFlash({}), 2600);
  }, [s, lang]);
  return { toasts, flash, dismiss: (id: number) => setToasts((x) => x.filter((y) => y.id !== id)) };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          <b>{t.title}</b>
          {t.lines.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      ))}
    </div>
  );
}

/** A meter in the status bar, with its change floating next to it for a moment. */
export function MeterChip({ k, label, value, delta, bar = true }: { k: MeterKey; label: string; value: number; delta?: number; bar?: boolean }) {
  return (
    <div className={`meter ${delta ? (delta > 0 ? "m-up" : "m-down") : ""}`} title={label}>
      <span aria-hidden="true">{METER_ICON[k]}</span><span className="mlabel">{label}</span>
      {bar && <progress value={value} max={100} aria-label={label} />}
      <b>{value}</b>
      {delta ? <i className="mdelta" aria-hidden="true">{delta > 0 ? "+" : "−"}{Math.abs(delta)}</i> : null}
    </div>
  );
}
