"""Stage 4: compute canonical answers with DuckDB SQL -> dist/answers.json (+ public hashes) and BUILD_REPORT.md."""
import json, re, hashlib
import duckdb, pandas as pd
from common import *

SHORT = {"ORG01": "Costa Atlántica", "ORG02": "Ría Norte", "ORG03": "Santa Eira", "ORG04": "Mariña Alta", "ORG05": "Miño",
         "ORG06": "Terra de Montes", "ORG07": "Val do Sar", "ORG08": "Illa Verde", "ORG09": "Illas Cíes"}


def connect():
    con = duckdb.connect()
    for v, f in (("enc", "encounters_canonical"), ("pat", "patients_canonical"), ("org", "organizations")):
        con.execute(f"create view {v} as select * from read_parquet('{(PQ / (f + '.parquet')).as_posix()}')")
    blocks = dict(re.findall(r"-- name: (\w+)\n(.*?)(?=\n-- name:|\Z)", open(ROOT / "answers.sql", encoding="utf-8").read(), re.S))
    con.execute(blocks["adm_base"]); con.execute(blocks["adm_clean"])
    con.execute(blocks["episodes"].format(name="ep_base", adm="adm_base"))
    con.execute(blocks["episodes"].format(name="ep_clean", adm="adm_clean"))
    return con, blocks


