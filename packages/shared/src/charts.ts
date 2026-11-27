// Dashboard specification + declarative rule engine (SPEC 7.5). Evaluated in the client for live feedback and re-evaluated
// on the server over the submitted specification, so the rules can never be bypassed from the browser.
//
// A chart is free: the team picks the kind of chart, WHAT is measured and BY WHAT it is split. Good practice that has no
// reason to be a choice (value axis from zero, no 3D, no double axis) is simply how the charts are drawn.
// Severity: 🔴 critical = the chart misleads → it blocks; 🟡 warn = it can be better → you may go on, gaining less confidence;
// 🔵 info = a suggestion.
// pie and donut are offered on purpose (26-nov): they are a classic mistake and the critic always flags them in red.
export const CHART_KINDS = ["bar", "line", "area", "pie", "donut", "table", "kpi"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];
export const MEASURES = ["rate", "readmissions", "discharges"] as const;
export type Measure = (typeof MEASURES)[number];
export const DIMENSIONS = ["center", "age", "area", "month", "year"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export interface ChartSpec {
  kind: ChartKind;
  measure: Measure;
  by: Dimension; // ignored by «kpi» (a single number)
  title?: string; // old dashboards only: ignored, the title is generated (chartTitle)
  showN: boolean; // number of discharges next to every rate
  sort: "none" | "desc";
  minN: boolean; // apply the team's minimum of discharges (centres below it are hidden)
  palette: "single" | "accent" | "rainbow"; // rainbow = too many colours
}
export interface DashboardSpec { charts: ChartSpec[] }
export type Lang2 = "es" | "gl";

export interface Finding { id: string; severity: "info" | "warn" | "critical"; aspect: "clarity" | "honesty" | "accessibility"; chart?: number; text: Record<Lang2, string> }

const TIME: Dimension[] = ["month", "year"];
const MEASURE_TITLE: Record<Measure, Record<Lang2, string>> = {
  rate: { es: "Tasa de reingreso a 30 días", gl: "Taxa de reingreso a 30 días" },
  readmissions: { es: "Número de reingresos", gl: "Número de reingresos" },
  discharges: { es: "Número de altas", gl: "Número de altas" },
};
const BY_TITLE: Record<Dimension, Record<Lang2, string>> = {
  center: { es: "por centro", gl: "por centro" },
  age: { es: "por tramo de edad", gl: "por tramo de idade" },
  area: { es: "por área sanitaria", gl: "por área sanitaria" },
  month: { es: "por mes (desde 2022)", gl: "por mes (desde 2022)" },
  year: { es: "por año", gl: "por ano" },
};
/**
 * The chart title says what is drawn and is generated from the choices (26-nov): typing it was a chore and judging it
 * was not what the level is about. Whatever the team picks, the title always matches the chart.
 */
export function chartTitle(c: ChartSpec, lang: Lang2 = "es"): string {
  if (c.kind === "kpi") return `${MEASURE_TITLE[c.measure][lang]} ${lang === "gl" ? "(total)" : "(total)"}`;
  const min = c.minN ? (lang === "gl" ? " · centros co mínimo de altas" : " · centros con el mínimo de altas") : "";
  return `${MEASURE_TITLE[c.measure][lang]} ${BY_TITLE[c.by][lang]}${c.by === "center" || c.by === "area" ? min : ""}`;
}

/** Rule engine. Returns the findings (empty = clean dashboard). */
export function evaluateDashboard(d: DashboardSpec): Finding[] {
  const out: Finding[] = [];
  const f = (id: string, severity: Finding["severity"], aspect: Finding["aspect"], chart: number | undefined, es: string, gl: string) => out.push({ id, severity, aspect, chart, text: { es, gl } });
  d.charts.forEach((c, i) => {
    const n = i + 1, g = `Gráfico ${n}`;
    if (c.kind === "kpi") {
      if (c.measure !== "rate") f(`kpi_measure_${n}`, "warn", "honesty", i, `${g}: un número suelto de reingresos no dice si es mucho o poco. Para el indicador, mejor la tasa.`, `${g}: un número solto de reingresos non di se é moito ou pouco. Para o indicador, mellor a taxa.`);
      return;
    }
    if ((c.by === "center" || c.by === "area") && c.measure === "readmissions")
      f(`counts_${n}`, "critical", "honesty", i, `${g}: comparar el NÚMERO de reingresos entre ${c.by === "center" ? "centros" : "áreas"} de tamaños muy distintos engaña: el más grande siempre «gana». Usad la tasa (reingresos / altas).`, `${g}: comparar o NÚMERO de reingresos entre ${c.by === "center" ? "centros" : "áreas"} de tamaños moi distintos engana: o máis grande sempre «gaña». Usade a taxa (reingresos / altas).`);
    if (c.by === "center" && c.measure === "rate" && !c.minN)
      f(`min_n_${n}`, "critical", "honesty", i, `${g}: aparece un centro con 3 ingresos y un 100 % de reingresos. Con tan pocas altas la tasa no significa nada: aplicad vuestro mínimo de altas.`, `${g}: aparece un centro con 3 ingresos e un 100 % de reingresos. Con tan poucas altas a taxa non significa nada: aplicade o voso mínimo de altas.`);
    if (c.kind === "pie" || c.kind === "donut")
      f(`pie_${n}`, "critical", "clarity", i, `${g}: en un gráfico de ${c.kind === "pie" ? "tarta" : "anillo"} el ojo no sabe comparar ángulos ni áreas: dos porciones parecidas parecen iguales aunque no lo sean. Y ${c.measure === "rate" ? "las tasas de cada grupo no son partes de un total: las porciones no suman nada real" : "con tantas porciones no se ve quién es mayor"}. Usad barras.`, `${g}: nun gráfico de ${c.kind === "pie" ? "torta" : "anel"} o ollo non sabe comparar ángulos nin áreas: dúas porcións parecidas semellan iguais aínda que non o sexan. E ${c.measure === "rate" ? "as taxas de cada grupo non son partes dun total: as porcións non suman nada real" : "con tantas porcións non se ve quen é maior"}. Usade barras.`);
    if ((c.kind === "line" || c.kind === "area") && !TIME.includes(c.by))
      f(`line_${n}`, "critical", "clarity", i, `${g}: una ${c.kind === "area" ? "área (línea rellena)" : "línea"} une puntos que van uno detrás de otro, como los meses. Para comparar ${c.by === "age" ? "tramos de edad" : c.by === "area" ? "áreas" : "centros"}, usad barras.`, `${g}: unha ${c.kind === "area" ? "área (liña recheada)" : "liña"} une puntos que van un tras outro, como os meses. Para comparar ${c.by === "age" ? "tramos de idade" : c.by === "area" ? "áreas" : "centros"}, usade barras.`);
    if (c.measure === "rate" && !c.showN && c.kind !== "line" && c.kind !== "area")
      f(`shows_n_${n}`, "warn", "honesty", i, `${g}: enseñad cuántas altas hay detrás de cada tasa (n): no es lo mismo un 10 % de 30 que de 900.`, `${g}: amosade cantas altas hai detrás de cada taxa (n): non é o mesmo un 10 % de 30 ca de 900.`);
    if (c.kind === "bar" && !TIME.includes(c.by) && c.by !== "age" && c.sort !== "desc")
      f(`sorted_${n}`, "warn", "clarity", i, `${g}: ordenad de mayor a menor para que se lea de un vistazo.`, `${g}: ordenade de maior a menor para que se lea dunha ollada.`);
    if (c.palette === "rainbow")
      f(`palette_${n}`, "warn", "accessibility", i, `${g}: demasiados colores distraen y no se distinguen con daltonismo. Usad uno, o uno más otro para destacar.`, `${g}: demasiadas cores distraen e non se distinguen con daltonismo. Usade unha, ou unha máis outra para destacar.`);
  });
  const key = (c: ChartSpec) => `${c.kind}|${c.measure}|${c.kind === "kpi" ? "" : c.by}`;
  d.charts.forEach((c, i) => {
    if (d.charts.findIndex((x) => key(x) === key(c)) < i) f(`repeated_${i + 1}`, "warn", "clarity", i, `Gráfico ${i + 1}: enseña lo mismo que otro gráfico. Cada gráfico debería responder a una pregunta distinta.`, `Gráfico ${i + 1}: amosa o mesmo ca outro gráfico. Cada gráfico debería responder a unha pregunta distinta.`);
  });
  if (d.charts.length && !d.charts.some((c) => c.measure === "rate"))
    f("no_rate", "critical", "honesty", undefined, "Ningún gráfico enseña la tasa de reingresos, que es justo lo que pide la Comisión.", "Ningún gráfico amosa a taxa de reingresos, que é xusto o que pide a Comisión.");
  if (d.charts.length < 3 || d.charts.length > 4)
    f("count", "critical", "clarity", undefined, "Elegid entre 3 y 4 gráficos: cada uno debe responder a una pregunta.", "Elixide entre 3 e 4 gráficos: cada un debe responder a unha pregunta.");
  return out;
}

export const defaultChart = (kind: ChartKind = "bar"): ChartSpec => ({ kind, measure: "readmissions", by: "center", showN: false, sort: "none", minN: false, palette: "rainbow" });
