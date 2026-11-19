// R6 «Laboratorio de riesgo»: a tiny, dependency-free logistic regression (IRLS + ridge) with a FIXED seed and 5-fold cross-validation.
// The same code runs in the browser (live training) and on the server (re-checking what a team submits), so results are reproducible.

export interface MlRow {
  edad: string; // age band: "0-17" ... "80+"
  cronicas: number; // number of chronic conditions
  estancia: number; // length of stay in days
  previos: number; // admissions in the previous 12 months
  centro: string; // organization id
  sexo: string; // "F" | "M"
  dias_hasta_siguiente_ingreso: number; // LEAKS THE FUTURE: only known after the next admission
  y: 0 | 1; // readmitted within 30 days
}
export const ML_FEATURES = ["edad", "cronicas", "estancia", "previos", "centro", "sexo", "dias_hasta_siguiente_ingreso"] as const;
export type MlFeature = (typeof ML_FEATURES)[number];
export const LEAK_FEATURES: MlFeature[] = ["dias_hasta_siguiente_ingreso"];
export const ML_CSV_COLUMNS = ["episode_id", "edad", "cronicas", "estancia", "previos", "centro", "sexo", "dias_hasta_siguiente_ingreso", "reingreso_30d"];

export function parseMlCsv(text: string): MlRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const head = lines[0].split(",");
  const ix = (c: string) => head.indexOf(c);
  const col = Object.fromEntries(ML_CSV_COLUMNS.map((c) => [c, ix(c)]));
  return lines.slice(1).map((l) => {
    const p = l.split(",");
    return {
      edad: p[col.edad], cronicas: Number(p[col.cronicas]), estancia: Number(p[col.estancia]), previos: Number(p[col.previos]), centro: p[col.centro], sexo: p[col.sexo],
      dias_hasta_siguiente_ingreso: Number(p[col.dias_hasta_siguiente_ingreso]), y: p[col.reingreso_30d] === "1" ? 1 : 0,
    } as MlRow;
  });
}

// ---------- design matrix ----------
interface Design { names: string[]; owner: MlFeature[]; X: number[][] }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function design(rows: MlRow[], feats: MlFeature[]): Design {
  const names: string[] = [], owner: MlFeature[] = [];
  const cols: number[][] = [];
  const numeric = (f: MlFeature, get: (r: MlRow) => number) => {
    const v = rows.map(get); const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
    cols.push(v.map((x) => (x - m) / sd)); names.push(f); owner.push(f);
  };
  const dummies = (f: MlFeature, get: (r: MlRow) => string) => {
    const levels = [...new Set(rows.map(get))].sort();
    for (const lv of levels.slice(1)) { cols.push(rows.map((r) => (get(r) === lv ? 1 : 0))); names.push(`${f}=${lv}`); owner.push(f); }
  };
  for (const f of feats) {
    if (f === "edad") dummies(f, (r) => r.edad);
    else if (f === "centro") dummies(f, (r) => r.centro);
    else if (f === "sexo") dummies(f, (r) => r.sexo);
    else if (f === "cronicas") numeric(f, (r) => r.cronicas);
    else if (f === "estancia") numeric(f, (r) => Math.log1p(r.estancia));
    else if (f === "previos") numeric(f, (r) => r.previos);
    else numeric(f, (r) => Math.log1p(Math.min(r.dias_hasta_siguiente_ingreso, 400)));
  }
  const X = rows.map((_, i) => [1, ...cols.map((c) => c[i])]);
  return { names, owner, X };
}

// ---------- logistic regression (Newton / IRLS with ridge) ----------
function solve(A: number[][], b: number[]): number[] {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i] || 1e-12;
    for (let c = i; c <= n; c++) M[i][c] /= d;
    for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i]; if (f) for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  return M.map((r) => r[n]);
}
const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
export function fit(X: number[][], y: number[], lambda = 1, iters = 12): number[] {
  const p = X[0].length; let w = new Array(p).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(p).fill(0); const H = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < X.length; i++) {
      const xi = X[i]; let z = 0; for (let j = 0; j < p; j++) z += w[j] * xi[j];
      const mu = sigmoid(z), s = mu * (1 - mu) + 1e-6, e = mu - y[i];
      for (let j = 0; j < p; j++) { g[j] += e * xi[j]; const sj = s * xi[j]; for (let k = j; k < p; k++) H[j][k] += sj * xi[k]; }
    }
    for (let j = 0; j < p; j++) { for (let k = 0; k < j; k++) H[j][k] = H[k][j]; if (j > 0) { H[j][j] += lambda; g[j] += lambda * w[j]; } }
    const step = solve(H, g); let mx = 0;
    w = w.map((v, j) => { mx = Math.max(mx, Math.abs(step[j])); return v - step[j]; });
    if (mx < 1e-6) break;
  }
  return w;
}
const predict = (w: number[], x: number[]) => { let z = 0; for (let j = 0; j < w.length; j++) z += w[j] * x[j]; return sigmoid(z); };