def main():
    con, b = connect()
    q = lambda name: con.execute(b[name]).fetchone()[0]
    ans = {}

    def put(lock, value, aliases=()):
        n = normalize(value)
        ans[lock] = dict(value=value if not hasattr(value, "item") else value.item(), normalized=n, sha256_salted=sha(lock, n),
                         aliases=[dict(normalized=normalize(a), sha256_salted=sha(lock, normalize(a))) for a in aliases])

    put("r1b_unique_encounters", int(q("r1b_unique_encounters")))
    put("r2c_unique_patients", int(q("r2c_unique_patients")))
    put("r3c_readmissions_base", int(q("r3c_readmissions_base")))
    put("r4c_excluded", int(q("r4c_excluded")))
    top = q("r5c_top_center")
    short = next(v for k, v in SHORT.items() if dict((o[0], o[1]) for o in ORGS)[k] == top)
    put("r5c_top_center", short, aliases=[top])
    put("p0_tutorial", "ATLANTICO")
    # R1C claims (6, two false). Values computed from data.
    raw_pat = pd.read_csv(RAW / "patients.csv")
    n_rows = len(raw_pat); n_ssn = raw_pat.ssn.nunique()
    n_inp = int(con.execute("select count(*) from enc where encounter_class='inpatient'").fetchone()[0])
    open_n = int(con.execute("select count(*) from enc where encounter_class='inpatient' and stop_ts is null").fetchone()[0])
    n_org = int(con.execute("select count(distinct organization_id) from enc").fetchone()[0])
    yrs = con.execute("select min(year(start_ts)), max(year(start_ts)) from enc").fetchone()
    claims = [
        dict(id="c1", text="Hay 9 centros", claimed=9, actual=n_org, true=(n_org == 9)),
        dict(id="c2", text="Ningún ingreso tiene la fecha de alta vacía", claimed=0, actual=open_n, true=(open_n == 0)),
        dict(id="c3", text=f"Hay {n_rows} pacientes únicos", claimed=n_rows, actual=n_ssn, true=(n_rows == n_ssn)),
        dict(id="c4", text=f"Los datos cubren de {yrs[0]} a {yrs[1]}", claimed=f"{yrs[0]}-{yrs[1]}", actual=f"{yrs[0]}-{yrs[1]}", true=True),
        dict(id="c5", text=f"Hay {n_inp} encuentros de tipo inpatient", claimed=n_inp, actual=n_inp, true=True),
        dict(id="c6", text="Todos los encuentros pertenecen a un paciente conocido", claimed=0, actual=0, true=True),
    ]
    GL = {"c1": "Hai 9 centros", "c2": "Ningún ingreso ten a data de alta baleira", "c3": f"Hai {n_rows} pacientes únicos",
          "c4": f"Os datos cobren de {yrs[0]} a {yrs[1]}", "c5": f"Hai {n_inp} encontros de tipo inpatient", "c6": "Todos os encontros pertencen a un paciente coñecido"}
    json.dump([{"id": c["id"], "text": {"es": c["text"], "gl": GL[c["id"]]}} for c in claims],
              open(DIST / "r1c_claims.public.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ans["r1c_claims"] = dict(value=claims, normalized="".join(c["id"] for c in claims if not c["true"]),
                             sha256_salted=sha("r1c_claims", "".join(c["id"] for c in claims if not c["true"])))
    # R1A expectations
    ans["r1a_files"] = dict(value=json.load(open(WORK / "expected_files.json")), normalized="", sha256_salted="")
    json.dump(ans, open(DIST / "answers.json", "w"), indent=1, ensure_ascii=False)
    pub = {k: dict(sha256_salted=v["sha256_salted"], aliases=[a["sha256_salted"] for a in v.get("aliases", [])]) for k, v in ans.items() if v["sha256_salted"]}
    json.dump(pub, open(DIST / "answers.public.json", "w"), indent=1)

    # solutions/ (used by speedrun e2e + dry-run auto-solve; never shipped to the client)
    sol = ROOT.parent / "solutions"; sol.mkdir(exist_ok=True)
    for lock, (dec, key) in {"p0_tutorial": (None, "p0_tutorial"), "r1b_reenvio": ("latest_by_id", "r1b_unique_encounters")}.items():
        json.dump({"decision": dec, "code": str(ans[key]["value"])}, open(sol / f"{lock}.json", "w"))
    # ---- canonical marts for R3-R5 (identical for every team) + anomaly lists for R4A
    con.execute(f"""copy (
      select md5(e.patient_key || cast(e.ep_no as varchar)) as episode_id, e.patient_key, e.organization_id, o.name as organization_name,
             e.admit_ts, e.discharge_ts, e.days_since as days_since_prev_discharge, e.is_readmit as is_readmission_30d,
             year(e.admit_ts) as admit_year, strftime(e.admit_ts, '%Y-%m') as admit_month,
             case when p.birth_year is null then 'n/d' when year(e.admit_ts) - p.birth_year < 18 then '0-17' when year(e.admit_ts) - p.birth_year < 45 then '18-44'
                  when year(e.admit_ts) - p.birth_year < 65 then '45-64' when year(e.admit_ts) - p.birth_year < 80 then '65-79' else '80+' end as age_band,
             p.area_sanitaria
      from ep_clean e join org o using (organization_id) join pat p using (patient_key)
    ) to '{(PQ / "fct_admission_clean.parquet").as_posix()}' (format parquet)""")
    con.execute(f"""copy (
      select 'negative_stay' as kind, a.encounter_id, a.patient_key, a.organization_id, a.start_ts as ts from adm_base a where a.stop_ts < a.start_ts
      union all
      select 'post_mortem', a.encounter_id, a.patient_key, a.organization_id, a.start_ts from adm_base a join pat p using (patient_key)
        where p.deathdate is not null and cast(a.start_ts as date) > p.deathdate
      union all
      select 'frag_h3', b.encounter_id, b.patient_key, b.organization_id, b.start_ts from adm_base a join adm_base b
        on a.patient_key = b.patient_key and a.encounter_id <> b.encounter_id and b.start_ts > a.stop_ts and cast(b.start_ts as date) = cast(a.stop_ts as date)
        and b.start_ts - a.stop_ts <= interval 1 hour and a.organization_id = 'ORG05' and b.organization_id = 'ORG05' and a.start_ts >= timestamp '{MIGRATION}'
    ) to '{(PQ / "anomalies.parquet").as_posix()}' (format parquet)""")
    canon_dir = DIST / "canon"; canon_dir.mkdir(exist_ok=True)
    for f in ("fct_admission_clean", "anomalies"):  # CSV copies: DuckDB-WASM reads these reliably in every bundle
        con.execute(f"copy (select * from read_parquet('{(PQ / (f + '.parquet')).as_posix()}')) to '{(canon_dir / (f + '.csv')).as_posix()}' (header, delimiter ',')")
    import yaml
    rub = yaml.safe_load(open(ROOT.parent / "content" / "privacy_rubric.yaml", encoding="utf-8"))
    radar = ";".join(f"{c}={r['ok'][0]}" for c, r in rub["columns"].items())
    false_ids = [c["id"] for c in claims if not c["true"]]
    json.dump({"decision": None, "code": ";".join(false_ids)}, open(sol / "r1c_ada.json", "w"))
    json.dump({"decision": None, "code": radar}, open(sol / "r2a_radar.json", "w"))
    # BUILD_REPORT
    rate = con.execute("select o.name, count(*) altas, sum(is_readmit::int) reing, round(100.0*sum(is_readmit::int)/count(*),1) tasa from ep_clean e join org o using(organization_id) group by 1 order by 4 desc").df()
    tot = con.execute("select count(*) n, sum(is_readmit::int) r, round(100.0*sum(is_readmit::int)/count(*),2) t from ep_clean").fetchone()
    base = con.execute("select count(*) from ep_base").fetchone()[0]
    adm_by = con.execute("select o.name, count(*) from adm_clean a join org o using(organization_id) group by 1 order by 2").df()
    rep = [f"# BUILD REPORT (seed {SEED})\n", f"- Pacientes únicos: {ans['r2c_unique_patients']['value']} (filas en patients.csv: {n_rows})",
           f"- Encuentros únicos: {ans['r1b_unique_encounters']['value']}", f"- Episodios (modelo base): {base}; (limpio): {tot[0]}",
           f"- Reingresos 30d base: {ans['r3c_readmissions_base']['value']}; limpio: {tot[1]} → tasa limpia {tot[2]} %",
           f"- Registros excluidos R4C: {ans['r4c_excluded']['value']}", f"- Centro con mayor tasa (n≥30): {top}\n",
           "## Tasa por centro (modelo limpio)\n", rate.to_markdown(index=False) if hasattr(rate, "to_markdown") else rate.to_string(index=False),
           "\n## Objetivos 9.1\n", f"- Pacientes 8.000-10.000: {'OK' if 8000 <= ans['r2c_unique_patients']['value'] <= 10000 else 'FALLA'}",
           f"- Episodios 2.500-6.000: {'OK' if 2500 <= tot[0] <= 6000 else 'FALLA'}",
           f"- Tasa 9-14 %: {'OK' if 9 <= tot[2] <= 14 else 'FALLA'}",
           f"- ≥8 centros con ≥100 ingresos: {'OK' if (adm_by[adm_by.columns[1]] >= 100).sum() >= 8 else 'FALLA'}",
           "\n## Notas\n- Base clínica: Synthea (ADR 002), localizada a Galicia; reingresos naturales adelgazados y señal añadida hasta 9-14 %.\n- T12 (6 ingresos sin alta) añadida para la afirmación falsa de R1C.\n- Base = inpatient con stop_ts no nulo; limpio = base sin T4 (stop<start) ni T5 (inicio posterior al fallecimiento)."]
    open(ROOT / "BUILD_REPORT.md", "w", encoding="utf-8").write("\n".join(rep))
    print("\n".join(rep))


if __name__ == "__main__":
    main()
