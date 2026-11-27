"""Data tests: every trap and every answer, verified with two implementations (DuckDB SQL vs pandas) and from raw files."""
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import importlib, io
import numpy as np, pandas as pd, pytest
from common import *

A = importlib.import_module("04_answers")
ANS = json.load(open(DIST / "answers.json", encoding="utf-8"))
LOG = json.load(open(DIST / "inject_log.json", encoding="utf-8"))


def pandas_episodes(enc, pat, clean):
    d = enc[(enc.encounter_class == "inpatient") & enc.stop_ts.notna()].merge(pat[["patient_key", "deathdate"]], on="patient_key")
    if clean:
        d = d[(d.stop_ts >= d.start_ts) & (d.deathdate.isna() | (d.start_ts.dt.normalize() <= d.deathdate))]
    d = d.sort_values(["patient_key", "start_ts", "encounter_id"]).copy()
    d["prev_stop"] = d.groupby("patient_key").stop_ts.shift()
    d["new"] = d.prev_stop.isna() | (d.start_ts > d.prev_stop + pd.Timedelta(days=1))
    d["ep"] = d.groupby("patient_key").new.cumsum()
    e = d.groupby(["patient_key", "ep"]).agg(admit=("start_ts", "min"), disch=("stop_ts", "max"), org=("organization_id", "first")).reset_index()
    e["prev"] = e.groupby("patient_key").disch.shift()
    gap = (e.admit.dt.normalize() - e.prev.dt.normalize()).dt.days
    e["readmit"] = gap.between(2, 30)
    return e


@pytest.fixture(scope="module")
def tables():
    return (pd.read_parquet(PQ / "encounters_canonical.parquet"), pd.read_parquet(PQ / "patients_canonical.parquet"))


def test_readmissions_two_implementations(tables):
    enc, pat = tables
    assert int(pandas_episodes(enc, pat, False).readmit.sum()) == ANS["r3c_readmissions_base"]["value"]


def test_top_center_two_implementations(tables):
    enc, pat = tables
    e = pandas_episodes(enc, pat, True)
    g = e.groupby("org").agg(n=("readmit", "size"), r=("readmit", "sum"))
    g = g[g.n >= 30]
    top = (g.r / g.n).idxmax()
    names = dict((o[0], o[1]) for o in ORGS)
    assert normalize(A.SHORT[top]) == ANS["r5c_top_center"]["normalized"]
    rates = (g.r / g.n).sort_values()
    assert rates.iloc[-1] - rates.iloc[-2] >= 0.02, "top center must be unambiguous"


def test_excluded_two_implementations(tables):
    enc, pat = tables
    d = enc[(enc.encounter_class == "inpatient") & enc.stop_ts.notna()].merge(pat[["patient_key", "deathdate"]], on="patient_key")
    neg = (d.stop_ts < d.start_ts).sum()
    pm = (d.deathdate.notna() & (d.start_ts.dt.normalize() > d.deathdate)).sum()
    assert neg == 23 and neg + pm == ANS["r4c_excluded"]["value"]


FMT = {"encounters_H1.csv": (",", "utf-8"), "encounters_H2.csv": (",", "latin-1"), "encounters_H2_reenvio.csv": (",", "utf-8"),
       "encounters_H3.csv": (";", "latin-1"), "encounters_H4.csv": ("\t", "utf-8")}


def read_raw():
    frames = []
    rej = {}
    for f in ("H1", "H2", "H3", "H4", "H2_reenvio"):
        p = RAW / f"encounters_{f}.csv"
        h3 = f == "H3"
        sep, enc = FMT[p.name]
        df = pd.read_csv(p, sep=sep, encoding=enc, dtype=str, on_bad_lines="skip")
        fmt = "%d/%m/%Y %H:%M" if h3 else "%Y-%m-%d %H:%M:%S"
        df = df[df.encounter_class.notna() & df.loaded_at.notna()].copy()  # truncated rows are rejected
        df["start_ts"] = pd.to_datetime(df.start_ts, format=fmt)
        df["stop_ts"] = pd.to_datetime(df.stop_ts, format=fmt)
        df["loaded_at"] = pd.to_datetime(df.loaded_at)
        df["encounter_class"] = df.encounter_class.str.lower()
        frames.append(df); rej[f] = len(df)
    return pd.concat(frames, ignore_index=True), rej


