// Splits a structured report ("q1=d30;q2=merge", one line per file, star-schema types/edges...) into independent items.
// The server stores only a salted hash per CORRECT item, so it can tell which items of a wrong submission are wrong
// without ever holding (or sending) the right values.
export interface ReportItem { id: string; value: string }

export function itemizeReport(key: string, report: string): ReportItem[] {
  const r = report.trim();
  if (key === "r1a_bandeja") return r.split("\n").filter(Boolean).map((l) => ({ id: l.split("|")[0], value: l.trim() }));
  if (key === "r3b_estrella") {
    const [types = "", edges = ""] = r.split("|");
    const out: ReportItem[] = [];
    for (const t of types.replace(/^types:/, "").split(",").filter(Boolean)) out.push({ id: `type:${t.split("=")[0]}`, value: `type:${t}` });
    for (const e of edges.replace(/^edges:/, "").split(",").filter(Boolean)) out.push({ id: `edge:${e}`, value: `edge:${e}` });
    return out;
  }
  // r3a_protocolo, r4a_pruebas, r4c_veredicto, r5a_kpi: "k=v;k=v"
  return r.split(";").filter((p) => p.includes("=")).map((p) => ({ id: p.split("=")[0], value: p }));
}
