"""Stage 1 (Synthea): read Synthea CSV output (data/synthea/out_*/csv), filter, localize to Galicia and
add the readmission signal. Produces the same 'truth world' tables as the pure-python fallback (01_generate.py)."""
import os, glob, re
import numpy as np
import pandas as pd
from common import *
from cond_es import COND_ES, CHRONIC_SET

rng = np.random.default_rng(SEED + 1)
N_TARGET = int(os.environ.get("N_PAT", 9000))
THIN = float(os.environ.get("THIN", 0.65))
R_READ = float(os.environ.get("R_READ", 0.06))  # prob. a synthetic <=30d readmission follows an episode
CUT = pd.Timestamp(CUT_DATE) if (CUT_DATE := globals().get("CUT")) else pd.Timestamp("2023-12-31")
START = pd.Timestamp(PERIOD_START)
SENSITIVE = re.compile(r"rehab|detox|overdose|opioid|HIV|suicid|self.harm|miscarriage|abortion|depress|schizo|bipolar|psychosis|"
                       r"sexually|gonorrh|chlamyd|syphilis|addiction|substance", re.I)  # social findings are dropped, not patient-excluded (ADR 002)

FIRST_F = "María Carmen Ana Laura Marta Lucía Paula Sara Elena Rosa Noelia Uxía Antía Iria Julia Carla Sofía Nerea Alba Lía Xiana Maruxa Pilar Beatriz Raquel Cristina Eva Olalla Sabela Inés".split()
FIRST_M = "José Antonio Manuel Francisco Luis Javier Carlos Miguel Pedro Xoán Xosé Anxo Brais Iago Hugo Martín Pablo Daniel Alejandro Rubén Diego Marcos Santiago Fernando Andrés Óscar Breixo Damián Suso Roi".split()
LAST = "Fernández Rodríguez López Pérez González Vázquez Louro Seoane Castro Varela Lorenzo Rivas Freire Cabanas Barreiro Souto Vilas Ferreiro Otero Mosquera Taboada Lamas Rey Neira Santos Piñeiro Outeiro Couto Dopazo Cances Figueiras Paz Montes Lago Pazos Iglesias Veiga Penas Bouzas Calvo Mouriño Rial Táboas Carballo Dorrego Garrido Amoedo Barral Bugallo Canosa Dios Eirín Gándara Lema Meijide Nogueira Pedrosa Quintela Sampedro Teijeiro Villar".split()
CITIES = [("A Coruña", "15"), ("Santiago de Compostela", "15"), ("Ferrol", "15"), ("Lugo", "27"), ("Monforte", "27"), ("Ourense", "32"), ("Verín", "32"), ("Pontevedra", "36"), ("Vigo", "36"), ("Cangas", "36"), ("Noia", "15"), ("Ribeira", "15")]
STREETS = "Rúa do Cantón|Rúa Nova|Avenida da Mariña|Rúa do Souto|Praza do Concello|Camiño Real|Rúa das Flores|Avenida de Galicia|Rúa do Miño|Rúa da Ponte|Travesía do Mar|Rúa dos Carballos".split("|")
CLASS_ES = {"inpatient": "Ingreso hospitalario", "emergency": "Atención en urgencias", "ambulatory": "Consulta externa",
            "wellness": "Revisión de salud", "outpatient": "Procedimiento ambulatorio", "urgentcare": "Atención urgente"}
mod = {o[0]: o[4] for o in ORGS}
ow = np.array([o[3] for o in ORGS[:8]]); ow = ow / ow.sum()


def load(name, **kw):
    dirs = sorted(glob.glob(str(ROOT / "synthea" / "out_[0-9]*" / "csv")))
    assert dirs, "no Synthea output found; run data/synthea/run_synthea.sh"
    return pd.concat([pd.read_csv(f"{d}/{name}.csv", **kw) for d in dirs], ignore_index=True)