def test_raw_pipeline_matches_canonical(tables):
    enc, pat = tables
    raw, _ = read_raw()
    latest = raw.sort_values("loaded_at").drop_duplicates("encounter_id", keep="last")
    assert len(latest) == ANS["r1b_unique_encounters"]["value"] == len(enc)
    m = latest.merge(enc, on="encounter_id", suffixes=("_r", "_c"))
    assert len(m) == len(enc)
    assert (m.stop_ts_r.fillna(pd.Timestamp(0)) == m.stop_ts_c.fillna(pd.Timestamp(0))).all(), "latest-by-id must equal canonical"
    p = pd.read_csv(RAW / "patients.csv", dtype=str)
    assert p.ssn.nunique() == ANS["r2c_unique_patients"]["value"] == len(pat)


def test_t1_resend_corrections():
    h2 = pd.read_csv(RAW / "encounters_H2.csv", dtype=str, encoding="latin-1")
    re = pd.read_csv(RAW / "encounters_H2_reenvio.csv", dtype=str)
    m = h2.merge(re, on="encounter_id", suffixes=("_a", "_b"))
    assert len(h2) == len(re) == len(m)
    assert (m.stop_ts_a.fillna("") != m.stop_ts_b.fillna("")).sum() == 214


def test_t2_truncated_rows():
    lines = open(RAW / "encounters_H4.csv", encoding="utf-8").read().splitlines()
    bad = [l for l in lines[1:] if len(l.split("	")) != 8]
    assert len(bad) == 17


def test_t3_h3_format_and_encoding():
    b = open(RAW / "encounters_H3.csv", "rb").read()
    with pytest.raises(UnicodeDecodeError):
        b.decode("utf-8")
    head = b.decode("latin-1").splitlines()
    assert ";" in head[0] and "/" in head[1]


def test_t6_duplicate_patients():
    p = pd.read_csv(RAW / "patients.csv", dtype=str)
    dup = p[p.ssn.duplicated(keep=False)]
    assert dup.ssn.nunique() == 12 and len(dup) == 24


def test_t7_false_twins():
    p = pd.read_csv(RAW / "patients.csv", dtype=str)
    g = p.groupby(["first_name", "last_name", "birthdate"]).ssn.nunique()
    assert (g > 1).sum() >= 3


def test_t9_small_clinic(tables):
    enc, pat = tables
    e = pandas_episodes(enc, pat, True)
    c = e[e.org == CLINIC]
    assert len(c) == 3 and c.readmit.all()


def test_t8_fragmentation_only_h3_after_migration(tables):
    te = pd.read_parquet(WORK / "final_truth_encounters.parquet")
    f = te[te.kind == "frag_h3"]
    assert len(f) > 20 and (f.organization_id == "ORG05").all() and (f.start_ts >= pd.Timestamp(MIGRATION)).all()


def test_targets_9_1(tables):
    enc, pat = tables
    e = pandas_episodes(enc, pat, True)
    assert 8000 <= len(pat) <= 10000
    assert 2500 <= len(e) <= 6000
    assert 0.09 <= e.readmit.mean() <= 0.14
    adm = enc[enc.encounter_class == "inpatient"].groupby("organization_id").size()
    assert (adm >= 100).sum() >= 8


def test_r1c_claims_two_false():
    claims = ANS["r1c_claims"]["value"]
    assert sum(not c["true"] for c in claims) == 2 and len(claims) == 6


def test_public_answers_leak_nothing():
    pub = open(DIST / "answers.public.json", encoding="utf-8").read()
    for k, v in ANS.items():
        if isinstance(v["value"], (int, str)) and k != "p0_tutorial" and len(str(v["value"])) > 2:
            assert str(v["value"]) not in pub or len(str(v["value"])) < 4


def test_no_sensitive_conditions():
    deny = open(ROOT / "denylist_conditions.txt", encoding="utf-8").read().lower().split()
    c = pd.read_csv(RAW / "conditions.csv", sep="	", encoding="latin-1")
    import re
    text = " ".join(c.description.unique()).lower()
    assert not any(re.search(rf"\b{w}\b", text) for w in deny)


def test_determinism():
    # same seed -> same answer hashes (re-run 04 on the same parquet)
    con, b = A.connect()
    assert con.execute(b["r2c_unique_patients"]).fetchone()[0] == ANS["r2c_unique_patients"]["value"]
