# Código Alta — Solución de todos los pasos

> **Solo para quien dirige el evento.** Este fichero contiene las respuestas: no lo sirváis a los equipos ni lo copiéis a `apps/web/public`. Los valores numéricos salen del dataset generado con `SEED=20261117` (`data/dist/answers.json`). Si se regenera el dataset con otra semilla o con otra sal, hay que recalcularlos (los ficheros `solutions/*.json` se regeneran con `python data/run_all.py`).

Se entra solo con el **nombre de equipo** (sin código de sesión). Los 20 niveles (R0-R5, el bonus R6 y la Comisión final) se juegan por orden; el nivel abierto es la pestaña fija «Nivel actual».

| # | Nivel | Qué hay que dar | Respuesta |
|---|-------|-----------------|-----------|
| 0 | El primer candado | palabra | `ATLANTICO` |
| 1 | La bandeja de entrada | cargar 8 ficheros + «Validar carga» | ver tabla de opciones (R1A) |
| 2 | El reenvío | decisión + número | decisión «Quedarse con la última versión…» · `59484` |
| 3 | Auditoría de Ada | marcar afirmaciones falsas | **2** y **3** |
| 4 | Radar RGPD | clasificar 19 columnas | ver tabla (R2A) |
| 5 | El protocolo | 4 preguntas | `d30 · merge · inpatient · deceased` |
| 6 | Esquema en estrella | hecho/dimensión + uniones | ver esquema (R3B) |
| 7 | Modelo de reingreso | 2 modelos + número | ver piezas (R3C) · `481` |
| 8 | Tablero de pruebas | causa de cada anomalía | ver tabla (R4A) |
| 9 | Entrevistas | 2 pistas de 3 con IA | ver preguntas (R4B) |
| 10 | Veredicto | tratamiento de cada anomalía | ver tabla (R4C) |
| 11 | Registros excluidos | número | `35` |
| 12 | KPI con sentido | 3 respuestas | `n30` · tasa sobre altas · aviso de pocos casos |
| 13 | Constructor de dashboard | 3–4 gráficos con título | ver ficha (R5B) |
| 14 | Revisión del crítico | ≤ 1 hallazgo | ver ficha (R5C) |
| 15 | El centro con mayor tasa | nombre | `Illa Verde` |
| 16 | R6A · Entrenar el modelo (bonus) | variables | las 6 sin fuga de datos |
| 17 | R6B · Umbral con presupuesto (bonus) | umbral | 15 % – 17 % |
| 18 | R6C · Equidad y decisión (bonus) | decisión + frase | desplegar con revisión humana |
| 19 | La Comisión (final) | 6 respuestas | sin solución única |

---

## R0 · El primer candado
- **Código:** `ATLANTICO` (el océano que baña la costa; está en el nombre del hospital «Costa Atlántica»). Da igual mayúsculas o tildes.

## R1 · La bandeja de entrada y el reenvío

### R1A · La bandeja de entrada (cargador de ficheros)
Para cada fichero hay que elegir **separador**, **codificación** y **formato de fecha** hasta que se lea bien, y pulsar «Cargar este fichero». Cuando los 8 tienen ✔, «Validar carga».

| Fichero | Separador | Codificación | Formato de fecha | Filas buenas | Rechazadas |
|---------|-----------|--------------|------------------|-------------:|-----------:|
| `patients.csv` | coma | UTF-8 | Sin fechas | 9 015 | 0 |
| `organizations.csv` | coma | UTF-8 | Sin fechas | 9 | 0 |
| `conditions.csv` | coma | UTF-8 | Sin fechas | 61 132 | 0 |
| `encounters_H1.csv` | coma | UTF-8 | `2023-01-31 14:05:00` | 19 260 | 0 |
| `encounters_H2.csv` | coma | UTF-8 | `2023-01-31 14:05:00` | 12 461 | 0 |
| `encounters_H2_reenvio.csv` | coma | UTF-8 | `2023-01-31 14:05:00` | 12 461 | 0 |
| `encounters_H3.csv` | **punto y coma** | **Latin-1** | **`31/01/2023 14:05`** | 8 367 | 0 |
| `encounters_H4.csv` | coma | UTF-8 | `2023-01-31 14:05:00` | 19 396 | **17** |

