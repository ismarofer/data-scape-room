import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const root = process.cwd();
const sol = (id: string) => JSON.parse(fs.readFileSync(path.join(root, "solutions", `${id}.json`), "utf8"));
const PIN = process.env.FACILITATOR_PIN ?? "0000";
const uniq = () => `T${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`; // the DB persists: every run needs a fresh team name
/** Story (4 screens) and then the screen tour: skipped here, walked step by step in its own test. */
async function passIntro(page: import("@playwright/test").Page) {
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Ver la pantalla ▶" }).click();
  await expect(page.locator(".tour-card")).toBeVisible();
  await page.locator(".tour-card").getByRole("button", { name: "Saltar" }).click();
  await expect(page.locator(".tour")).toHaveCount(0);
}
/** Every room starts with its briefing (what you will do, the levels, what you learn). */
async function enterRoom(page: import("@playwright/test").Page, stage: RegExp) {
  await expect(page.locator(".briefing .bstage")).toHaveText(stage, { timeout: 60_000 });
  await page.getByRole("button", { name: "¡Vamos! ▶" }).click();
}

const FILES: { name: string; delim: string; enc: string; date: string }[] = [
  { name: "patients.csv", delim: ",", enc: "utf-8", date: "none" },
  { name: "organizations.csv", delim: "|", enc: "utf-8", date: "none" },
  { name: "encounters_H1.csv", delim: ",", enc: "utf-8", date: "iso" },
  { name: "encounters_H2.csv", delim: ",", enc: "latin-1", date: "iso" },
  { name: "encounters_H2_reenvio.csv", delim: ",", enc: "utf-8", date: "iso" },
  { name: "encounters_H3.csv", delim: ";", enc: "latin-1", date: "dmy_hm" },
  { name: "encounters_H4.csv", delim: "	", enc: "utf-8", date: "iso" },
  { name: "conditions.csv", delim: "	", enc: "latin-1", date: "none" },
];