def build():
    pat = load("patients", parse_dates=["BIRTHDATE", "DEATHDATE"])
    enc = load("encounters", parse_dates=["START", "STOP"])
    con = load("conditions", parse_dates=["START", "STOP"])
    enc["START"] = enc.START.dt.tz_localize(None); enc["STOP"] = enc.STOP.dt.tz_localize(None)
    enc = enc[enc.ENCOUNTERCLASS.isin(CLASS_ES) & (enc.START >= START) & (enc.START <= CUT)]
    # drop patients with sensitive conditions/encounters or dead before the period
    bad = set(con[con.DESCRIPTION.str.contains(SENSITIVE)].PATIENT) | set(enc[enc.DESCRIPTION.fillna("").str.contains(SENSITIVE) | enc.REASONDESCRIPTION.fillna("").str.contains(SENSITIVE)].PATIENT)
    pat = pat[~pat.Id.isin(bad) & (pat.DEATHDATE.isna() | ((pat.DEATHDATE >= START) & (pat.DEATHDATE <= pd.Timestamp("2023-11-15"))))]
    enc = enc[enc.PATIENT.isin(pat.Id)]
    inp = enc[enc.ENCOUNTERCLASS == "inpatient"]
    # keep files manageable: emergencies right before an admission + at most 6 other encounters per patient
    nonin = enc[enc.ENCOUNTERCLASS != "inpatient"].sample(frac=1, random_state=SEED)
    nonin = nonin.groupby("PATIENT").head(6)
    enc = pd.concat([inp, nonin]).sort_values(["PATIENT", "START"])
    inp_pat = set(inp.PATIENT)
    others = sorted(set(enc.PATIENT) - inp_pat)
    take = max(0, N_TARGET - len(inp_pat))
    keep = inp_pat | set(rng.choice(others, min(take, len(others)), replace=False))
    pat = pat[pat.Id.isin(keep)].sort_values("Id").reset_index(drop=True)
    # Synthea's natural 30-day readmission rate (~16 %) is above the 9-14 % target: thin natural readmissions
    drop = []
    ii0 = enc[enc.ENCOUNTERCLASS == "inpatient"].sort_values(["PATIENT", "START", "Id"])
    for pid, g in ii0.groupby("PATIENT", sort=False):
        # simple episode grouping by the same rule, then sequential thinning
        grp = []; prev_stop = None
        for r in g.itertuples():
            st = r.STOP if pd.notna(r.STOP) and r.STOP >= r.START else r.START + pd.Timedelta(hours=12)
            if prev_stop is None or r.START > prev_stop + pd.Timedelta(days=1):
                grp.append(dict(ids=[r.Id], s=r.START, e=st))
            else:
                grp[-1]["ids"].append(r.Id); grp[-1]["e"] = max(grp[-1]["e"], st)
            prev_stop = st
        last = None
        for ep in grp:
            if last is not None and 2 <= (ep["s"].normalize() - last.normalize()).days <= 30 and rng.random() < THIN:
                drop += ep["ids"]
            else:
                last = ep["e"]
    enc = enc[~enc.Id.isin(drop)]
    enc = enc[enc.PATIENT.isin(keep)]
    con = con[con.PATIENT.isin(keep) & con.DESCRIPTION.isin(COND_ES)]

    # ---- patients (localized)
    out = []
    for r in pat.itertuples():
        g = r.GENDER
        first = rng.choice(FIRST_F if g == "F" else FIRST_M)
        l1, l2 = rng.choice(LAST, 2, replace=False)
        city, pc = CITIES[rng.integers(len(CITIES))]
        adult = (pd.Timestamp("2023-12-31") - r.BIRTHDATE).days >= 18 * 365
        out.append(dict(patient_id=r.Id, ssn=r.SSN, drivers=(f"G{int(rng.integers(10**7, 10**8))}" if adult else None),
                        passport=(f"X{int(rng.integers(10**7, 10**8))}" if rng.random() < 0.3 else None),
                        prefix=(("Sra." if g == "F" else "Sr.") if adult else None), first_name=first, last_name=f"{l1} {l2}",
                        marital=(str(rng.choice(["M", "S", "D", "W"])) if adult else None), birthdate=r.BIRTHDATE.normalize(),
                        deathdate=r.DEATHDATE, birthplace=f"{rng.choice([c for c, _ in CITIES])}, Galicia",
                        address=f"{rng.choice(STREETS)} {int(rng.integers(1, 120))}", city=city, state="Galicia",
                        county={"15": "A Coruña", "27": "Lugo", "32": "Ourense", "36": "Pontevedra"}[pc],
                        postal_code=f"{pc}{int(rng.integers(0, 999)):03d}", gender=g,
                        lat=round(float(rng.uniform(41.9, 43.7)), 5), lon=round(float(rng.uniform(-9.2, -6.8)), 5)))
    pat = pd.DataFrame(out)
    # Synthea SSNs can collide by chance: make them unique (duplicates are injected deliberately in T6)
    seen = set(); 
    for ix, v in pat.ssn.items():
        while v in seen:
            n = int(rng.integers(0, 1_000_000)); v = f"999-{n // 10000:02d}-{n % 10000:04d}"
        seen.add(v); pat.at[ix, "ssn"] = v
    chronic_n = con[con.DESCRIPTION.isin(CHRONIC_SET) & con.STOP.isna()].groupby("PATIENT").DESCRIPTION.nunique()
    pat["chronic_n"] = pat.patient_id.map(chronic_n).fillna(0)

    # ---- encounters: centres, Spanish descriptions
    home = {p: ORGS[int(rng.choice(8, p=ow))][0] for p in pat.patient_id}
    pick = lambda h: h if rng.random() < 0.85 else ORGS[int(rng.choice(8, p=ow))][0]
    rows = []
    for r in enc.itertuples():
        stop = r.STOP if pd.notna(r.STOP) and r.STOP >= r.START else r.START + pd.Timedelta(minutes=15)
        rows.append(dict(encounter_id=r.Id, patient_id=r.PATIENT, organization_id=pick(home[r.PATIENT]), start_ts=r.START, stop_ts=stop,
                         encounter_class=r.ENCOUNTERCLASS, description=CLASS_ES[r.ENCOUNTERCLASS], kind="normal" if r.ENCOUNTERCLASS == "inpatient" else "background"))
    e = pd.DataFrame(rows)
    # inpatient stays: at least 12 h; merge Synthea overlapping rows into one stay is left to the episode rule
    i = e.encounter_class == "inpatient"
    e.loc[i, "stop_ts"] = np.maximum(e.loc[i, "stop_ts"], e.loc[i, "start_ts"] + pd.Timedelta(hours=12))
    # ---- synthetic readmission signal (T10-style cloning of plausible stays)
    cn = pat.set_index("patient_id").chronic_n.to_dict()
    new = []
    last_by_pat = e[i].sort_values("start_ts").groupby("patient_id").tail(1)
    inp_sorted = e[i].sort_values(["patient_id", "start_ts"])
    # one readmission chance per Synthea episode (last stay of each patient only to avoid collisions)
    for r in last_by_pat.itertuples():
        los = max(1, round((r.stop_ts - r.start_ts).total_seconds() / 86400))
        p = R_READ + mod[r.organization_id] + (0.05 if (cn.get(r.patient_id, 0) >= 3 and los <= 2) else 0.0)
        if rng.random() < p:
            s = r.stop_ts.normalize() + pd.Timedelta(days=int(rng.integers(2, 31)), hours=int(rng.integers(0, 24)))
            dd = pat.set_index("patient_id").deathdate.get(r.patient_id)
            if s > CUT - pd.Timedelta(days=7) or (pd.notna(dd) and s.normalize() > dd):
                continue
            L = max(1, int(rng.geometric(0.3)))
            new.append(dict(encounter_id=f"{r.encounter_id[:-4]}{int(rng.integers(0, 16**4)):04x}", patient_id=r.patient_id, organization_id=r.organization_id,
                            start_ts=s, stop_ts=s + pd.Timedelta(hours=max(12, L * 24 - int(rng.integers(0, 12)))), encounter_class="inpatient",
                            description=CLASS_ES["inpatient"], kind="normal"))
    e = pd.concat([e, pd.DataFrame(new)], ignore_index=True)
    # ---- legit internal transfers (7 %)
    ip = e[(e.encounter_class == "inpatient")]
    sel = ip.index[rng.random(len(ip)) < 0.07]
    split = []
    for ix in sel:
        r = e.loc[ix]
        if (r.stop_ts - r.start_ts) < pd.Timedelta(hours=30):
            continue
        mid = (r.start_ts + (r.stop_ts - r.start_ts) * float(rng.uniform(0.3, 0.7))).floor("min")
        e.loc[ix, ["stop_ts", "kind"]] = [mid, "legit_split"]
        d = r.to_dict(); d.update(encounter_id=f"{r.encounter_id[:-4]}{int(rng.integers(0, 16**4)):04x}", start_ts=mid + min(pd.Timedelta(hours=int(rng.integers(1, 20))), (r.stop_ts - mid) / 2),
                                  description="Traslado interno / continuación", kind="legit_split")
        split.append(d)
    e = pd.concat([e, pd.DataFrame(split)], ignore_index=True).drop_duplicates("encounter_id")
    # ---- episode keys (same rule as the normative definition)
    e = e.sort_values(["patient_id", "start_ts", "encounter_id"]).reset_index(drop=True)
    e["ep_key"] = None; e["ep_idx"] = -1; e["los"] = 0
    ii = e[e.encounter_class == "inpatient"].copy()
    ii["prev_stop"] = ii.groupby("patient_id").stop_ts.shift()
    ii["new"] = ii.prev_stop.isna() | (ii.start_ts > ii.prev_stop + pd.Timedelta(days=1))
    ii["ep_idx"] = ii.groupby("patient_id").new.cumsum() - 1
    e.loc[ii.index, "ep_idx"] = ii.ep_idx
    e.loc[ii.index, "ep_key"] = ii.patient_id + "-" + ii.ep_idx.astype(str)
    e.loc[ii.index, "los"] = ((ii.stop_ts - ii.start_ts).dt.total_seconds() / 86400).round().astype(int)

    # ---- conditions (curated, Spanish); attach to patient's first retained encounter if encounter was filtered out
    first = e.groupby("patient_id").encounter_id.first()
    ids = set(e.encounter_id)
    c = pd.DataFrame(dict(patient_id=con.PATIENT.values, encounter_id=[x if x in ids else first.get(p) for x, p in zip(con.ENCOUNTER, con.PATIENT)],
                          start=con.START.dt.tz_localize(None).dt.normalize().values, stop=con.STOP.dt.tz_localize(None).values,
                          code=con.CODE.astype(str).values, description=[COND_ES[d] for d in con.DESCRIPTION]))
    c = c[c.encounter_id.notna()]
    return pat, e, c


if __name__ == "__main__":
    pat, enc, cond = build()
    pat.to_parquet(WORK / "truth_patients.parquet"); enc.to_parquet(WORK / "truth_encounters.parquet"); cond.to_parquet(WORK / "truth_conditions.parquet")
    print(len(pat), len(enc), (enc.encounter_class == "inpatient").sum(), len(cond), pat.deathdate.notna().sum())
