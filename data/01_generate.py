"""Stage 1: build the synthetic truth world (patients, encounters, conditions). Pure Python/numpy."""
import os
import numpy as np
import pandas as pd
from common import *

P_MORE = 0.30  # prob. another admission follows an episode
R_BASE = float(os.environ.get("R_BASE", 0.36))  # prob. follow-up is a <=30d readmission
N_PAT = int(os.environ.get("N_PAT", 9000))

FIRST_F = "María Carmen Ana Laura Marta Lucía Paula Sara Elena Rosa Noelia Uxía Antía Iria Julia Carla Sofía Nerea Alba Lía Xiana Maruxa Pilar Beatriz Raquel Cristina Eva Olalla Sabela Inés".split()
FIRST_M = "José Antonio Manuel Francisco Luis Javier Carlos Miguel Pedro Xoán Xosé Anxo Brais Iago Hugo Martín Pablo Daniel Alejandro Rubén Diego Marcos Santiago Fernando Andrés Óscar Breixo Damián Suso Roi".split()
LAST = "Fernández Rodríguez López Pérez González Vázquez Louro Seoane Castro Varela Lorenzo Rivas Freire Cabanas Barreiro Souto Vilas Ferreiro Otero Mosquera Taboada Lamas Rey Neira Santos Piñeiro Outeiro Couto Dopazo Cances Figueiras Paz Montes Lago Pazos Iglesias Veiga Penas Bouzas Calvo Mouriño Rial Táboas Carballo Dorrego Garrido Amoedo Barral Bugallo Canosa Dios Eirín Gándara Lema Meijide Nogueira Pedrosa Quintela Sampedro Teijeiro Villar".split()
CITIES = [("A Coruña", "15"), ("Santiago de Compostela", "15"), ("Ferrol", "15"), ("Lugo", "27"), ("Monforte", "27"), ("Ourense", "32"), ("Verín", "32"), ("Pontevedra", "36"), ("Vigo", "36"), ("Cangas", "36"), ("Noia", "15"), ("Ribeira", "15")]
STREETS = "Rúa do Cantón|Rúa Nova|Avenida da Mariña|Rúa do Souto|Praza do Concello|Camiño Real|Rúa das Flores|Avenida de Galicia|Rúa do Miño|Rúa da Ponte|Travesía do Mar|Rúa dos Carballos".split("|")
CHRONIC = [("I10", "Hipertensión arterial"), ("E11", "Diabetes mellitus tipo 2"), ("J44", "EPOC"), ("I50", "Insuficiencia cardiaca"), ("N18", "Enfermedad renal crónica"), ("J45", "Asma"), ("M19", "Artrosis"), ("I48", "Fibrilación auricular"), ("E66", "Obesidad"), ("E78", "Hipercolesterolemia"), ("I25", "Cardiopatía isquémica"), ("M81", "Osteoporosis")]
ACUTE = [("J18", "Neumonía"), ("N39", "Infección urinaria"), ("S72", "Fractura de cadera"), ("K35", "Apendicitis aguda"), ("J20", "Bronquitis aguda"), ("K80", "Colelitiasis"), ("I21", "Infarto agudo de miocardio"), ("K57", "Diverticulitis"), ("L03", "Celulitis"), ("I63", "Ictus isquémico")]
rng = np.random.default_rng(SEED)
_used = set()


def hid():
    while True:
        v = f"{int(rng.integers(0, 2**47)):012x}"
        if v not in _used:
            _used.add(v)
            return v


def ts(d):
    return pd.Timestamp(d)


def make_patients():
    age = np.clip(rng.gamma(4.5, 11, N_PAT), 0, 98)
    ssn_pool = rng.choice(1_000_000, N_PAT * 2, replace=False)
    rows = []
    for i in range(N_PAT):
        g = "F" if rng.random() < 0.5 else "M"
        first = rng.choice(FIRST_F if g == "F" else FIRST_M)
        l1, l2 = rng.choice(LAST, 2, replace=False)
        city, pc = CITIES[rng.integers(len(CITIES))]
        s = int(ssn_pool[i])
        adult = age[i] >= 18
        rows.append(dict(
            patient_id=hid(), ssn=f"999-{s // 10000:02d}-{s % 10000:04d}",
            drivers=(f"G{int(rng.integers(10**7, 10**8))}" if adult else None),
            passport=(f"X{int(rng.integers(10**7, 10**8))}" if rng.random() < 0.3 else None),
            prefix=(("Sra." if g == "F" else "Sr.") if adult else None),
            first_name=first, last_name=f"{l1} {l2}",
            marital=(str(rng.choice(["M", "S", "D", "W"])) if adult else None),
            birthdate=(ts("2020-01-01") - pd.Timedelta(days=float(age[i] * 365.25))).normalize(),
            deathdate=pd.NaT, birthplace=f"{rng.choice([c for c, _ in CITIES])}, Galicia",
            address=f"{rng.choice(STREETS)} {int(rng.integers(1, 120))}", city=city, state="Galicia",
            county={"15": "A Coruña", "27": "Lugo", "32": "Ourense", "36": "Pontevedra"}[pc],
            postal_code=f"{pc}{int(rng.integers(0, 999)):03d}", gender=g,
            lat=round(float(rng.uniform(41.9, 43.7)), 5), lon=round(float(rng.uniform(-9.2, -6.8)), 5), age_tmp=float(age[i])))
    return pd.DataFrame(rows)


