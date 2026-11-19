"""Shared constants for the data pipeline (deterministic, no Java)."""
import os, pathlib, hashlib, unicodedata
ROOT = pathlib.Path(__file__).resolve().parent
WORK = ROOT / "work"; DIST = ROOT / "dist"; RAW = DIST / "raw"; PQ = DIST / "parquet"
for d in (WORK, RAW, PQ):
    d.mkdir(parents=True, exist_ok=True)
def _load_env():
    f = ROOT.parent / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()
SEED = int(os.environ.get("SEED", 20261117))
SALT = os.environ.get("ANSWER_SALT", "dev-salt-change-me")
PERIOD_START = "2017-01-01"
CUT = "2023-12-31"
MIGRATION = "2019-03-14"
# org_id, name, feed, weight, readmit_modifier
ORGS = [
    ("ORG01", "Hospital Universitario Costa Atlántica (HUCA-F)", "H1", 0.22, 0.00),
    ("ORG02", "Hospital Comarcal Ría Norte", "H1", 0.10, -0.01),
    ("ORG03", "Hospital Santa Eira", "H2", 0.12, 0.01),
    ("ORG04", "Hospital da Mariña Alta-F", "H2", 0.09, -0.02),
    ("ORG05", "Complexo Hospitalario do Miño-F", "H3", 0.14, 0.01),
    ("ORG06", "Hospital Terra de Montes-F", "H4", 0.08, -0.01),
    ("ORG07", "Hospital Val do Sar-F", "H4", 0.11, 0.00),
    ("ORG08", "Hospital Illa Verde-F", "H4", 0.14, 0.18),
    ("ORG09", "Clínica Illas Cíes", "H1", 0.00, 0.00),
]
CLINIC = "ORG09"


def sha(lock_id, normalized):
    return hashlib.sha256(f"{SALT}:{lock_id}:{normalized}".encode()).hexdigest()


def normalize(v):
    s = unicodedata.normalize("NFD", str(v)).encode("ascii", "ignore").decode()
    return "".join(s.upper().split()).replace(".", "").replace(",", "")