Trampas: la hoja de especificaciones (`docs/especificaciones-ficheros.md`) dice que H3 es UTF-8, pero está en Latin-1. Las 17 filas rechazadas de H4 son líneas cortadas de verdad (es lo correcto).

### R1B · El reenvío
- **Decisión:** «Quedarse con la última versión de cada encuentro» (`latest_by_id`; calidad +10, confianza +5).
- **Código:** `59484` = encuentros **distintos** (`encounter_id` distintos) tras juntar los 5 ficheros de encuentros.
- En el Laboratorio: tabla `encounters` · «Contar cuántos valores DISTINTOS hay en una columna» · columna `encounter_id`. Comparar con «Contar cuántas filas hay» para ver que hay repetidos.

### R1C · Auditoría de Ada
Son **falsas la 2 y la 3** (no marcar ninguna más: cada marca equivocada resta 10 puntos):
- **2 · «Ningún ingreso tiene la fecha de alta vacía»** → hay **6** ingresos `inpatient` con `stop_ts` vacío (Laboratorio: `encounters`, contar filas, condiciones `encounter_class` es igual a `inpatient` y `stop_ts` está vacía; mejor contando `encounter_id` distintos).
- **3 · «Hay 9015 pacientes únicos»** → `patients` tiene 9 015 filas pero solo **9 003** `ssn` distintos.
- Verdaderas: 1 (9 centros), 4 (2017–2023), 5 (6 055 inpatient, `encounter_id` distintos) y 6 (0 encuentros sin paciente conocido).

### R2A · Radar RGPD (sala R1)
| Columna | Acción |
|---------|--------|
| `patient_id` | mantener |
| `ssn` | **pseudonimizar** (nunca mantener en claro ni eliminar: hace falta para unir fichas) |
| `drivers`, `passport` | eliminar |
| `prefix`, `marital` | eliminar (también valen mantener/generalizar) |
| `first_name`, `last_name` | eliminar |
| `birthdate` | **generalizar** (tramo de edad) |
| `deathdate` | mantener |
| `birthplace` | eliminar (o generalizar) |
| `address` | eliminar |
| `city` | generalizar (o eliminar) |
| `state` | mantener |
| `county` | mantener |
| `postal_code` | **generalizar** (área sanitaria) |
| `gender` | mantener |
| `lat`, `lon` | eliminar (o generalizar) |

Reglas del servidor: dejar en claro `ssn`, `drivers`, `passport`, `first_name`, `last_name` o `address` es **crítico** (el cumplimiento baja 20 la primera vez); eliminar `ssn` es **bloqueante**; se admiten como máximo 3 columnas «mejorables».

## R3 · Modelar y medir

### R3A · El protocolo
`q1 = d30` (30 días naturales) · `q2 = merge` (se fusionan los ingresos separados por ≤ 1 día) · `q3 = inpatient` (solo ingresos) · `q4 = deceased` (excluir registros posteriores al fallecimiento).

### R3B · Esquema en estrella
- **Hechos:** `fct_admission`, `fct_condition`.
- **Dimensiones:** `dim_date`, `dim_hospital`, `dim_patient`.
- **Uniones (hecho → dimensión):** `fct_admission` → `dim_date`, `dim_hospital`, `dim_patient`; `fct_condition` → `dim_date`, `dim_patient`. Las dimensiones no se unen entre sí.