test("speedrun R0-R6 and the Commission in the real browser (DuckDB-WASM)", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/");
  await page.getByLabel(/Alias del equipo/).fill(uniq());
  await page.getByRole("button", { name: "Entrar" }).click();

  // the Query Lab is an editor tab: open it from the level, go back with «▶ Nivel actual»
  const toLab = async () => { await page.locator(".labdock button").click(); await expect(page.getByRole("tab", { name: /Laboratorio de preguntas/ })).toHaveAttribute("aria-selected", "true"); };
  const toLevel = () => page.getByRole("tab", { name: /^▶/ }).click();
  const submitCode = async (id: string) => {
    await page.getByLabel("Vuestra respuesta", { exact: true }).fill(sol(id).code);
    await page.getByRole("button", { name: "Probar", exact: true }).click();
  };

  // story, tour, the tutorial room briefing, then the tutorial
  await passIntro(page);
  await expect(page.locator(".briefing")).toContainText("Hospital Costa Atlántica"); // the tutorial code is in the briefing
  await enterRoom(page, /Tutorial/);
  await expect(page.getByRole("heading", { name: "El primer candado" })).toBeVisible();
  await expect(page.locator(".mission")).toContainText("océano");
  await expect(page.locator(".steps-card li")).toHaveCount(3);
  await page.getByLabel("Vuestra respuesta", { exact: true }).fill("atlántico");
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await expect(page.locator(".toast.win")).toContainText("Nivel superado"); // every change of the score is visible
  await enterRoom(page, /Sala 1 · Ingesta/);
  await expect(page.getByRole("heading", { name: "La bandeja de entrada" }).first()).toBeVisible();

  // R1A: H3 read with the default (wrong) options is flagged first
  await page.locator(".wizard .files").getByRole("button", { name: /encounters_H3.csv/ }).click();
  await expect(page.locator(".counts")).toContainText("símbolos raros");
  for (const f of FILES) {
    await page.locator(".wizard .files").getByRole("button", { name: new RegExp(f.name.replace(".", "\\.") + "$") }).click();
    const sels = page.locator(".opts select");
    await sels.nth(0).selectOption(f.delim);
    await sels.nth(1).selectOption(f.enc);
    await sels.nth(2).selectOption(f.date);
    await expect(page.locator(".counts")).not.toContainText("símbolos raros");
    await page.getByRole("button", { name: /Cargar este fichero|Volver a cargar/ }).click();
    await expect(page.locator(".wizard .files").getByRole("button", { name: new RegExp("✔ " + f.name.replace(".", "\\.")) })).toBeVisible({ timeout: 60_000 });
  }
  await page.getByRole("button", { name: /Validar carga/ }).click();
  await expect(page.getByRole("heading", { name: "El reenvío" })).toBeVisible({ timeout: 60_000 });

  // R1B
  await page.getByRole("button", { name: /Quedarse con la última versión/ }).click();
  await toLab();
  await expect(page.getByRole("heading", { name: /Laboratorio de preguntas/ })).toBeVisible();
  await page.getByRole("button", { name: /Hacer la pregunta/ }).click();
  await expect(page.locator(".lab table")).toBeVisible({ timeout: 30_000 });
  await toLevel();
  await submitCode("r1b_reenvio");

  // R1C: audit Ada (a false positive first, then exact)
  await expect(page.getByRole("heading", { name: "Auditoría de Ada" })).toBeVisible();
  await toLab();
  await page.getByLabel(/Sobre qué tabla/).selectOption("raw.patients");
  await page.getByLabel(/Qué quieres saber/).selectOption("distinct");
  await page.getByLabel(/En qué columna/).selectOption("ssn");
  await page.getByRole("button", { name: /Hacer la pregunta/ }).click();
  await expect(page.locator(".lab table")).toContainText("valores_distintos", { timeout: 30_000 });
  // several conditions at once: inpatient encounters whose discharge date is empty
  await page.getByLabel(/Sobre qué tabla/).selectOption("raw.encounters");
  await page.getByLabel(/Qué quieres saber/).selectOption("rows");
  await page.getByRole("button", { name: /Añadir una condición/ }).click();
  await page.getByLabel("Columna de la condición 1").selectOption("encounter_class");
  await page.getByLabel("Valor de la condición 1").fill("inpatient");
  await page.getByRole("button", { name: /Añadir una condición/ }).click();
  await page.getByLabel("Columna de la condición 2").selectOption("stop_ts");
  await page.getByLabel("Tipo de condición 2").selectOption("empty");
  await expect(page.locator("pre.sql")).toContainText("and coalesce(cast(stop_ts as varchar)");
  await page.getByRole("button", { name: /Hacer la pregunta/ }).click();
  await expect(page.locator(".lab table")).toContainText("filas", { timeout: 30_000 });
  await toLevel();


  const marks: string[] = sol("r1c_ada").code.split(";");
  const claimBoxes = page.locator(".claims li");
  await claimBoxes.nth(0).locator("input[type=checkbox]").check();
  await page.getByRole("button", { name: "Entregar auditoría" }).click();
  await expect(page.locator(".err").filter({ hasText: /falsa/ })).toBeVisible();
  await claimBoxes.nth(0).locator("input[type=checkbox]").uncheck();
  for (const claim of marks) await claimBoxes.nth(Number(claim.slice(1)) - 1).locator("input[type=checkbox]").check();
  await page.getByRole("button", { name: "Entregar auditoría" }).click();

  // R2A: privacy radar (SSN kept in clear -> critical failure first)
  await expect(page.getByRole("heading", { name: "Radar RGPD" })).toBeVisible();
  const radar = Object.fromEntries(sol("r2a_radar").code.split(";").map((m: string) => m.split("=")));
  const classify = async (over: Record<string, string> = {}) => {
    for (const [col, act] of Object.entries({ ...radar, ...over })) await page.getByLabel(`Mover ${col}`).selectOption(act as string);
    await page.getByRole("button", { name: "Aplicar decisiones" }).click();
  };
  await classify({ ssn: "keep" });
  await expect(page.locator(".err").filter({ hasText: /identifican directamente/ })).toBeVisible();
  await classify();

  // R3 · Modelado: the protocol is read inside the model level now
  await enterRoom(page, /Sala 2 · Modelado/);
  // R3B star schema: table names without fct_/dim_ prefix; join by clicking two cards; a wrong delivery is marked in red
  await expect(page.getByRole("heading", { name: "Esquema en estrella" })).toBeVisible();
  await expect(page.locator(".leveldocs .doclink")).toContainText("Esquema en estrella");
  await expect(page.locator(".starcanvas")).not.toContainText("fct_");
  // a passed level shows what the team delivered, read-only
  await page.getByRole("tree", { name: "Niveles" }).getByRole("button", { name: "Radar RGPD", exact: true }).click();
  await expect(page.locator(".solvedbox")).toContainText("Pseudonimizar");
  await expect(page.locator(".solvedbox")).toContainText("ssn");
  await page.getByRole("tab", { name: /^▶/ }).click();
  await expect(page.locator(".starcanvas")).not.toContainText("dim_");
  const star = sol("r3b_estrella").code as string;
  const types = Object.fromEntries(star.split("|")[0].replace("types:", "").split(",").map((x: string) => x.split("=")));
  const kindBtn = (t: string, k: string) => page.locator(`.starcanvas [data-table="${t}"] .kindbtns button`, { hasText: k === "fact" ? "Hecho" : "Dimensión" });
  // first a wrong type on purpose
  for (const [t, k] of Object.entries(types)) await kindBtn(t, t === "fct_condition" ? "dim" : (k as string)).click();
  const card = (t: string) => page.locator(`.starcanvas [data-table="${t}"] b`);
  await card("dim_date").click(); await card("dim_patient").click();
  await expect(page.locator(".starnote")).toContainText("Dos dimensiones no se unen");
  await card("dim_date").click(); await card("fct_admission").click(); // either order: the arrow goes from the fact
  await expect(page.locator(".edgechip").first()).toContainText("admission → date");
  await page.getByRole("button", { name: "Comprobar esquema" }).click();
  await expect(page.locator('.starcanvas [data-table="fct_condition"].wrong')).toBeVisible();
  await kindBtn("fct_condition", "fact").click();
  await expect(page.locator('.starcanvas [data-table="fct_condition"].wrong')).toHaveCount(0); // the mark goes away when changed
  await page.getByRole("button", { name: "Borrar todas las uniones" }).click();
  await page.getByText("Unir con menús (sin ratón)").click();
  const grp = page.getByRole("group", { name: "Unir con teclado" });
  const edgesStar = star.split("|")[1].replace("edges:", "").split(",");
  for (const e of edgesStar) {
    const [f, t] = e.split(">");
    await grp.getByLabel("Desde").selectOption(f);
    await grp.getByLabel("Hasta").selectOption(t);
    await grp.getByRole("button", { name: "Unir", exact: true }).click();
  }
  await expect(page.locator(".edgechip")).toHaveCount(edgesStar.length);
  await page.getByRole("button", { name: "Comprobar esquema" }).click();

  // R3C model + provisional number: the pieces are plain-language choices; the protocol is read in its document (not copied here)
  await expect(page.getByRole("heading", { name: "Modelo de reingreso" })).toBeVisible();
  await expect(page.locator(".protonote")).toContainText("peticiones-direccion.md");
  await expect(page.locator(".protonote")).not.toContainText("30 días");
  const mc = sol("r3c_modelo").choices as Record<string, Record<string, string>>;
  for (const m of ["int_admission_episodes", "fct_admission"]) for (const [slot, id] of Object.entries(mc[m])) await page.locator(`input[type=radio][name="${m}.${slot}"][value="${id}"]`).check();
  await page.getByRole("button", { name: "▶ Calcular" }).click();
  await expect(page.locator(".results .pass").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".results .warn").first()).toBeVisible(); // negative stays: the warning that motivates R4
  // count with the Query Lab (the same assistant as in room 1), now with the tables of the calculation
  await toLab();
  await page.getByLabel(/Sobre qué tabla/).selectOption("marts.fct_admission");
  await page.getByLabel(/Qué quieres saber/).selectOption("rows");
  await page.getByRole("button", { name: /Añadir una condición/ }).click();
  await page.getByLabel("Columna de la condición 1").selectOption("is_readmission_30d");
  await page.getByLabel("Valor de la condición 1").fill("true");
  await page.getByRole("button", { name: /Hacer la pregunta/ }).click();
  await expect(page.locator(".lab table")).toContainText(String(sol("r3c_modelo").code), { timeout: 30_000 });
  await toLevel();
  await submitCode("r3c_modelo");

  // R3 quality starts with the interviews: the problem cards explain what was seen, not why
  await enterRoom(page, /Sala 3 · Calidad/);
  await expect(page.getByRole("heading", { name: "Entrevistas" }).first()).toBeVisible();
  const order4 = ["negative_stay", "post_mortem", "frag_h3"]; // detector order on screen
  // R4B interviews with the (scripted) AI characters: a vague question reveals nothing
  await expect(page.getByRole("heading", { name: "Entrevistas" }).first()).toBeVisible();
  const ask = async (npc: string, text: string) => {
    await page.getByRole("tab", { name: new RegExp(npc) }).click();
    await page.getByLabel(new RegExp("Pregúntale a " + npc)).fill(text);
    await page.locator("section.npc").getByRole("button", { name: "➤" }).click();
    // wait for the answer (live AI can be slow): a question sent while the previous one is pending would be lost
    await expect(page.locator("section.npc").getByRole("button", { name: "➤" })).toBeDisabled();
    await expect(page.getByLabel(new RegExp("Pregúntale a " + npc))).toHaveValue("");
    await page.getByLabel(new RegExp("Pregúntale a " + npc)).fill("x");
    await expect(page.locator("section.npc").getByRole("button", { name: "➤" })).toBeEnabled({ timeout: 60_000 });
    await page.getByLabel(new RegExp("Pregúntale a " + npc)).fill("");
  };
  await expect(page.locator(".goals")).toHaveCount(0); // no list of questions and who knows them: the cards are enough
  await expect(page.locator(".det").first()).toContainText("registros", { timeout: 30_000 });
  await expect(page.locator(".det").first()).toContainText("Por qué importa");
  await expect(page.locator(".det .detcause.got")).toHaveCount(0);
  await ask("Noa", "¿Me puedes ayudar con algo?");
  await expect(page.getByText("Pistas encontradas:")).toBeVisible();
  for (const i of sol("r4b_entrevistas").interview as { npc: string; message: string }[]) await ask(i.npc === "noa" ? "Noa" : "Brais", i.message);
  await expect(page.locator(".det .detcause.got")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Entrevistas" }).first()).toBeVisible(); // it does not move on by itself
  await page.getByRole("button", { name: /Terminar las entrevistas y seguir/ }).click();

  // R4C verdict + R4D code
  await expect(page.getByRole("heading", { name: "Veredicto" })).toBeVisible({ timeout: 30_000 });
  const vd = Object.fromEntries(sol("r4c_veredicto").code.split(";").map((m: string) => m.split("=")));
  await expect(page.locator(".det").first()).toContainText("registros", { timeout: 30_000 });
  for (let i = 0; i < 3; i++) await page.locator(".det select").nth(i).selectOption(vd[order4[i]]);
  await page.getByRole("button", { name: "Dictar veredicto" }).click();
  await expect(page.getByRole("heading", { name: "Registros excluidos" })).toBeVisible();
  await submitCode("r4d_codigo");

  // R5A KPI
  await enterRoom(page, /Sala 4 · Visualización/);
  await expect(page.getByRole("heading", { name: "KPI con sentido" })).toBeVisible();
  const kp = Object.fromEntries(sol("r5a_kpi").code.split(";").map((m: string) => m.split("=")));
  await page.getByLabel("¿Cómo se calcula la tasa?").selectOption(kp.kpi);
  await page.getByLabel("Mínimo de altas").fill("3"); // too low: the 3-case clinic is still published
  await page.getByLabel(/Clínica Illas Cíes/).selectOption(kp.small_center);
  await page.getByRole("button", { name: "Fijar el indicador" }).click();
  await expect(page.locator(".kpiform input.wrong")).toBeVisible();
  await page.getByLabel("Mínimo de altas").fill(kp.min_n.replace(/^n/, "")); // the solution keeps the old option id (n30)
  await page.getByLabel(/Clínica Illas Cíes/).selectOption(kp.small_center);
  await page.getByRole("button", { name: "Fijar el indicador" }).click();

  // R5B dashboard builder: free charts (kind · measure · split). Sloppy on purpose -> R5C critic: red blocks, yellow lets you go on
  await expect(page.getByRole("heading", { name: "Constructor de dashboard" })).toBeVisible();
  const cfgs = [{ kind: "bar", measure: "readmissions", by: "center" }, { kind: "line", measure: "rate", by: "month" }, { kind: "bar", measure: "rate", by: "age" }];
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /Añadir gráfico/ }).click();
    await page.locator(".dash-grid .panel").nth(i).click();
    await page.getByLabel("Tipo de gráfico").selectOption(cfgs[i].kind);
    await page.getByLabel("Qué dato se muestra").selectOption(cfgs[i].measure);
    await page.getByLabel("Repartido por (eje)").selectOption(cfgs[i].by);
  }
  await expect(page.getByLabel(/Título/)).toHaveCount(0); // no title box: it is generated
  await page.locator(".dash-grid .panel").nth(2).click();
  await page.getByLabel("Tipo de gráfico").selectOption("pie");
  await expect(page.locator(".dash-grid .panel").nth(2).locator("svg path").first()).toBeVisible({ timeout: 30_000 }); // the pie is really drawn
  await page.getByLabel("Tipo de gráfico").selectOption("bar");
  await expect(page.locator(".dash-grid .panel h4").nth(2)).toContainText("Tasa de reingreso a 30 días por tramo de edad");
  await page.getByRole("button", { name: "Pasar al crítico" }).click();
  await expect(page.getByRole("heading", { name: "Revisión del crítico" })).toBeVisible();
  await expect(page.locator(".critic li.critical").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Arreglad lo rojo/ })).toBeDisabled();
  // fix only the red: rate instead of counts, and the team's minimum; the rest stays yellow (n, order, colours)
  await page.locator(".dash-grid .panel").nth(0).click();
  await page.getByLabel("Qué dato se muestra").selectOption("rate");
  await page.getByLabel(/Aplicar vuestro mínimo de altas/).check();
  await expect(page.getByRole("button", { name: /Entregar con .* aviso/ })).toBeEnabled();
  await page.getByRole("button", { name: /Entregar con .* aviso/ }).click();

  // R5D
  await expect(page.getByRole("heading", { name: "El centro con mayor tasa" })).toBeVisible({ timeout: 30_000 });
  await toLab();
  await page.getByLabel(/Sobre qué tabla/).selectOption("canon.fct_admission_clean");
  await page.getByLabel(/Qué quieres saber/).selectOption("pct_by");
  await page.getByLabel(/En qué columna/).selectOption("organization_name");
  await page.getByLabel(/qué % tiene la marca/).selectOption("is_readmission_30d");
  while (await page.getByLabel(/Quitar condición/).count()) await page.getByLabel(/Quitar condición/).first().click(); // the condition of R3C is still there
  await page.getByRole("button", { name: /Hacer la pregunta/ }).click();
  await expect(page.locator(".lab table tbody tr").first()).toContainText("Illas Cíes", { timeout: 30_000 }); // without the minimum, the 3-case centre wins
  await page.getByLabel("Mínimo de filas por grupo").fill("30");
  await page.getByRole("button", { name: /Hacer la pregunta/ }).click();
  await expect(page.locator(".lab table tbody tr").first()).toContainText(String(sol("r5d_codigo").code), { timeout: 30_000 });
  await toLevel();
  await submitCode("r5d_codigo");

  // R6 laboratorio de riesgo (bonus): train an honest model, pick a threshold, review equity
  await enterRoom(page, /Sala 5 · Predicción/);
  await expect(page.getByRole("heading", { name: "Entrenar el modelo" }).first()).toBeVisible({ timeout: 30_000 });
  for (const v of ["Edad (tramo)", "Nº de condiciones", "Duración de la estancia", "Ingresos previos (12 meses)", "Centro", "Sexo"]) await page.locator("label.mlvar", { hasText: v }).getByRole("checkbox").check();
  await page.getByRole("button", { name: /Entrenar$/ }).click();
  await expect(page.locator(".mlkpis")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".mlpred svg circle")).toHaveCount(10); // how the model predicts: real vs predicted by risk group
  await expect(page.locator(".mlhelp")).toContainText("Qué significa cada medida");
  await page.getByRole("button", { name: "Entregar modelo" }).click();
  await expect(page.getByRole("heading", { name: "Umbral con presupuesto" }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Umbral", { exact: true }).fill("0.16");
  await page.getByRole("button", { name: "Entregar umbral" }).click();
  await expect(page.getByRole("heading", { name: "Equidad y decisión" }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("radio", { name: /Desplegar con revisión humana/ }).check();
  await page.locator(".ml textarea").fill("El modelo caza menos reingresos en mujeres que en hombres, por eso una persona debe revisar los avisos.");
  await page.getByRole("button", { name: "Entregar decisión" }).click();

  // the Commission: five functional questions with a tip each and the summary cards, then the ending
  await enterRoom(page, /Presentación/);
  await expect(page.getByRole("heading", { name: "La Comisión" }).first()).toBeVisible({ timeout: 30_000 });
  const answer = "Fijamos un mínimo de 30 altas porque un centro con 3 ingresos da un 100 % por azar. Es un límite de nuestros datos. Recomendamos revisar esos centros aparte y repetir el análisis cada mes.";
  await expect(page.locator(".commission .ccard").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".commission .csummary")).toContainText("La cifra");
  await expect(page.locator(".commission .csummary")).toContainText("Illa Verde");
  await expect(page.locator(".commission input[type=checkbox]")).toHaveCount(0); // nothing to attach: the summary is always there
  await expect(page.locator(".commission blockquote")).toContainText(/de cada 100/i);
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(".commission blockquote")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".commission .ctip")).toBeVisible();
    await page.locator(".commission textarea").fill(answer);
    await page.getByRole("button", { name: "Responder" }).click();
    if (i < 4) await expect(page.locator(".commission progress")).toHaveAttribute("value", String(i + 1), { timeout: 90_000 });
  }
  await expect(page.locator(".final .ending")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Los votos de la Comisión/)).toBeVisible();

  // every passed level shows its own tool, filled with what the team delivered and disabled
  if (process.env.SHOTS) await page.setViewportSize({ width: 1500, height: 4200 });
  const review = async (name: string, expectText: RegExp | string, shot: string) => {
    await page.getByRole("tree", { name: "Niveles" }).getByRole("button", { name, exact: true }).click();
    const box = page.locator(".solvedbox").last();
    await expect(box).toContainText(expectText, { timeout: 60_000 });
    if (process.env.SHOTS) await box.screenshot({ path: `${process.env.SHOTS}/solved-${shot}.png` });
  };
  await review("El reenvío", "vuestra decisión", "reenvio");
  await review("Esquema en estrella", "patient", "estrella");
  await review("Modelo de reingreso", "episodios", "modelo");
  await expect(page.locator(".solvedbox fieldset.ro input[type=radio]:checked").first()).toBeDisabled();
  await review("Entrevistas", "Noa", "entrevistas");
  await review("Veredicto", "Tratamiento", "veredicto");
  await review("KPI con sentido", "Clínica Illas Cíes", "kpi");
  await review("Revisión del crítico", "Crítico de visualización", "critico");
  await review("Entrenar el modelo", "Cómo predice este modelo", "entrenar");
  await expect(page.locator(".solvedbox .mlpred svg circle")).toHaveCount(10);
  await review("Umbral con presupuesto", "Llamadas por semana", "umbral");
  await review("Equidad y decisión", "Por sexo", "equidad");
});

