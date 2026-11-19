import type { Lang } from "@codigo-alta/shared";

export interface Rubric {
  max_warn: number;
  columns: Record<string, { ok: string[]; critical?: string[]; blocking?: string[] }>;
}
export type BadKind = "critical" | "blocking" | "warn" | "missing";
export interface PrivacyResult { ok: boolean; critical: number; blocking: number; warn: number; missing: number; bad: { col: string; kind: BadKind }[] }

/** Report format: "col=action;col=action" with actions remove|pseudonymize|keep|generalize. */
export function evalPrivacy(report: string, rubric: Rubric): PrivacyResult {
  const given = new Map(report.split(";").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
  let critical = 0, blocking = 0, warn = 0, missing = 0;
  const bad: PrivacyResult["bad"] = [];
  for (const [col, r] of Object.entries(rubric.columns)) {
    const a = given.get(col);
    if (!a) { missing++; bad.push({ col, kind: "missing" }); continue; }
    if (r.critical?.includes(a)) { critical++; bad.push({ col, kind: "critical" }); }
    else if (r.blocking?.includes(a)) { blocking++; bad.push({ col, kind: "blocking" }); }
    else if (!r.ok.includes(a)) { warn++; bad.push({ col, kind: "warn" }); }
  }
  return { ok: critical === 0 && blocking === 0 && missing === 0 && warn <= rubric.max_warn, critical, blocking, warn, missing, bad };
}

export interface ClaimsResult { ok: boolean; falsePositives: number; falseNegatives: number; wrongMarks: string[] }
/** Report format: "c2;c3" = the claims marked as false (anything after a ":" is ignored). */
export function evalClaims(report: string, claimIds: string[], hashOf: (normalized: string) => string, expectedHash: string): ClaimsResult {
  const marked = new Set(report.split(";").filter(Boolean).map((p) => p.split(":")[0]));
  const set = (ids: string[]) => [...ids].sort().join("");
  // recover the true set of false claims from the hash (2^n subsets): the server never stores it in clear
  let truth: string[] = [];
  for (let m = 0; m < 1 << claimIds.length; m++) {
    const ids = claimIds.filter((_, i) => m & (1 << i));
    if (hashOf(set(ids)) === expectedHash) { truth = ids; break; }
  }
  const sel = [...marked];
  const fp = sel.filter((c) => !truth.includes(c)).length;
  const fn = truth.filter((c) => !marked.has(c)).length;
  return { ok: fp === 0 && fn === 0, falsePositives: fp, falseNegatives: fn, wrongMarks: sel.filter((c) => !truth.includes(c)) };
}

export const MSG: Record<string, Record<Lang, string>> = {
  privacy_critical: { es: "Hay datos que identifican directamente a una persona y no deberían mantenerse así. Cumplimiento baja.", gl: "Hai datos que identifican directamente a unha persoa e non deberían manterse así. O cumprimento baixa." },
  privacy_blocking: { es: "Cuidado: tirar la columna que identifica a cada persona os dejará sin forma de unir fichas duplicadas más adelante. Pensad en un seudónimo.", gl: "Coidado: tirar a columna que identifica cada persoa deixaravos sen forma de unir fichas duplicadas máis adiante. Pensade nun pseudónimo." },
  privacy_warn: { es: "Casi: aún hay columnas que se pueden tratar mejor. Pensad en qué os permitiría reconocer a alguien al combinarlas.", gl: "Case: aínda hai columnas que se poden tratar mellor. Pensade en que vos permitiría recoñecer a alguén ao combinalas." },
  privacy_missing: { es: "Faltan columnas por clasificar.", gl: "Faltan columnas por clasificar." },
  ml_bad: { es: "Elegid al menos las variables del listado: ese modelo no es válido.", gl: "Elixide polo menos as variables do listado: ese modelo non é válido." },
  ml_leak: { es: "Ese modelo es demasiado bueno para ser verdad: alguna variable no se conocería en el momento del alta. Revisad qué sabe el hospital ANTES de que el paciente se vaya.", gl: "Ese modelo é demasiado bo para ser verdade: algunha variable non se coñecería no momento da alta. Revisade que sabe o hospital ANTES de que o paciente marche." },
  ml_few: { es: "Con tan pocas variables el modelo no tiene de dónde aprender: añadid alguna más que SÍ se conozca al alta.", gl: "Con tan poucas variables o modelo non ten de onde aprender: engadide algunha máis que SI se coñeza á alta." },
  ml_weak: { es: "El modelo todavía predice poco mejor que el azar: probad otras variables que sí se conozcan en el momento del alta.", gl: "O modelo aínda prediz pouco mellor ca o azar: probade outras variables que si se coñezan no momento da alta." },
  ml_miss: { es: "Con ese umbral se pierden demasiados reingresos: la enfermería no detectaría ni 3 de cada 10.", gl: "Con ese limiar perdense demasiados reingresos: a enfermaría non detectaría nin 3 de cada 10." },
  ml_eq_short: { es: "Justificad la decisión con una frase más completa (mínimo 40 letras).", gl: "Xustificade a decisión cunha frase máis completa (mínimo 40 letras)." },
  ml_eq_deploy: { es: "Mirad otra vez el gráfico: ¿el modelo caza los reingresos por igual en todos los grupos? Si no, ¿debería decidir solo?", gl: "Mirade outra vez o gráfico: o modelo caza os reingresos por igual en todos os grupos? Se non, debería decidir só?" },
  ml_eq_nodeploy: { es: "Es una decisión prudente, pero el modelo sí aporta valor. ¿Hay una forma de usarlo reduciendo el riesgo de perjudicar a algún grupo?", gl: "É unha decisión prudente, pero o modelo si achega valor. Hai unha forma de usalo reducindo o risco de prexudicar a algún grupo?" },
  ml_eq_text: { es: "La decisión es razonable, pero la justificación no cita lo que habéis visto: nombrad los grupos y la diferencia entre ellos, y qué haría esa persona que revisa.", gl: "A decisión é razoable, pero a xustificación non cita o que vistes: nomeade os grupos e a diferenza entre eles, e que faría esa persoa que revisa." },
  claims_fp: { es: "Alguna afirmación que habéis marcado como falsa sí es cierta. Cada marca falsa resta puntos: comprobadlo con el Laboratorio de preguntas.", gl: "Algunha afirmación que marcastes como falsa si é certa. Cada marca falsa resta puntos: comprobádeo co Laboratorio de preguntas." },
  claims_fn: { es: "Se os escapa alguna afirmación falsa. Contrastad las seis con el Laboratorio de preguntas.", gl: "Escápavos algunha afirmación falsa. Contrastade as seis co Laboratorio de preguntas." },
  dash_structure: { es: "Elegid entre 3 y 4 gráficos y poned un título a cada uno.", gl: "Elixide entre 3 e 4 gráficos e poñede un título a cada un." },
  dash_findings: { es: "El crítico aún ve problemas importantes: retocad los gráficos señalados.", gl: "O crítico aínda ve problemas importantes: retocade os gráficos sinalados." },
  wrong_code: { es: "Ese código no abre este candado. Revisa tus datos.", gl: "Ese código non abre este cadeado. Revisa os teus datos." },
};
