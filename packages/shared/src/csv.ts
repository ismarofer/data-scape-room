// Pure CSV analysis used by the R1A loading wizard (browser) and by tests (node). No DOM, no DuckDB.
export type Encoding = "utf-8" | "latin-1";
export type DateFmt = "iso" | "dmy_hm" | "mdy_hm" | "none";
export interface FileOpts { delimiter: string; encoding: Encoding; dateFormat: DateFmt }
export interface FileSpec { name: string; key: string[]; dateCols: string[] }

export const DATE_REGEX: Record<DateFmt, RegExp | null> = {
  iso: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
  dmy_hm: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4} \d{2}:\d{2}$/,
  mdy_hm: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4} \d{2}:\d{2}$/,
  none: null,
};
export const DATE_SQL: Record<DateFmt, string> = { iso: "%Y-%m-%d %H:%M:%S", dmy_hm: "%d/%m/%Y %H:%M", mdy_hm: "%m/%d/%Y %H:%M", none: "" };

export function decode(bytes: Uint8Array, enc: Encoding): string {
  if (enc === "latin-1") {
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return s;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** RFC-4180-ish parser: quotes, escaped quotes, CR/LF. Returns raw rows with their physical line number. */
export function parseCsv(text: string, delim: string): { cells: string[]; line: number }[] {
  const out: { cells: string[]; line: number }[] = [];
  let row: string[] = [], cell = "", inQ = false, line = 1, startLine = 1;
  const push = () => { row.push(cell); cell = ""; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else { if (c === "\n") line++; cell += c; }
    } else if (c === '"' && cell === "") inQ = true;
    else if (c === delim) push();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      push();
      if (!(row.length === 1 && row[0] === "")) out.push({ cells: row, line: startLine });
      row = []; line++; startLine = line;
    } else cell += c;
  }
  if (cell !== "" || row.length) { push(); out.push({ cells: row, line: startLine }); }
  return out;
}

export interface Analysis {
  header: string[]; valid: string[][]; rejected: { line: number; raw: string; reason: "columnas" | "fecha" | "texto" }[];
  total: number; dateFailures: number; mojibake: number; preview: { cells: string[]; bad?: string }[];
}
const MOJI = /�|Ã[\u0080-¿]|Â[\u0080-¿]/;

export function analyze(text: string, opts: FileOpts, spec: FileSpec): Analysis {
  const rows = parseCsv(text.replace(/^﻿/, ""), opts.delimiter);
  const header = rows[0]?.cells ?? [];
  const re = DATE_REGEX[opts.dateFormat];
  const dateIdx = spec.dateCols.map((c) => header.indexOf(c)).filter((i) => i >= 0);
  const valid: string[][] = [], rejected: Analysis["rejected"] = [], preview: Analysis["preview"] = [];
  let dateFailures = 0, mojibake = 0;
  for (const r of rows.slice(1)) {
    let reason: "columnas" | "fecha" | "texto" | null = null;
    if (r.cells.length !== header.length) reason = "columnas";
    else {
      if (dateIdx.some((i) => r.cells[i] !== "" && !(re && re.test(r.cells[i])))) { reason = "fecha"; dateFailures++; }
      if (r.cells.some((c) => MOJI.test(c))) { mojibake++; if (!reason) reason = "texto"; }
    }
    if (preview.length < 40) preview.push({ cells: r.cells, bad: reason ?? undefined });
    if (reason === "columnas") rejected.push({ line: r.line, raw: r.cells.join(opts.delimiter), reason });
    else if (reason === "fecha") rejected.push({ line: r.line, raw: r.cells.join(opts.delimiter), reason });
    else valid.push(r.cells);
  }
  return { header, valid, rejected, total: rows.length - 1, dateFailures, mojibake, preview };
}

// ---------- tiny sync sha256 (no crypto.subtle on plain-http LAN origins) ----------
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
export function sha256Hex(msg: string): string {
  const bytes = new TextEncoder().encode(msg);
  const l = bytes.length, withPad = (((l + 9 + 63) >> 6) << 6);
  const buf = new Uint8Array(withPad); buf.set(bytes); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(withPad - 4, (l * 8) >>> 0); dv.setUint32(withPad - 8, Math.floor((l * 8) / 2 ** 32));
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < withPad; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3), s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0; }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0]+=a; H[1]+=b; H[2]+=c; H[3]+=d; H[4]+=e; H[5]+=f; H[6]+=g; H[7]+=h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** Canonical report string the wizard sends for a loaded file (hashed server-side). */
export function fileReport(a: Analysis, spec: FileSpec): string {
  const idx = spec.key.map((k) => a.header.indexOf(k));
  const ids = idx.every((i) => i >= 0) ? sha256Hex(a.valid.map((r) => idx.map((i) => r[i]).join("|")).sort().join(",")).slice(0, 12) : "none";
  return `${spec.name}|rows=${a.valid.length}|rej=${a.rejected.filter((r) => r.reason === "columnas").length}|cols=${a.header.length}|ids=${ids}|datefail=${a.dateFailures}|moji=${a.mojibake}`;
}