test("workbench: explorer with locked levels, solved levels reopen, files and docs open in tabs, assistant on the right, two laptops share one team", async ({ browser }) => {
  const team = uniq();
  const join = async () => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/");
      await page.getByLabel(/Alias del equipo/).fill(team);
    await page.getByRole("button", { name: "Entrar" }).click();
    await passIntro(page);
    await enterRoom(page, /Tutorial/);
    return page;
  };
  const a = await join();
  const b = await join();
  const levels = (p: typeof a) => p.getByRole("tree", { name: "Niveles" });

  // no roles, no sheets; the AI assistant owns the right-hand side
  await expect(a.getByLabel("Rol", { exact: true })).toHaveCount(0);
  await expect(a.getByText("Fichas del equipo")).toHaveCount(0);
  await expect(a.getByRole("complementary", { name: "Asistente de IA" }).getByText("Lumi").first()).toBeVisible();

  // levels not reached yet cannot be opened
  await expect(levels(a).getByRole("button", { name: "La bandeja de entrada", exact: true })).toBeDisabled();

  // progress on one laptop shows up on the other without reloading
  await a.getByLabel("Vuestra respuesta", { exact: true }).fill("atlantico");
  await a.getByRole("button", { name: "Probar", exact: true }).click();
  await expect(b.getByRole("heading", { name: "La bandeja de entrada" }).first()).toBeVisible({ timeout: 10_000 }); // the room briefing
  await enterRoom(a, /Sala 1 · Ingesta/);
  await expect(levels(a).getByRole("button", { name: "La bandeja de entrada", exact: true })).toBeEnabled();

  // a solved level can be reopened (read-only) in its own tab
  await levels(a).getByRole("button", { name: "El primer candado", exact: true }).click();
  await expect(a.getByText(/Nivel superado\. Podéis repasar/)).toBeVisible();
  await expect(a.locator(".solvedbox")).toContainText("atlantico"); // what they answered
  await expect(a.getByRole("tab", { name: /El primer candado/ })).toBeVisible();
  await levels(a).getByRole("button", { name: "La bandeja de entrada", exact: true }).click(); // back to the game tab
  await expect(a.getByLabel("Vuestra respuesta", { exact: true }).or(a.locator(".wizard"))).toBeVisible();

  // project files open in tabs; documents appear with the level that needs them
  const files = a.getByRole("tree", { name: "Ficheros del proyecto" });
  await files.getByRole("button", { name: "patients.csv" }).click();
  await expect(a.getByRole("tab", { name: /patients\.csv/ })).toBeVisible();
  await expect(a.locator(".codeview")).toContainText("patient_id");
  await files.getByRole("button", { name: "especificaciones-ficheros.md" }).click();
  await expect(a.getByRole("heading", { name: "Hoja de especificaciones de ficheros" })).toBeVisible();
  await expect(a.locator(".mdview table").first()).toBeVisible(); // the markdown is rendered, not shown as text
  await expect(a.locator(".mdview h2").first()).toBeVisible();
  await expect(a.getByRole("separator", { name: /altura de las secciones/ }).first()).toBeVisible();
  await a.getByRole("button", { name: /Cerrar .*patients\.csv/ }).click();
  await expect(a.getByRole("tab", { name: /patients\.csv/ })).toHaveCount(0);
});