### R3C · Modelo de reingreso
Piezas:
- `int_admission_episodes` → qué cuenta como ingreso: **`inpatient`** · cuándo empieza un episodio nuevo: **`gap_1d`**.
- `fct_admission` → ventana de reingreso: **`between_2_30`**.
- Los modelos `stg_*` (limpieza) ya no son un nivel: vienen resueltos de serie.
- **Código:** `481` = episodios con `is_readmission_30d` (cifra provisional: el modelo base aún incluye anomalías). Botón «Episodios marcados como reingreso».

## R4 · Investigar errores

### R4A · Tablero de pruebas
| Detector | Causa |
|----------|-------|
| Altas y reingresos del mismo día (fragmentación) — `frag_h3` | **Error de migración** |
| Estancias negativas — `negative_stay` | **Error de captura** |
| Encuentros posteriores al fallecimiento — `post_mortem` | **Registro tardío de fallecimiento** |

### R4B · Entrevistas (IA)
Hay que conseguir **2 de las 3 pistas** (las tres dan 20 puntos extra). El personaje solo suelta datos si la pregunta es concreta o empática:
- **Noa (Informática)** → C1 (migración de H3, 14-mar-2019). Pregunta que funciona: *«¿Qué ocurrió en el centro H3 con la migración de marzo de 2019?»* (hay que nombrar el centro **y** la migración/fecha).
- **Brais (Admisiones)** → C2 (turno de noche: altas a mano con hora equivocada). Funciona: *«Imagino que el turno de noche es duro: ¿cómo es registrar las altas de madrugada?»* (tema + empatía).
- **Brais** → C3 (registro de defunciones con retraso). Funciona: preguntar por las defunciones/fallecimientos y cómo llegan o cuándo se registran, con tono amable.
- Máximo 6 preguntas por personaje. Las respuestas con IA real pueden variar la redacción, pero la decisión de revelar la pista es siempre una regla fija del servidor.

### R4C · Veredicto
| Grupo | Tratamiento |
|-------|-------------|
| `frag_h3` (fragmentación) | **Ya cubierto por la fusión de episodios: documentar** (`document`) |
| `negative_stay` | **Excluir y documentar** (`exclude_document`) |
| `post_mortem` | **Excluir y escalar al hospital** (`exclude_escalate`) |

### R4D · Registros excluidos
- **Código:** `35` = estancias negativas + registros posteriores al fallecimiento (suma de los contadores de arriba).

## R5 · Contarlo bien

### R5A · KPI con sentido
- ¿Cómo se calcula la tasa? → **Reingresos a 30 días / altas del periodo**.
- ¿Desde cuántas altas se publica? → **30 altas** (`n30`).
- Clínica Illas Cíes (3 ingresos, 100 %) → **Mostrarla con un aviso de pocos casos** (`warn`).

### R5B · Constructor de dashboard
Basta con **3 o 4 gráficos con título** (p. ej. barras por centro, línea mensual, barras por tramo de edad). Este nivel no se corrige: lo revisa el crítico en el siguiente.

### R5C · Revisión del crítico
Para dejar **≤ 1 hallazgo**, cada gráfico debe llevar: eje en cero, número de casos visible, mínimo de altas activado, paleta de énfasis (máx. 2 colores), sin doble eje ni 3D, y un **título que diga la conclusión** (≥ 6 palabras con un verbo/cifra). Centros ordenados de mayor a menor. Ejemplo que pasa:
1. Barras por centro · «Un centro supera con claridad al resto en reingresos a 30 días» · eje en 0 · n visible · orden descendente · mínimo de altas · paleta «énfasis».
2. Línea mensual · «La tasa mensual de reingresos sube y baja alrededor del 10 %» · eje en 0 · n visible · mínimo de altas · paleta «énfasis».
3. Barras por tramo de edad · «Los mayores de 80 años reingresan más que cualquier otro grupo» · eje en 0 · n visible · orden descendente · mínimo de altas · paleta «énfasis».

### R5D · El centro con mayor tasa
- **Código:** `Illa Verde` (el nombre corto; también vale «Hospital Illa Verde-F»). Con el modelo limpio y solo centros con **30 o más altas**.