def build():
    pat = make_patients()
    ow = np.array([o[3] for o in ORGS[:8]])
    ow = ow / ow.sum()
    mod = {o[0]: o[4] for o in ORGS}
    enc, cond, deaths = [], [], {}
    cut = ts(CUT)

    def pick_org(home):
        if rng.random() < 0.85:
            return home
        return ORGS[int(rng.choice(8, p=ow))][0]

    for idx, p in enumerate(pat.itertuples()):
        age, pid = p.age_tmp, p.patient_id
        home = ORGS[int(rng.choice(8, p=ow))][0]
        chronic = int(min(6, rng.poisson(0.3 + age / 28)))
        ch = rng.choice(len(CHRONIC), size=chronic, replace=False) if chronic else []
        mine = []
        n_ep = 0
        if rng.random() < 0.10 + 0.50 * (age / 90) ** 1.2:
            cur = ts(PERIOD_START) + pd.Timedelta(days=int(rng.integers(0, 365 * 7 - 60)))
            while True:
                org = pick_org(home)
                los = min(int(rng.geometric(0.22)), 40)
                start = cur.normalize() + pd.Timedelta(hours=int(rng.integers(0, 24)), minutes=int(rng.integers(0, 60)))
                stop = start + pd.Timedelta(hours=max(12, los * 24 - int(rng.integers(0, 12))))
                if stop > cut - pd.Timedelta(days=7):
                    break
                ep = f"{pid}-{n_ep}"

                def add(s, e, cls, desc, kind="normal"):
                    eid = hid()
                    mine.append(dict(encounter_id=eid, patient_id=pid, organization_id=org, start_ts=s, stop_ts=e,
                                     encounter_class=cls, description=desc, ep_key=ep, ep_idx=n_ep, los=los, kind=kind))
                    return eid
                dx = ACUTE[int(rng.integers(len(ACUTE)))]
                if rng.random() < 0.6:
                    add(start - pd.Timedelta(hours=int(rng.integers(2, 9))), start - pd.Timedelta(minutes=30), "emergency", "Atención en urgencias")
                if rng.random() < 0.07 and los >= 2:
                    mid = start + (stop - start) * float(rng.uniform(0.3, 0.7))
                    e1 = add(start, mid, "inpatient", "Ingreso hospitalario", "legit_split")
                    add(mid + min(pd.Timedelta(hours=int(rng.integers(1, 20))), (stop - mid) / 2), stop, "inpatient", "Traslado interno / continuación", "legit_split")
                else:
                    e1 = add(start, stop, "inpatient", "Ingreso hospitalario")
                cond.append(dict(patient_id=pid, encounter_id=e1, start=start.normalize(), stop=pd.NaT, code=dx[0], description=dx[1]))
                n_ep += 1
                if rng.random() >= P_MORE:
                    break
                r = R_BASE + mod[org] + (0.05 if (chronic >= 3 and los <= 2) else 0.0)
                gap = int(rng.integers(2, 31)) if rng.random() < r else int(rng.integers(45, 500))
                cur = stop.normalize() + pd.Timedelta(days=gap)
                if cur > cut - pd.Timedelta(days=20):
                    break
        for _ in range(int(rng.poisson(3))):
            d = ts(PERIOD_START) + pd.Timedelta(days=int(rng.integers(0, 365 * 7)), hours=int(rng.integers(7, 19)))
            cls = str(rng.choice(["ambulatory", "wellness", "outpatient", "urgentcare"], p=[.45, .2, .25, .1]))
            desc = {"ambulatory": "Consulta externa", "wellness": "Revisión de salud", "outpatient": "Procedimiento ambulatorio", "urgentcare": "Atención urgente"}[cls]
            mine.append(dict(encounter_id=hid(), patient_id=pid, organization_id=pick_org(home), start_ts=d,
                             stop_ts=d + pd.Timedelta(minutes=int(rng.integers(15, 90))), encounter_class=cls,
                             description=desc, ep_key=None, ep_idx=-1, los=0, kind="background"))
        if mine:
            fe = min(mine, key=lambda e: e["start_ts"])
            for c in ch:
                cond.append(dict(patient_id=pid, encounter_id=fe["encounter_id"], start=fe["start_ts"].normalize(), stop=pd.NaT, code=CHRONIC[c][0], description=CHRONIC[c][1]))
            if rng.random() < 0.04 + 0.06 * (age / 90):
                dd = (max(e["stop_ts"] for e in mine) + pd.Timedelta(days=int(rng.integers(20, 300)))).normalize()
                if dd <= ts("2023-11-15"):
                    deaths[pid] = dd
        pat.loc[idx, "chronic_n"] = chronic
        enc.extend(mine)
    pat["deathdate"] = pat.patient_id.map(deaths)
    return pat, pd.DataFrame(enc), pd.DataFrame(cond)


if __name__ == "__main__":
    pat, enc, cond = build()
    pat.drop(columns=["age_tmp"]).to_parquet(WORK / "truth_patients.parquet")
    enc.to_parquet(WORK / "truth_encounters.parquet")
    cond.to_parquet(WORK / "truth_conditions.parquet")
    print(len(pat), len(enc), (enc.encounter_class == "inpatient").sum(), len(cond), pat.deathdate.notna().sum())