test("guided experience: screen tour step by step, Lumi help ladder with visible score change, table info cards", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Alias del equipo/).fill(uniq());
  await page.getByRole("button", { name: "Entrar" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Ver la pantalla ▶" }).click();

  // the tour lights up one area at a time and greys out the rest
  const titles = ["Niveles", "Ficheros del proyecto", "Base de datos", "Pestañas", "El nivel", "Lumi, vuestra ayudante", "Pistas", "Tiempo y confianza", "Ayuda siempre a mano"];
  for (let i = 0; i < titles.length; i++) {
    await expect(page.locator(".tour-card h3")).toHaveText(titles[i]);
    await expect(page.locator(".tour-spot")).toBeVisible(); // its target exists on screen
    await page.locator(".tour-card").getByRole("button", { name: i === titles.length - 1 ? "¡Empezamos!" : "Siguiente" }).click();
  }
  await expect(page.locator(".tour")).toHaveCount(0);
  await enterRoom(page, /Tutorial/);

  // Lumi: quick question, then the first hint (free to unlock, costs 5 of confidence) shows up in the chat and as a toast
  const lumi = page.getByRole("complementary", { name: "Asistente de IA" });
  await lumi.getByRole("button", { name: "¿Qué hay que hacer aquí?" }).click();
  // every question to Lumi costs 1 of confidence (charged before the answer arrives), every hint 5
  await expect(page.locator(".toast", { hasText: "Pregunta a Lumi" })).toContainText("Confianza de la Comisión −1");
  await expect(lumi.locator(".thread p.ai").first()).toBeVisible({ timeout: 60_000 });
  await expect(lumi.locator(".aicost")).toContainText("Cada pregunta a Lumi baja 1");
  await lumi.getByRole("button", { name: /Dame una pista/ }).click();
  await expect(lumi.locator(".thread p.helpmsg")).toContainText("Pista 1", { timeout: 15_000 });
  await expect(page.locator(".toast", { hasText: "Pista 1 de Lumi" })).toContainText("Confianza de la Comisión −5");
  await expect(lumi.locator(".ladder i.on")).toHaveCount(1);
  // the next hint is not open yet: it needs a failed try (or time)
  await expect(lumi.getByRole("button", { name: /Dame una pista/ })).toBeDisabled();
  await page.getByLabel("Vuestra respuesta", { exact: true }).fill("pacifico");
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await expect(lumi.getByRole("button", { name: /Dame una pista/ })).toBeEnabled({ timeout: 10_000 });
  // «¿Atascados?» in the level focuses Lumi
  await page.getByRole("button", { name: /Preguntad a Lumi/ }).click();
  await expect(lumi.getByLabel("Pregúntale a Lumi")).toBeFocused();

  // solve the tutorial and load one file: the database tree keeps columns folded, the table tab explains them
  await page.getByLabel("Vuestra respuesta", { exact: true }).fill("atlantico");
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await enterRoom(page, /Sala 1 · Ingesta/);
  await page.locator(".wizard .files").getByRole("button", { name: /patients\.csv$/ }).click();
  await expect(page.locator(".wiz-main .fileinfo")).toContainText("¿Qué es esto?");
  await page.getByRole("button", { name: /Cargar este fichero/ }).click();
  const db = page.locator('[data-tour="db"]');
  const tbl = db.locator(".node.file", { hasText: "patients" });
  await expect(tbl).toBeVisible({ timeout: 30_000 });
  await expect(db.locator(".colslist")).toHaveCount(0);
  await tbl.click();
  await expect(page.locator(".dbview .fileinfo")).toContainText("Pacientes");
  await expect(page.locator(".dbview .fileinfo dl")).toContainText("ssn");
  await expect(page.locator(".dbview th.has-info").first()).toBeVisible();
  await expect(db.locator(".node.chev")).toHaveCount(0); // the tree never lists columns
  await expect(page.locator(".dbview .fileinfo dl dt")).toHaveCount(19); // every column of patients is explained
  // the Query Lab opens as a tab from anywhere and can be reopened after closing it
  await page.locator(".status .labbtn").click();
  await expect(page.getByRole("heading", { name: /Laboratorio de preguntas/ })).toBeVisible();
  await page.getByRole("button", { name: /Cerrar 🔬 Laboratorio/ }).click();
  await expect(page.getByRole("tab", { name: /Laboratorio de preguntas/ })).toHaveCount(0);
  await db.locator(".labnode").click();
  await expect(page.getByRole("tab", { name: /Laboratorio de preguntas/ })).toHaveAttribute("aria-selected", "true");
});