export function auc(p: number[], y: number[]): number {
  const idx = p.map((_, i) => i).sort((a, b) => p[a] - p[b]);
  let rank = 1, sumPos = 0, nPos = 0; const n = p.length;
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && p[idx[j + 1]] === p[idx[i]]) j++; const avg = (2 * rank + (j - i)) / 2; for (let k = i; k <= j; k++) if (y[idx[k]] === 1) { sumPos += avg; nPos++; } rank += j - i + 1; i = j + 1; }
  const nNeg = n - nPos; return nPos && nNeg ? (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : 0.5;
}

export interface Metrics { threshold: number; precision: number; sensitivity: number; specificity: number; tp: number; fp: number; fn: number; tn: number }
export function metricsAt(p: number[], y: number[], t: number): Metrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (let i = 0; i < p.length; i++) { const pos = p[i] >= t; if (pos && y[i]) tp++; else if (pos) fp++; else if (y[i]) fn++; else tn++; }
  return { threshold: t, tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : 0, sensitivity: tp + fn ? tp / (tp + fn) : 0, specificity: tn + fp ? tn / (tn + fp) : 0 };
}

export interface TrainResult { feats: MlFeature[]; probs: number[]; y: number[]; auc: number; prevalence: number; metrics: Metrics; importance: { feature: MlFeature; pct: number }[] }
/** 5-fold cross-validated training. `probs` are out-of-fold (every row is predicted by a model that never saw it). */
export function train(rows: MlRow[], feats: MlFeature[], seed = 20261117): TrainResult {
  const y: number[] = rows.map((r) => r.y), n = rows.length;
  const D = design(rows, feats);
  const rnd = mulberry32(seed);
  const order = rows.map((_, i) => i).sort(() => rnd() - 0.5);
  const fold = new Array(n).fill(0); order.forEach((i, k) => { fold[i] = k % 5; });
  const probs = new Array(n).fill(0);
  for (let f = 0; f < 5; f++) {
    const tr: number[] = [], te: number[] = [];
    for (let i = 0; i < n; i++) (fold[i] === f ? te : tr).push(i);
    const w = fit(tr.map((i) => D.X[i]), tr.map((i) => y[i]));
    for (const i of te) probs[i] = predict(w, D.X[i]);
  }
  const prevalence = y.reduce((a, b) => a + b, 0) / n;
  const wAll = fit(D.X, y);
  const imp = new Map<MlFeature, number>();
  D.owner.forEach((o, j) => imp.set(o, (imp.get(o) ?? 0) + Math.abs(wAll[j + 1])));
  const tot = [...imp.values()].reduce((a, b) => a + b, 0) || 1;
  return { feats, probs, y, auc: auc(probs, y), prevalence, metrics: metricsAt(probs, y, prevalence), importance: [...imp].map(([feature, v]) => ({ feature, pct: (100 * v) / tot })).sort((a, b) => b.pct - a.pct) };
}

// ---------- R6B: weekly capacity simulation ----------
export const WEEKLY_DISCHARGES = 200; // the group discharges ~200 patients per week; the dataset is a sample
export const WEEKLY_CALL_CAPACITY = 40; // nurses can phone 40 patients per week
export interface WeekSim { callsPerWeek: number; maxCalls: number; weeksOverCapacity: number; detectedPerWeek: number; missedPerWeek: number; falseAlarmsPerWeek: number; sensitivity: number }
/** 52 simulated weeks drawn (seeded) from the out-of-fold predictions. */
export function simulateWeeks(probs: number[], y: number[], threshold: number, seed = 7): WeekSim {
  const rnd = mulberry32(seed); const n = probs.length;
  let calls = 0, mx = 0, over = 0, det = 0, miss = 0, fa = 0;
  for (let w = 0; w < 52; w++) {
    let c = 0;
    for (let k = 0; k < WEEKLY_DISCHARGES; k++) { const i = Math.floor(rnd() * n); const pos = probs[i] >= threshold; if (pos) { c++; if (y[i]) det++; else fa++; } else if (y[i]) miss++; }
    calls += c; mx = Math.max(mx, c); if (c > WEEKLY_CALL_CAPACITY) over++;
  }
  const cases = det + miss;
  return { callsPerWeek: calls / 52, maxCalls: mx, weeksOverCapacity: over, detectedPerWeek: det / 52, missedPerWeek: miss / 52, falseAlarmsPerWeek: fa / 52, sensitivity: cases ? det / cases : 0 };
}

// ---------- R6C: per-group sensitivity ----------
export interface GroupSens { group: string; n: number; cases: number; sensitivity: number }
export function sensitivityByGroup(rows: MlRow[], probs: number[], threshold: number): { sexo: GroupSens[]; edad: GroupSens[] } {
  const by = (key: (r: MlRow) => string): GroupSens[] => {
    const m = new Map<string, { n: number; cases: number; tp: number }>();
    rows.forEach((r, i) => { const k = key(r); const g = m.get(k) ?? { n: 0, cases: 0, tp: 0 }; g.n++; if (r.y) { g.cases++; if (probs[i] >= threshold) g.tp++; } m.set(k, g); });
    return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([group, g]) => ({ group, n: g.n, cases: g.cases, sensitivity: g.cases ? g.tp / g.cases : 0 }));
  };
  return { sexo: by((r) => r.sexo), edad: by((r) => r.edad) };
}
