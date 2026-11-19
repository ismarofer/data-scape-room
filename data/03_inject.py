"""Stage 3: deterministic trap injection (T1-T12), raw file export and canonical parquet export."""
import json, hashlib, unicodedata
import numpy as np
import pandas as pd
from common import *

rng = np.random.default_rng(SEED + 3)
tp = pd.read_parquet(WORK / "truth_patients.parquet")
te = pd.read_parquet(WORK / "truth_encounters.parquet")
tc = pd.read_parquet(WORK / "truth_conditions.parquet")
log = {}
used = set(te.encounter_id) | set(tp.patient_id)


def hid():
    while True:
        v = f"{int(rng.integers(0, 2**47)):012x}"
        if v not in used:
            used.add(v)
            return v


def strip_accents(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()


ssn_used = set(tp.ssn)


def new_ssn():
    while True:
        s = int(rng.integers(0, 1_000_000))
        v = f"999-{s // 10000:02d}-{s % 10000:04d}"
        if v not in ssn_used:
            ssn_used.add(v)
            return v


te["kind"] = te["kind"].astype(str)
te["t1_wrong_stop"] = pd.NaT
extra_pat = []
new_enc = []
protected = set()  # patients already touched

# ---- T6 duplicated patients (same SSN, other id, readmission episode moved to twin)
ep = te[te.encounter_class == "inpatient"].groupby(["patient_id", "ep_idx"]).agg(s=("start_ts", "min"), e=("stop_ts", "max")).reset_index()
ep["prev_e"] = ep.groupby("patient_id").e.shift()
cand = ep[(ep.ep_idx == 1) & ((ep.s.dt.normalize() - ep.prev_e.dt.normalize()).dt.days.between(2, 30))].patient_id
cand = cand[~cand.isin(tp[tp.deathdate.notna()].patient_id)].tolist()
t6 = list(rng.choice(cand, 12, replace=False))
t6_pairs = []
for pid in t6:
    row = tp[tp.patient_id == pid].iloc[0].to_dict()
    nid = hid()
    tw = dict(row)
    tw.update(patient_id=nid, first_name=strip_accents(row["first_name"]), last_name=row["last_name"].upper(),
              address=row["address"] + " 2ºB", drivers=None, passport=None)
    extra_pat.append(tw)
    moved = (te.patient_id == pid) & (te.ep_idx >= 1) & (te.encounter_class != "x")
    moved &= te.ep_key.notna()
    ids = te.loc[moved, "encounter_id"]
    te.loc[moved, "patient_id"] = nid
    tc.loc[tc.encounter_id.isin(ids), "patient_id"] = nid
    t6_pairs.append([pid, nid]); protected.add(pid)
log["T6"] = {"pairs": t6_pairs}

# ---- T7 false twins (same name+birth, different SSN; own episode 10 days after the original discharge)
pool = ep[(ep.ep_idx == 0) & ~ep.patient_id.isin(protected)].merge(tp[["patient_id", "deathdate", "birthdate"]], on="patient_id")
pool = pool[pool.deathdate.isna() & (pool.birthdate < pd.Timestamp("2000-01-01")) & (pool.e < pd.Timestamp("2023-06-01"))]
t7 = list(rng.choice(pool.patient_id.values, 3, replace=False))
t7_pairs = []
for pid in t7:
    row = tp[tp.patient_id == pid].iloc[0].to_dict()
    e0 = te[(te.patient_id == pid) & (te.ep_idx == 0) & (te.encounter_class == "inpatient")]
    nid = hid()
    tw = dict(row)
    tw.update(patient_id=nid, ssn=new_ssn(), address=row["address"].split(" ")[0] + " Nova 7", deathdate=pd.NaT, drivers=None, passport=None)
    extra_pat.append(tw)
    s = e0.stop_ts.max().normalize() + pd.Timedelta(days=10, hours=9)
    eid = hid()
    new_enc.append(dict(encounter_id=eid, patient_id=nid, organization_id=e0.organization_id.iloc[0], start_ts=s,
                        stop_ts=s + pd.Timedelta(days=3), encounter_class="inpatient", description="Ingreso hospitalario",
                        ep_key=f"{nid}-0", ep_idx=0, los=3, kind="normal", t1_wrong_stop=pd.NaT))
    tc.loc[len(tc)] = dict(patient_id=nid, encounter_id=eid, start=s.normalize(), stop=pd.NaT, code="J18", description="Neumonía")
    t7_pairs.append([pid, nid]); protected.add(pid)
log["T7"] = {"pairs": t7_pairs}
te = pd.concat([te, pd.DataFrame(new_enc)], ignore_index=True)

# ---- T8 H3 migration fragmentation
m = (te.organization_id == "ORG05") & (te.encounter_class == "inpatient") & (te.kind == "normal") & (te.start_ts >= pd.Timestamp(MIGRATION))
sel = te[m].index[rng.random(m.sum()) < 0.30]
frag = []
for i in sel:
    r = te.loc[i]
    mid = r.start_ts + (r.stop_ts - r.start_ts) * float(rng.uniform(0.3, 0.7))
    te.loc[i, "stop_ts"] = mid
    te.loc[i, "kind"] = "frag_h3"
    d = r.to_dict()
    d.update(encounter_id=hid(), start_ts=mid + pd.Timedelta(minutes=10), stop_ts=r.stop_ts, description="Reingreso mismo día", kind="frag_h3")
    frag.append(d)
te = pd.concat([te, pd.DataFrame(frag)], ignore_index=True)
log["T8"] = {"fragmented_admissions": len(sel), "from": MIGRATION, "org": "ORG05"}

# ---- T4 negative stays (23)
c4 = te[(te.kind == "normal") & (te.encounter_class == "inpatient") & te.stop_ts.notna() & (te.start_ts < pd.Timestamp("2023-10-01"))].index
t4 = rng.choice(c4, 23, replace=False)
for i in t4:
    te.loc[i, "stop_ts"] = te.loc[i, "start_ts"] - pd.Timedelta(hours=int(rng.integers(2, 120)))
    te.loc[i, "kind"] = "t4_negative"
log["T4"] = {"encounter_ids": te.loc[t4, "encounter_id"].tolist()}

# ---- T9 tiny clinic: 3 admissions, all readmissions (100 %)
one = te[(te.encounter_class == "inpatient") & (te.kind == "normal") & (te.ep_idx == 0)].groupby("patient_id").agg(n=("ep_idx", "size"), e=("stop_ts", "max"), org=("organization_id", "first"))
nmax = te[te.ep_key.notna()].groupby("patient_id").ep_idx.max()
one = one[(one.index.map(nmax) == 0) & (one.e < pd.Timestamp("2023-09-01")) & ~one.index.isin(t6 + t7) & one.index.isin(alive_ids := tp[tp.deathdate.isna()].patient_id)]
t9 = rng.choice(one.index.values, 3, replace=False)
t9rows = []
for pid in t9:
    s = one.loc[pid, "e"].normalize() + pd.Timedelta(days=int(rng.integers(5, 20)), hours=10)
    t9rows.append(dict(encounter_id=hid(), patient_id=pid, organization_id=CLINIC, start_ts=s, stop_ts=s + pd.Timedelta(days=3),
                       encounter_class="inpatient", description="Ingreso hospitalario", ep_key=None, ep_idx=-1, los=0, kind="t9_clinic", t1_wrong_stop=pd.NaT))
te = pd.concat([te, pd.DataFrame(t9rows)], ignore_index=True)
log["T9"] = {"clinic": CLINIC, "admissions": 3}

# ---- T5 encounters after death (9 patients, 12 encounters)
dead = tp[tp.deathdate.notna()].merge(te[te.encounter_class == "inpatient"].groupby("patient_id").organization_id.last().rename("org"), left_on="patient_id", right_index=True)
dead = dead[~dead.patient_id.isin(t6 + t7)]
dead = dead[dead.deathdate <= pd.Timestamp("2023-11-15")].sort_values("patient_id")
t5p = dead.iloc[rng.choice(len(dead), 9, replace=False)]
t5rows = []
for k, r in enumerate(t5p.itertuples()):
    offs = [int(rng.integers(3, 40))]
    if k < 3 and r.deathdate <= pd.Timestamp("2023-06-30"):
        offs.append(offs[0] + int(rng.integers(45, 90)))
    elif k < 3:
        k = 99
    for o in offs:
        s = r.deathdate + pd.Timedelta(days=o, hours=int(rng.integers(8, 20)))
        t5rows.append(dict(encounter_id=hid(), patient_id=r.patient_id, organization_id=r.org, start_ts=s,
                           stop_ts=s + pd.Timedelta(days=int(rng.integers(2, 6))), encounter_class="inpatient",
                           description="Ingreso hospitalario", ep_key=None, ep_idx=-1, los=0, kind="t5_postmortem", t1_wrong_stop=pd.NaT))
te = pd.concat([te, pd.DataFrame(t5rows)], ignore_index=True)
log["T5"] = {"patients": t5p.patient_id.tolist(), "encounters": len(t5rows)}

# ---- T12 open admissions (no discharge yet)
alive = tp[tp.deathdate.isna() & ~tp.patient_id.isin(t6 + t7)].patient_id.values
open_rows = []
for pid in rng.choice(alive, 6, replace=False):
    s = pd.Timestamp("2023-12-24") + pd.Timedelta(days=int(rng.integers(0, 6)), hours=int(rng.integers(0, 24)))
    open_rows.append(dict(encounter_id=hid(), patient_id=pid, organization_id=ORGS[int(rng.integers(0, 8))][0], start_ts=s, stop_ts=pd.NaT,
                          encounter_class="inpatient", description="Ingreso hospitalario (en curso)", ep_key=None, ep_idx=-1, los=0, kind="t12_open", t1_wrong_stop=pd.NaT))
te = pd.concat([te, pd.DataFrame(open_rows)], ignore_index=True)
log["T12"] = {"open_admissions": 6}

# ---- T2 truncated rows in H4 (17 background encounters, not referenced by conditions)
h4 = [o[0] for o in ORGS if o[2] == "H4"]
c2 = te[(te.kind == "background") & te.organization_id.isin(h4) & ~te.encounter_id.isin(tc.encounter_id)].index
t2 = rng.choice(c2, 17, replace=False)
truncated = te.loc[t2].copy()
te = te.drop(index=t2).reset_index(drop=True)
log["T2"] = {"rows": 17}

# ---- T1 resend H2 with 214 corrections of discharge date
h2 = [o[0] for o in ORGS if o[2] == "H2"]
c1 = te[(te.kind == "normal") & (te.encounter_class == "inpatient") & te.organization_id.isin(h2)].index
t1 = rng.choice(c1, 214, replace=False)
for i in t1:
    te.loc[i, "t1_wrong_stop"] = te.loc[i, "stop_ts"] + pd.Timedelta(days=int(rng.integers(2, 10)))
log["T1"] = {"corrections": 214, "h2_rows": int(te.organization_id.isin(h2).sum())}

for c in ("start_ts", "stop_ts", "t1_wrong_stop"):
    te[c] = pd.to_datetime(te[c]).dt.floor("min")
te = te.sort_values(["start_ts", "encounter_id"]).reset_index(drop=True)
tp_all = pd.concat([tp.drop(columns=["age_tmp", "chronic_n"], errors="ignore"), pd.DataFrame(extra_pat).drop(columns=["age_tmp", "chronic_n"], errors="ignore")], ignore_index=True)
tp_all["twin_of"] = None

# ================= RAW EXPORT =================
FEED = {o[0]: o[2] for o in ORGS}
te["feed"] = te.organization_id.map(FEED)


def case_noise(s):
    r = rng.random(len(s))
    out = s.copy()
    out[r < 0.05] = out[r < 0.05].str.capitalize()
    out[(r >= 0.05) & (r < 0.07)] = out[(r >= 0.05) & (r < 0.07)].str.upper()
    return out


def feed_frame(df, loaded, wrong=False, h3=False):
    d = pd.DataFrame({"encounter_id": df.encounter_id, "patient_id": df.patient_id, "organization_id": df.organization_id,
                      "start_ts": df.start_ts, "stop_ts": (df.t1_wrong_stop.fillna(df.stop_ts) if wrong else df.stop_ts),
                      "encounter_class": df.encounter_class, "description": df.description, "loaded_at": loaded})
    d["encounter_class"] = case_noise(d.encounter_class)
    f = "%d/%m/%Y %H:%M" if h3 else "%Y-%m-%d %H:%M:%S"
    d["start_ts"] = d.start_ts.dt.strftime(f)
    d["stop_ts"] = d.stop_ts.dt.strftime(f).fillna("")
    return d


manifest = {"files": {}}
for f in ("H1", "H2", "H3", "H4"):
    sub = te[te.feed == f]
    d = feed_frame(sub, "2024-01-15", wrong=(f == "H2"), h3=(f == "H3"))
    name = f"encounters_{f}.csv"
    if f == "H3":
        d.to_csv(RAW / name, index=False, sep=";", encoding="latin-1")
    else:
        d.to_csv(RAW / name, index=False, encoding="utf-8")
    n_rej = 0
    if f == "H4":
        with open(RAW / name, "a", encoding="utf-8", newline="") as fh:
            for r in truncated.itertuples():
                line = f"{r.encounter_id},{r.patient_id},{r.organization_id},{r.start_ts:%Y-%m-%d %H:%M:%S}"
                fh.write(line[: int(rng.integers(len(r.encounter_id) + 5, len(line)))] + "\n")
        n_rej = 17
    manifest["files"][name] = dict(rows_loaded=len(d), rows_rejected=n_rej)
sub = te[te.feed == "H2"]
feed_frame(sub, "2024-02-05").to_csv(RAW / "encounters_H2_reenvio.csv", index=False)
manifest["files"]["encounters_H2_reenvio.csv"] = dict(rows_loaded=len(sub), rows_rejected=0)

pcols = ["patient_id", "ssn", "drivers", "passport", "prefix", "first_name", "last_name", "marital", "birthdate", "deathdate",
         "birthplace", "address", "city", "state", "county", "postal_code", "gender", "lat", "lon"]
pout = tp_all[pcols].copy()
for c in ("birthdate", "deathdate"):
    pout[c] = pout[c].dt.strftime("%Y-%m-%d")
pout.sample(frac=1, random_state=SEED).to_csv(RAW / "patients.csv", index=False, encoding="utf-8")
manifest["files"]["patients.csv"] = dict(rows_loaded=len(pout), rows_rejected=0)
orgs = pd.DataFrame([dict(organization_id=o[0], name=o[1], feed=o[2], city=("Vigo" if o[0] == "ORG09" else "Galicia")) for o in ORGS])
orgs.to_csv(RAW / "organizations.csv", index=False, encoding="utf-8")
manifest["files"]["organizations.csv"] = dict(rows_loaded=len(orgs), rows_rejected=0)
tcw = tc[tc.encounter_id.isin(te.encounter_id)].copy()
for c in ("start", "stop"):
    tcw[c] = tcw[c].dt.strftime("%Y-%m-%d")
tcw.to_csv(RAW / "conditions.csv", index=False, encoding="utf-8")
manifest["files"]["conditions.csv"] = dict(rows_loaded=len(tcw), rows_rejected=0)

# ================= CANONICAL PARQUET =================
pk = lambda ssn: hashlib.sha256(f"ca-salt:{ssn}".encode()).hexdigest()[:16]
pid2key = dict(zip(tp_all.patient_id, tp_all.ssn.map(pk)))
pc = tp_all.assign(patient_key=tp_all.ssn.map(pk)).drop_duplicates("patient_key")
area = {"15": "Área Sanitaria Norte", "27": "Área Sanitaria Lugo", "32": "Área Sanitaria Ourense", "36": "Área Sanitaria Sur"}
pat_c = pd.DataFrame({"patient_key": pc.patient_key, "gender": pc.gender, "birth_year": pc.birthdate.dt.year, "deathdate": pc.deathdate,
                      "area_sanitaria": pc.postal_code.str[:2].map(area)})
enc_c = te.assign(patient_key=te.patient_id.map(pid2key))[["encounter_id", "patient_key", "organization_id", "start_ts", "stop_ts", "encounter_class", "description", "feed"]]
cond_c = tcw.assign(patient_key=tcw.patient_id.map(pid2key))[["patient_key", "encounter_id", "start", "code", "description"]]
pat_c.to_parquet(PQ / "patients_canonical.parquet"); enc_c.to_parquet(PQ / "encounters_canonical.parquet")
cond_c.to_parquet(PQ / "conditions_canonical.parquet"); orgs.to_parquet(PQ / "organizations.parquet")
te.to_parquet(WORK / "final_truth_encounters.parquet")

def ids_checksum(ids):
    return hashlib.sha256(",".join(sorted(ids)).encode()).hexdigest()[:12]

log["manifest"] = manifest
json.dump(log, open(DIST / "inject_log.json", "w"), indent=1, default=str)
json.dump(manifest["files"], open(WORK / "expected_files.json", "w"), indent=1)  # private: expected counts
sheet = {"description": "Entrega de ficheros del hospital (datos ficticios).", "files": {
    n: {"delimiter": ";" if "H3" in n else ",", "encoding": "UTF-8",  # H3 sheet says UTF-8 but the file is latin-1 (intentional)
        "date_format": "dd/MM/yyyy HH:mm" if "H3" in n else ("yyyy-MM-dd HH:mm:ss" if n.startswith("encounters") else None)}
    for n in manifest["files"]}}
json.dump(sheet, open(RAW / "manifest.json", "w"), indent=1, ensure_ascii=False)
print({k: (v if not isinstance(v, dict) else len(v)) for k, v in log.items()})
print(len(te), "encounters;", len(tp_all), "patient rows;", len(pat_c), "unique patients")
