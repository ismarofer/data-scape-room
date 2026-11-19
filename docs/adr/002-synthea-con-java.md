# ADR 002 — Se usa Synthea (Java 21 disponible); ADR 001 queda como plan B

Estado: aceptada (2026-11-17). El generador en Python (`data/01_generate.py`) se conserva como alternativa.

- Synthea `master-branch-latest` build bd8a52b (2026-10-21), jar sha256 `20098ec70c24c715…`, Java 21, estado Massachusetts (solo base demográfica; se localiza a Galicia).
- 7 ejecuciones × 4.500 (semillas 20261118..20261124), referencia 2023-12-31 → ~31.000 pacientes (`data/synthea/run_synthea.sh`).
- Filtro de sensibles: se excluyen pacientes con condiciones clínicas sensibles (sobredosis, opioides, VIH, ITS, suicidio/autolesión, aborto/aborto espontáneo, salud mental grave). Los hallazgos sociales (violencia, alcohol, estrés…) NO excluyen al paciente (eliminaría ~85 % de los ingresos): no se exportan, porque `conditions.csv` solo lleva un catálogo curado (`data/cond_es.py`).
- Synthea produce ~2 % de reingresos a 30 d: se añade la señal (clonando estancias plausibles, T10 generalizado) para llegar al 9-14 %. Se declara en el informe final.
- Se limita a 6 encuentros no hospitalarios por paciente para mantener los ficheros manejables en el navegador.