## R6 · Laboratorio de riesgo (bonus, opcional: se puede saltar con «Saltar a la Comisión»)

### R6A · Entrenar el modelo
- Marcar las **6 variables que se conocen al alta**: edad (tramo), nº de condiciones, duración de la estancia, ingresos previos (12 meses), centro y sexo. AUC ≈ 0,70.
- **No marcar «Días hasta el siguiente ingreso»**: es la fuga de datos (AUC ≈ 0,99, la app no avisa). El servidor rechaza cualquier modelo que la incluya, que tenga menos de 2 variables o un AUC < 0,65 (se reentrena en el servidor con la misma semilla).

### R6B · Umbral con presupuesto
- Hay que elegir un umbral con **≤ 40 llamadas por semana** y **sensibilidad ≥ 30 %** (se simulan 52 semanas de ~200 altas). Con el modelo de 6 variables sirve un umbral del **15 % al 17 %** (p. ej. 16 %: ~34 llamadas y ~35 % de reingresos detectados). Por debajo se pasa de 40 llamadas; por encima se detecta menos del 30 %.

### R6C · Equidad y decisión
- El modelo detecta menos reingresos en **mujeres (≈ 26 %) que en hombres (≈ 42 %)** y en **18-44 años** y **65-79** que en 45-64. La respuesta que pasa es **«Desplegar con revisión humana»** con una frase de ≥ 40 letras que nombre los grupos y la revisión. «Desplegar» y «No desplegar» se rechazan con una explicación; la rúbrica es por palabras clave (grupo/sexo/edad… y revisión/persona…).

## La Comisión (final)
- 6 preguntas, 2 de cada miembro (Valcárcel, Pardo, Louzao), generadas a partir de las decisiones del equipo (reenvío, privacidad, anomalías, KPI, tiempo/ayudas y R6). Cada respuesta ≤ 400 letras y hasta 3 tarjetas de evidencia.
- No hay una única respuesta correcta. La evaluación puntúa claridad, evidencia (cifras + tarjetas), honestidad con los límites y propuesta de acción; contradecir hechos reales (p. ej. «9 015 pacientes únicos») resta. Para un **Plan aprobado**: responder con una cifra, reconocer un límite y proponer un siguiente paso, adjuntando evidencias, y llegar con confianza y calidad de datos altas.
- Resultado: **Plan aprobado / Aprobado con condiciones / Piden más datos** (los tres son «buenos»), informe final e insignias (+10 puntos cada una): Ojo de halcón, Cero fugas, Auditor/a de IA, Detective forense, Sin atajos (no usar la llave maestra), Esquema estelar, Cartógrafo/a y Ética primero.

---

## Ayudas de Lumi (ADR 012)
- Ya no hay botón de pistas: en el panel de Lumi, «Dame una pista» da las pistas 1-3 de cada nivel y después «Ver la solución» (la de esta tabla, con la cifra real). Coste 5 / 10 / 20 / 40 puntos.
- Se desbloquean por intentos fallidos o tiempo en el nivel: pista 1 al instante, 2 tras 1 intento o 3 min, 3 tras 2 intentos o 6 min, solución tras 3 intentos o 10 min (`content/session.yaml`).
- En la consola, la columna «pistas» va de 0 a 4 (4 = han visto la solución).

## Comprobaciones rápidas para quien dirige
- Saltar un candado (resta 60 puntos): `POST /api/locks/master-key` con cabecera `x-facilitator-pin` y `{ "teamId": "…" }`.
- Pausar / reanudar: `POST /api/facilitator/pause` con `{ "paused": true|false }`.
- Consola web: **`/facilitador`** (PIN): equipos en vivo, pausa/reanudar, llave maestra, detalle (decisiones, eventos, conversaciones con la IA) y exportación CSV/JSON.
- Estado de todos los equipos: `GET /api/facilitator/overview`.
- Tests de punta a punta con las soluciones: `npm run e2e` (usa `solutions/*.json`).