test("facilitator console: PIN, team table, detail, pause and resume", async ({ page }) => {
  await page.goto("/facilitador");
  await page.getByLabel("PIN").fill(PIN);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Consola del facilitador" })).toBeVisible();
  await expect(page.locator(".factable tbody tr").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Detalle" }).first().click();
  await expect(page.getByRole("heading", { name: "Conversaciones con la IA" })).toBeVisible();
  await page.getByRole("button", { name: /Pausar la partida/ }).click();
  await expect(page.getByText(/La partida está en pausa/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Reanudar la partida/ }).click();
  await expect(page.getByText(/La partida está en pausa/)).toHaveCount(0, { timeout: 15_000 });
});

test("testing shortcut: the facilitator puts a test team at the start of the model level and it works with the data rebuilt", async ({ page }) => {
  test.setTimeout(240_000);
  const alias = uniq();
  await page.goto("/facilitador");
  await page.getByLabel("PIN").fill(PIN);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.locator(".factest").getByLabel("Nombre del equipo").fill(alias);
  await page.locator(".factest").getByLabel("Nivel").selectOption("r3c_modelo");
  await page.getByRole("button", { name: "Ir a ese nivel ▶" }).click();
  await expect(page.locator(".factest")).toContainText("Listo");
  await page.goto("/");
  await page.getByLabel(/Alias del equipo/).fill(alias);
  await page.getByRole("button", { name: "Entrar" }).click();
  await passIntro(page);
  await enterRoom(page, /Sala 2 · Modelado/);
  await expect(page.getByRole("heading", { name: "Modelo de reingreso" })).toBeVisible();
  const mc = sol("r3c_modelo").choices as Record<string, Record<string, string>>;
  for (const m of ["int_admission_episodes", "fct_admission"]) for (const [slot, id] of Object.entries(mc[m])) await page.locator(`input[type=radio][name="${m}.${slot}"][value="${id}"]`).check();
  await page.getByRole("button", { name: "▶ Calcular" }).click();
  await expect(page.locator(".results .pass").first()).toBeVisible({ timeout: 120_000 }); // raw data rebuilt from the loader options the shortcut saved
  await expect(page.locator(".protonote")).toContainText("peticiones-direccion.md"); // the rules are read in the document, not copied here
  await expect(page.locator(".protonote ol")).toHaveCount(0);
  await page.reload(); // the in-browser database is rebuilt: loaded files and the calculated models
  const dbTree = page.getByRole("tree", { name: "Base de datos" });
  await expect(dbTree).toContainText("fct_admission", { timeout: 120_000 });
  for (const tbl of ["dim_patient", "dim_hospital", "dim_date", "fct_condition"]) await expect(dbTree).toContainText(tbl); // the star is built for real
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dbtree.png` });
  await expect(dbTree).toContainText("encounters");
  await page.getByLabel("Vuestra respuesta", { exact: true }).fill(String(sol("r3c_modelo").code));
  await page.getByRole("button", { name: "Probar", exact: true }).click();
  await enterRoom(page, /Sala 3 · Calidad/);
  await expect(page.getByRole("heading", { name: "Entrevistas" }).first()).toBeVisible();
});
