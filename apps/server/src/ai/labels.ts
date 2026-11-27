import type { Lang } from "@codigo-alta/shared";

// Plain-words names of the items the validators report as wrong (the same words the level shows), for Lumi's fixed texts.
type L2 = { es: string; gl: string };
const ITEMS: Record<string, L2> = {
  q1: { es: "la ventana de reingreso", gl: "a ventá de reingreso" },
  q2: { es: "si se fusionan ingresos seguidos", gl: "se se fusionan ingresos seguidos" },
  q3: { es: "qué cuenta como ingreso", gl: "que conta como ingreso" },
  q4: { es: "las exclusiones", gl: "as exclusións" },
  frag_h3: { es: "el grupo «altas y reingresos del mismo día»", gl: "o grupo «altas e reingresos do mesmo día»" },
  negative_stay: { es: "el grupo «estancias negativas»", gl: "o grupo «estadías negativas»" },
  post_mortem: { es: "el grupo «encuentros después del fallecimiento»", gl: "o grupo «encontros despois do falecemento»" },
  kpi: { es: "cómo se calcula la tasa", gl: "como se calcula a taxa" },
  min_n: { es: "el mínimo de altas", gl: "o mínimo de altas" },
  small_center: { es: "qué hacer con la Clínica Illas Cíes", gl: "que facer coa Clínica Illas Cíes" },
  "int_admission_episodes.class_filter": { es: "la pieza «qué cuenta como ingreso»", gl: "a peza «que conta como ingreso»" },
  "int_admission_episodes.new_episode": { es: "la pieza «cuándo empieza un episodio nuevo»", gl: "a peza «cando empeza un episodio novo»" },
  "fct_admission.window": { es: "la pieza «ventana de reingreso»", gl: "a peza «ventá de reingreso»" },
};

export function itemWords(id: string, lang: Lang): string {
  const gl = lang === "gl";
  if (ITEMS[id]) return ITEMS[id][lang];
  if (/^c\d$/.test(id)) return `${gl ? "a afirmación" : "la afirmación"} ${id.slice(1)}`;
  if (id.endsWith(".csv")) return `${gl ? "o ficheiro" : "el fichero"} ${id}`;
  // the star-schema tables are shown without their fct_/dim_ prefix (it would give the answer away)
  const bare = (s: string) => s.replace(/\b(fct|dim)_/g, "");
  if (id.startsWith("type:")) return `${gl ? "o tipo da táboa" : "el tipo de la tabla"} ${bare(id.slice(5))}`;
  if (id.startsWith("edge:")) return `${gl ? "a unión" : "la unión"} ${bare(id.slice(5)).replace(">", " → ")}`;
  const col = /^(\w+) \((\w+)\)$/.exec(id);
  if (col) return `${gl ? "a columna" : "la columna"} ${col[1]}`;
  if (/_\d+$/.test(id)) return `${gl ? "o gráfico" : "el gráfico"} ${id.split("_").pop()} (${id.replace(/_\d+$/, "").replace(/_/g, " ")})`;
  return id;
}
