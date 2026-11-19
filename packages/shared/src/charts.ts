// Dashboard specification + declarative rule engine (SPEC 7.5). Evaluated in the client for live feedback and re-evaluated
// on the server over the submitted specification, so the rules can never be bypassed from the browser.
export const CHART_TYPES = ["bar_center", "line_month", "bar_age", "table", "map_area", "kpi"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export interface ChartSpec {
  type: ChartType;
  title: string;
  axisZero: boolean; // value axis starts at 0
  showN: boolean; // number of cases next to every rate
  sort: "none" | "desc";
  minN: boolean; // hide centres below the minimum volume (n >= 30)
  palette: "single" | "accent" | "rainbow"; // rainbow = too many colours
  dualAxis: boolean;
  threeD: boolean;
}
export interface DashboardSpec { charts: ChartSpec[] }
export type Lang2 = "es" | "gl";

export interface Finding { id: string; severity: "info" | "warn" | "critical"; aspect: "clarity" | "honesty" | "accessibility"; chart?: number; text: Record<Lang2, string> }

const BARS: ChartType[] = ["bar_center", "bar_age", "map_area"];
const CENTER_LEVEL: ChartType[] = ["bar_center", "table", "map_area"];
const CONCLUSION_WORDS = /\b(más|mas|menos|mayor|menor|sube|baja|supera|concentra|destaca|crece|cae|entre|por encima|por debajo|maior|máis|supón|baixa|sobe)\b/i;

export function titleHasConclusion(t: string): boolean {
  const words = t.trim().split(/\s+/).filter(Boolean);
  return words.length >= 6 && (CONCLUSION_WORDS.test(t) || /\d/.test(t));
}

/** Rule engine. Returns the findings (empty = clean dashboard). */
export function evaluateDashboard(d: DashboardSpec): Finding[] {
  const out: Finding[] = [];
  d.charts.forEach((c, i) => {
    const n = i + 1;
    if (BARS.includes(c.type) && !c.axisZero)
      out.push({ id: `axis_zero_${n}`, severity: "critical", aspect: "honesty", chart: i, text: { es: `Gráfico ${n}: el eje de las barras no empieza en cero y exagera las diferencias.`, gl: `Gráfico ${n}: o eixe das barras non empeza en cero e esaxera as diferenzas.` } });
    if (c.type !== "kpi" && !c.showN)
      out.push({ id: `shows_n_${n}`, severity: "warn", aspect: "honesty", chart: i, text: { es: `Gráfico ${n}: enseña el número de casos junto a cada tasa; sin denominador la tasa engaña.`, gl: `Gráfico ${n}: amosa o número de casos xunto a cada taxa; sen denominador a taxa engana.` } });
    if (c.type === "bar_center" && c.sort !== "desc")
      out.push({ id: `sorted_${n}`, severity: "info", aspect: "clarity", chart: i, text: { es: `Gráfico ${n}: ordena los centros de mayor a menor para leerlo de un vistazo.`, gl: `Gráfico ${n}: ordena os centros de maior a menor para lelo dun vistazo.` } });
    if (CENTER_LEVEL.includes(c.type) && !c.minN)
      out.push({ id: `min_n_${n}`, severity: "critical", aspect: "honesty", chart: i, text: { es: `Gráfico ${n}: compara tasas de centros con volúmenes muy distintos; hay un centro con 3 ingresos y un 100 %. Fija un mínimo de altas.`, gl: `Gráfico ${n}: compara taxas de centros con volumes moi distintos; hai un centro con 3 ingresos e un 100 %. Fixa un mínimo de altas.` } });
    if (!titleHasConclusion(c.title))
      out.push({ id: `title_${n}`, severity: "info", aspect: "clarity", chart: i, text: { es: `Gráfico ${n}: el título debería decir la conclusión (qué se ve), no solo qué es.`, gl: `Gráfico ${n}: o título debería dicir a conclusión (que se ve), non só que é.` } });
    if (c.palette === "rainbow")
      out.push({ id: `palette_${n}`, severity: "warn", aspect: "accessibility", chart: i, text: { es: `Gráfico ${n}: demasiados colores; usa como máximo dos de énfasis y apto para daltonismo.`, gl: `Gráfico ${n}: demasiadas cores; usa como máximo dúas de énfase e apto para daltonismo.` } });
    if (c.dualAxis)
      out.push({ id: `dual_${n}`, severity: "warn", aspect: "clarity", chart: i, text: { es: `Gráfico ${n}: el doble eje confunde; separa en dos gráficos.`, gl: `Gráfico ${n}: o dobre eixe confunde; separa en dous gráficos.` } });
    if (c.threeD)
      out.push({ id: `threeD_${n}`, severity: "warn", aspect: "clarity", chart: i, text: { es: `Gráfico ${n}: el 3D deforma las barras; mejor 2D.`, gl: `Gráfico ${n}: o 3D deforma as barras; mellor 2D.` } });
  });
  if (d.charts.length < 3 || d.charts.length > 4)
    out.push({ id: "count", severity: "critical", aspect: "clarity", text: { es: "Elegid entre 3 y 4 gráficos: cada uno debe responder a una pregunta.", gl: "Elixide entre 3 e 4 gráficos: cada un debe responder a unha pregunta." } });
  return out;
}

export const defaultChart = (type: ChartType): ChartSpec => ({ type, title: "", axisZero: false, showN: false, sort: "none", minN: false, palette: "rainbow", dualAxis: false, threeD: false });
