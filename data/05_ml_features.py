"""R6 «Laboratorio de riesgo»: tabla ml_features (una fila por alta índice).

Etiqueta: el paciente vuelve a ingresar a los 2-30 días de ESTA alta (= el episodio siguiente del mismo paciente es un reingreso a 30 días).
Variables conocidas al alta: edad (tramo), condiciones previas, estancia, ingresos previos 12 m, centro, sexo.
Variable trampa (fuga de datos): dias_hasta_siguiente_ingreso (solo se sabe DESPUÉS). Lleva algo de ruido: el AUC con ella sale ~0,99, no 1.
Señal moderada: los datos sintéticos no traen relación clínica realista; se desplaza (sin tocar la etiqueta) el nº de condiciones y la estancia
de los casos que reingresan para que un modelo honesto encuentre algo (AUC ~0,70). Se declara en el informe final: «datos sintéticos modificados».
Determinista (SEED=20261117). Salida: data/dist/ml/ml_features.csv
"""
import csv
import random
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
OUT = DIST / "ml"
OUT.mkdir(parents=True, exist_ok=True)
SEED = 20261117

con = duckdb.connect()
rows = con.execute(
    f"""
    with ep as (
      select episode_id, patient_key, organization_id, admit_ts::timestamp as admit, discharge_ts::timestamp as disch, age_band,
             (is_readmission_30d::varchar = 'true') as re
      from read_csv_auto('{(DIST / "canon" / "fct_admission_clean.csv").as_posix()}', header=true)
    ), w as (
      select *,
        lead(admit) over (partition by patient_key order by admit) as nxt_admit,
        lead(re) over (partition by patient_key order by admit) as nxt_re,
        (select count(*) from ep p where p.patient_key = e.patient_key and p.admit < e.admit and p.admit >= e.admit - interval 365 day) as previos
      from ep e
    ), cond as (
      select c.patient_key, count(distinct c.code) filter (where c.start::date <= w.disch::date) as n, w.episode_id
      from read_parquet('{(DIST / "parquet" / "conditions_canonical.parquet").as_posix()}') c join w using (patient_key)
      group by c.patient_key, w.episode_id
    )
    select w.episode_id, w.age_band, coalesce(cond.n, 0) as condiciones,
           round(date_diff('minute', w.admit, w.disch) / 1440.0, 2) as estancia, w.previos, w.organization_id,
           coalesce(p.gender, 'F') as sexo,
           case when w.nxt_admit is null then null else date_diff('day', w.disch::date, w.nxt_admit::date) end as dias,
           case when coalesce(w.nxt_re, false) then 1 else 0 end as y
    from w left join cond on cond.episode_id = w.episode_id left join read_parquet('{(DIST / "parquet" / "patients_canonical.parquet").as_posix()}') p on p.patient_key = w.patient_key
    order by w.episode_id
    """
).fetchall()

rng = random.Random(SEED)
BAND = {"0-17": "0-17", "18-44": "18-44", "45-64": "45-64", "65-79": "65-79", "80+": "80+"}
out = []
for ep, band, cond, los, prev, org, sex, dias, y in rows:
    cond = min(int(cond), 12)
    los = float(los)
    if y:  # moderate injected signal (labels untouched)
        if rng.random() < 0.7:
            cond += rng.choice([1, 2, 3])
        los = round(los * rng.uniform(1.3, 2.2), 2)
    # leak: days until the NEXT admission (noisy), or 9999 when there is none
    leak = 9999 if dias is None else max(0, int(round(dias + rng.gauss(0, 3))))
    out.append([ep, BAND.get(band, band), cond, los, int(prev), org, "M" if str(sex).upper().startswith("M") else "F", leak, y])

with open(OUT / "ml_features.csv", "w", newline="", encoding="utf8") as f:
    w = csv.writer(f)
    w.writerow(["episode_id", "edad", "cronicas", "estancia", "previos", "centro", "sexo", "dias_hasta_siguiente_ingreso", "reingreso_30d"])
    w.writerows(out)
print(f"ml_features: {len(out)} filas, reingresos {sum(r[-1] for r in out)} ({sum(r[-1] for r in out) / len(out):.1%})")
