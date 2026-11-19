import { useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { getEngine } from "./duck";
import { restoreRaw } from "./raw";

type Pair = Record<string, any>;
const Q: Record<string, string> = {
  ssn: `select p.ssn as clave, p.patient_id, p.first_name, p.last_name, p.birthdate, p.address,
          (select count(*) from raw.encounters e where e.patient_id = p.patient_id and lower(e.encounter_class) = 'inpatient') as ingresos
        from raw.patients p where p.ssn in (select ssn from raw.patients group by ssn having count(*) > 1) order by p.ssn, p.patient_id`,
  name: `select p.first_name || ' ' || p.last_name || ' · ' || p.birthdate as clave, p.patient_id, p.ssn, p.address,
          (select count(*) from raw.encounters e where e.patient_id = p.patient_id and lower(e.encounter_class) = 'inpatient') as ingresos
        from raw.patients p where (p.first_name, p.last_name, p.birthdate) in (select first_name, last_name, birthdate from raw.patients group by 1, 2, 3 having count(*) > 1) order by 1, p.patient_id`,
};

export function PatientCompare({ teamId, lang }: { teamId: string; lang: Lang }) {
  const es = lang === "es";
  const [mode, setMode] = useState<"ssn" | "name" | "">("");
  const [rows, setRows] = useState<Pair[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const load = async (m: "ssn" | "name") => {
    setMode(m); setMsg("");
    try {
      if (!(await restoreRaw(teamId))) { setMsg(es ? "Primero termina de cargar los ficheros en «La bandeja de entrada»." : "Primeiro remata de cargar os ficheiros en «A caixa de entrada»."); return; }
      const eng = await getEngine();
      setRows(await eng.query(Q[m]));
      setTotal(Number((await eng.query("select count(*) n from raw.patients"))[0].n));
    } catch (e) { setMsg(String((e as Error).message)); }
  };
  const groups = new Map<string, Pair[]>();
  rows.forEach((r) => groups.set(r.clave, [...(groups.get(r.clave) ?? []), r]));
  return (
    <div className="compare">
      <div className="row">
        <button className="ghost" aria-pressed={mode === "ssn"} onClick={() => load("ssn")}>{es ? "Buscar fichas con el mismo SSN" : "Buscar fichas co mesmo SSN"}</button>
        <button className="ghost" aria-pressed={mode === "name"} onClick={() => load("name")}>{es ? "Buscar fichas con mismo nombre y nacimiento" : "Buscar fichas con mesmo nome e nacemento"}</button>
      </div>
      <p className="err" role="alert">{msg}</p>
      {mode && total !== null && (
        <>
          <p aria-live="polite"><b>{groups.size}</b> {es ? "grupos encontrados" : "grupos atopados"} · {total.toLocaleString(lang)} {es ? "fichas en total" : "fichas en total"}</p>
          <div className="scroll"><table className="prev">
            <thead><tr><th>{mode === "ssn" ? "SSN" : (es ? "Nombre · nacimiento" : "Nome · nacemento")}</th><th>patient_id</th>{mode === "ssn" ? <><th>{es ? "Nombre" : "Nome"}</th><th>{es ? "Dirección" : "Enderezo"}</th></> : <><th>SSN</th><th>{es ? "Dirección" : "Enderezo"}</th></>}<th>{es ? "Ingresos" : "Ingresos"}</th></tr></thead>
            <tbody>{rows.slice(0, 60).map((r, i) => (
              <tr key={i}><td>{r.clave}</td><td>{String(r.patient_id).slice(0, 8)}…</td>{mode === "ssn" ? <><td>{r.first_name} {r.last_name}</td><td>{r.address}</td></> : <><td>{r.ssn}</td><td>{r.address}</td></>}<td>{r.ingresos}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </div>
  );
}
