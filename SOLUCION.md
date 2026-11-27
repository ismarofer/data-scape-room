# DataQuest — Solución de todos los pasos

> **Solo para quien dirige el evento.** Este fichero contiene las respuestas: no lo sirváis a los equipos ni lo copiéis a `apps/web/public`. Los valores numéricos salen del dataset generado con `SEED=20261117` (`data/dist/answers.json`). Si se regenera el dataset con otra semilla o con otra sal, hay que recalcularlos (los ficheros `solutions/*.json` se regeneran con `python data/run_all.py`).

Se entra solo con el **nombre de equipo** (sin código de sesión). Los 18 niveles (R0-R5, el bonus R6 y la Comisión final) se juegan por orden; el nivel abierto es la pestaña fija «Nivel actual».

| # | Nivel | Qué hay que dar | Respuesta |
|---|-------|-----------------|-----------|
| 0 | El primer candado | palabra | `ATLANTICO` |
| 1 | La bandeja de entrada | cargar 8 ficheros + «Validar carga» | ver tabla de opciones (R1A) |
| 2 | El reenvío | decisión + número | decisión «Quedarse con la última versión…» · `59484` |
| 3 | Auditoría de Ada | marcar afirmaciones falsas | **2** y **3** |
| 4 | Radar RGPD | clasificar 8 columnas | ver tabla (R2A) |
| 5 | Esquema en estrella | hecho/dimensión + uniones | ver esquema (R3B) |
| 6 | Modelo de reingreso | 2 modelos + número (el protocolo se lee en `docs/peticiones-direccion.md`) | ver piezas (R3C) · `481` |
| 7 | Entrevistas | pistas con IA (las 3 causas) | ver preguntas (R4B) |
| 8 | Veredicto | tratamiento de cada anomalía | ver tabla (R4C) |
| 9 | Registros excluidos | número | `35` |
| 10 | KPI con sentido | 3 respuestas | `n30` · tasa sobre altas · aviso de pocos casos |
| 11 | Constructor de dashboard | 3–4 gráficos | ver ficha (R5B) |
| 12 | Revisión del crítico | ≤ 1 hallazgo | ver ficha (R5C) |
| 13 | El centro con mayor tasa | nombre | `Illa Verde` |
| 14 | R6A · Entrenar el modelo (bonus) | variables | las 6 sin fuga de datos |
| 15 | R6B · Umbral con presupuesto (bonus) | umbral | 15 % – 17 % |
| 16 | R6C · Equidad y decisión (bonus) | decisión + frase | desplegar con revisión humana |
| 17 | La Comisión (final) | 5 respuestas | sin solución única |

---

## R0 · El primer candado
- **Respuesta:** `ATLANTICO` (el océano que baña la costa; está en el nombre del hospital «Costa Atlántica»). Da igual mayúsculas o tildes.

## R1 · La bandeja de entrada y el reenvío

### R1A · La bandeja de entrada (cargador de ficheros)
Para cada fichero hay que elegir **separador**, **codificación** y **formato de fecha** hasta que se lea bien, y pulsar «Cargar este fichero». Cuando los 8 tienen ✔, «Validar carga».

| Fichero | Separador | Codificación | Formato de fecha | Filas buenas | Rechazadas |
|---------|-----------|--------------|------------------|-------------:|-----------:|
| `patients.csv` | coma | UTF-8 | Sin fechas | 9 015 | 0 |
| `organizations.csv` | **barra vertical** | UTF-8 | Sin fechas | 9 | 0 |
| `conditions.csv` | **tabulador** | **Latin-1** | Sin fechas | 61 132 | 0 |
| `encounters_H1.csv` | coma | UTF-8 | `2023-01-31 14:05:00` | 19 260 | 0 |
| `encounters_H2.csv` | coma | **Latin-1** | `2023-01-31 14:05:00` | 12 461 | 0 |
| `encounters_H2_reenvio.csv` | coma | UTF-8 | `2023-01-31 14:05:00` | 12 461 | 0 |
| `encounters_H3.csv` | **punto y coma** | **Latin-1** | **`31/01/2023 14:05`** | 8 367 | 0 |
| `encounters_H4.csv` | **tabulador** | UTF-8 | `2023-01-31 14:05:00` | 19 396 | **17** |

Trampas: la hoja de especificaciones (`docs/especificaciones-ficheros.md`) dice que H2 y H3 son UTF-8, pero están en Latin-1. Las 17 filas rechazadas de H4 son líneas cortadas de verdad (es lo correcto).

### R1B · El reenvío
- **Decisión:** «Quedarse con la última versión de cada encuentro» (`latest_by_id`; calidad +10, confianza +5).
- **Respuesta:** `59484` = encuentros **distintos** (`encounter_id` distintos) tras juntar los 5 ficheros de encuentros.
- En el Laboratorio: tabla `encounters` · «Contar cuántos valores DISTINTOS hay en una columna» · columna `encounter_id`. Comparar con «Contar cuántas filas hay» para ver que hay repetidos.

### R1C · Auditoría de Ada
Son **falsas la 2 y la 3** (no marcar ninguna más: cada marca equivocada baja 2 la confianza):
- **2 · «Ningún ingreso tiene la fecha de alta vacía»** → hay **6** ingresos `inpatient` con `stop_ts` vacío (Laboratorio: `encounters`, contar filas, condiciones `encounter_class` es igual a `inpatient` y `stop_ts` está vacía; mejor contando `encounter_id` distintos).
- **3 · «Hay 9015 pacientes únicos»** → `patients` tiene 9 015 filas pero solo **9 003** `ssn` distintos.
- Verdaderas: 1 (9 centros), 4 (2017–2023), 5 (6 055 inpatient, `encounter_id` distintos) y 6 (0 encuentros sin paciente conocido).

### R2A · Radar RGPD (sala R1)
Solo se deciden 8 columnas; las otras 11 de `patients.csv` (drivers, passport, prefix, last_name, marital, birthplace, city, state, county, lat, lon) salen como «ya quitadas».

| Columna | Acción |
|---------|--------|
| `patient_id` | mantener (también vale pseudonimizar) |
| `ssn` | **pseudonimizar** (nunca mantener en claro ni eliminar: hace falta para unir fichas) |
| `first_name`, `address` | eliminar |
| `birthdate` | **generalizar** (tramo de edad) |
| `postal_code` | **generalizar** (área sanitaria) |
| `gender`, `deathdate` | mantener |

Reglas del servidor: dejar en claro `ssn`, `first_name` o `address` es **crítico** (la confianza baja 6 la primera vez y 2 las siguientes); eliminar `ssn` es **bloqueante**; se admite como máximo 1 columna «mejorable».

## R3 · Modelar y medir (2 niveles desde el ADR 014; el antiguo «El protocolo» va dentro de R3C)

### R3B · Esquema en estrella
En pantalla las tablas salen **sin prefijo** (`patient`, `hospital`, `date`, `admission`, `condition`); internamente siguen siendo `dim_*` / `fct_*`.
- **Hechos:** `admission` (`fct_admission`), `condition` (`fct_condition`).
- **Dimensiones:** `date`, `hospital`, `patient`.
- **Uniones (hecho → dimensión):** `admission` → `date`, `hospital`, `patient`; `condition` → `date`, `patient` (un diagnóstico no tiene columna de hospital). Las dimensiones no se unen entre sí.
- Desde el 27-nov estas 5 tablas **se crean de verdad** en `marts` al pulsar «▶ Calcular» en R3C (modelos sin piezas `dim_patient`, `dim_hospital`, `dim_date`, `fct_condition`; `fct_admission` gana `admit_date` y `length_of_stay_days`), con tests de clave única y de relación hecho → dimensión. Las columnas de las tarjetas del lienzo son las reales.

### R3C · Modelo de reingreso
El protocolo completo está al lado de las piezas. Piezas:
- `int_admission_episodes` → qué cuenta como ingreso: **`inpatient`** (regla 3) · cuándo empieza un episodio nuevo: **`gap_1d`** (regla 2).
- `fct_admission` → ventana de reingreso: **`between_2_30`** (regla 1).
- Los modelos `stg_*` (limpieza) vienen resueltos de serie.
- **Respuesta:** `481` = episodios con `is_readmission_30d` (provisional: aún incluye anomalías). Se obtiene con el **Laboratorio de preguntas**: tabla `marts.fct_admission` · «Contar cuántas filas hay» · condición `is_readmission_30d` es igual a `true`.

## R4 · Investigar errores

### R4B · Entrevistas (IA)
El nivel **no avanza solo**: se pulsa «Terminar las entrevistas y seguir» cuando se quiera (también con 0 pistas). Cada pista vale más confianza (0 pistas = 25 % del premio del nivel, 3 = 100 %). Cada personaje suelta su pista en cuanto la pregunta toca el tema (encima del chat hay una tarjeta por problema: qué se ha visto, cifras y por qué importa, sin la causa; se marca ✔ al conseguir su pista). Pistas: C1 = altas y reingresos del mismo día, C2 = estancias negativas, C3 = visitas tras el fallecimiento:
- **Noa (Informática)** → C1 (migración de H3, 14-mar-2019). Funciona: *«¿Qué ocurrió en el centro H3 con la migración de marzo de 2019?»* (basta con el centro H3, la fecha o la migración).
- **Brais (Admisiones)** → C2 (turno de noche: altas a mano con hora equivocada). Funciona: *«¿Cómo registráis las altas en el turno de noche?»* (basta el tema: turno de noche, madrugada, a mano).
- **Brais** → C3 (registro de defunciones con retraso). Funciona: *«¿Cómo y cuándo os llegan los registros de defunciones?»*.
- Máximo 6 preguntas por personaje. Con IA real la redacción varía, pero revelar o no la pista es siempre una regla fija del servidor.

### R4C · Veredicto
| Grupo | Tratamiento |
|-------|-------------|
| `frag_h3` (fragmentación) | **Ya cubierto por la fusión de episodios: documentar** (`document`) |
| `negative_stay` | **Excluir y documentar** (`exclude_document`) |
| `post_mortem` | **Excluir y escalar al hospital** (`exclude_escalate`) |

### R4D · Registros excluidos
- **Respuesta:** `35` = estancias negativas + registros posteriores al fallecimiento (los dos grupos que el veredicto excluye; la fragmentación solo se documenta).

## R5 · Contarlo bien

### R5A · KPI con sentido
- ¿Cómo se calcula la tasa? → **Reingresos a 30 días / altas del periodo**.
- Mínimo de altas (caja numérica) → **cualquier número entre 4 y 317** (deja fuera la Clínica Illas Cíes, 3 altas, y mantiene todos los hospitales; el más pequeño tiene 317). Lo habitual y lo que recomendaríamos: **30**. Configurado en `numeric_ranges` de `content/locks/r5a_kpi.yaml`.
- Clínica Illas Cíes (3 ingresos, 100 %) → **Mostrarla aparte, con un aviso de pocos casos** (`warn`).
- El mínimo elegido se guarda y se aplica en el dashboard y en R5D.

### R5B · Constructor de dashboard
Basta con **3 o 4 gráficos** (el título se genera solo desde el 26-nov). Este nivel no se corrige. Propuesta: barras · tasa · por centro; línea · tasa · por mes; barras · tasa · por tramo de edad.

### R5C · Revisión del crítico
Para entregar **no puede quedar nada en rojo**; lo amarillo se puede dejar (cada aviso resta un 15 % de la confianza del nivel, máximo 60 %).
- 🔴 (bloquea): número de reingresos (o altas comparadas como reingresos) por centro/área · línea o área para centro/edad/área · tarta o anillo (siempre) · tasa por centro sin «Aplicar vuestro mínimo de altas» · ningún gráfico con la tasa · menos de 3 o más de 4 gráficos.
- 🟡 (deja seguir): tasa sin «Mostrar n» (salvo en líneas) · barras de centros/áreas sin «De mayor a menor» · colores «Muchos» · dos gráficos iguales · KPI con un número en vez de la tasa.
Ejemplo sin nada que objetar:
1. Barras · Tasa · Centro · «Un centro reingresa casi el doble que el resto» · n · mínimo de altas · de mayor a menor · «Uno + énfasis».
2. Línea · Tasa · Mes · «La tasa mensual sube y baja alrededor del 10 %» · «Uno + énfasis».
3. Barras · Tasa · Tramo de edad · «Los mayores de 80 años reingresan más que nadie» · n · «Uno + énfasis».

### R5D · El centro con mayor tasa
- **Cómo:** Laboratorio · `canon.fct_admission_clean` · «Para cada valor de una columna: cuántas filas hay y qué % tiene una marca» · columna `organization_name` · marca `is_readmission_30d` · «Solo grupos con al menos 30 filas» → primera fila. Sin el mínimo sale Clínica Illas Cíes (3 altas, 100 %): trampa.
- **Respuesta:** `Illa Verde` (el nombre corto; también vale «Hospital Illa Verde-F»). Con el modelo limpio y el mínimo de altas del equipo (cualquiera válido da el mismo resultado).

## R6 · Laboratorio de riesgo (bonus, opcional: se puede saltar con «Saltar a la Comisión»)

### R6A · Entrenar el modelo
- Marcar las **6 variables que se conocen al alta**: edad (tramo), nº de condiciones, duración de la estancia, ingresos previos (12 meses), centro y sexo. AUC ≈ 0,70.
- **No marcar «Días hasta el siguiente ingreso»**: es la fuga de datos (AUC ≈ 0,99, la app no avisa). El servidor rechaza cualquier modelo que la incluya, que tenga menos de 2 variables o un AUC < 0,65 (se reentrena en el servidor con la misma semilla).

### R6B · Umbral con presupuesto
- Hay que elegir un umbral con **≤ 40 llamadas por semana** y **sensibilidad ≥ 30 %** (se simulan 52 semanas de ~200 altas). Con el modelo de 6 variables sirve un umbral del **15 % al 17 %** (p. ej. 16 %: ~34 llamadas y ~35 % de reingresos detectados). Por debajo se pasa de 40 llamadas; por encima se detecta menos del 30 %.

### R6C · Equidad y decisión
- El modelo detecta menos reingresos en **mujeres (≈ 26 %) que en hombres (≈ 42 %)** y en **18-44 años** y **65-79** que en 45-64. La respuesta que pasa es **«Desplegar con revisión humana»** con una frase de ≥ 40 letras que nombre los grupos y la revisión. «Desplegar» y «No desplegar» se rechazan con una explicación; la rúbrica es por palabras clave (grupo/sexo/edad… y revisión/persona…).

## La Comisión (final)
- 5 preguntas funcionales de personas no técnicas (Valcárcel, Pardo, Louzao, Pardo, Valcárcel): cuántos vuelven de cada 100 (≈ 10), si se pueden fiar de la cifra, en qué hospital o paciente fijarse (Illa Verde ≈ 18 %; Illas Cíes no cuenta, 3 altas; por edad, 45-64 el más alto), si los pacientes están protegidos y qué hacer mañana. Las variantes dependen del reenvío, la privacidad y el bonus. Cada respuesta ≤ 400 letras. Debajo está siempre el resumen del trabajo en tarjetas (no se adjunta nada).
- No hay una única respuesta correcta. La evaluación puntúa claridad (sin tecnicismos), evidencia (cifras y hechos), honestidad con los límites y propuesta de acción; contradecir hechos reales (p. ej. «9 015 pacientes únicos») resta. Para un **Plan aprobado**: responder con una cifra, reconocer un límite y proponer un siguiente paso, y llegar con la confianza de la Comisión alta (≥ 60 suma, ≥ 80 suma doble).
- Resultado: **Plan aprobado / Aprobado con condiciones / Piden más datos** (los tres son «buenos»), informe final e insignias (+2 de confianza cada una): Ojo de halcón, Cero fugas, Auditor/a de IA, Detective forense, Sin atajos (no usar la llave maestra), Esquema estelar, Cartógrafo/a y Ética primero.

---

## Ayudas de Lumi (ADR 012)
- Ya no hay botón de pistas: en el panel de Lumi, «Dame una pista» da las pistas 1-3 de cada nivel y después «Ver la solución» (la de esta tabla, con la cifra real). Coste en confianza de la Comisión (el único medidor): −5 por pista y −10 la solución; además, **cada pregunta a Lumi −1** (ADR 015, 27-nov). Las pistas se reescribieron para que cada una avance de verdad: la 1 dice cómo se hace y resuelve la primera parte, la 2 la mayor parte con los valores reales y la 3 todo menos la cifra o el nombre final.
- Se desbloquean por intentos fallidos o tiempo en el nivel: pista 1 al instante, 2 tras 1 intento o 2 min, 3 tras 2 intentos o 4 min, solución tras 2 intentos o 6 min (`content/session.yaml`).
- En la consola, la columna «pistas» va de 0 a 4 (4 = han visto la solución).

## Comprobaciones rápidas para quien dirige
- Saltar un candado (baja 10 la confianza): `POST /api/locks/master-key` con cabecera `x-facilitator-pin` y `{ "teamId": "…" }`.
- Pausar / reanudar: `POST /api/facilitator/pause` con `{ "paused": true|false }`.
- Consola web: **`/facilitador`** (PIN): equipos en vivo, pausa/reanudar, llave maestra, detalle (decisiones, eventos, conversaciones con la IA) y exportación CSV/JSON.
- **Probar un nivel concreto** (consola `/facilitador` → «🧪 Probar un nivel concreto»): nombre de equipo + nivel → «Ir a ese nivel ▶». Crea o reutiliza el equipo y lo deja al **inicio** de ese nivel: los anteriores quedan resueltos «bien» (opciones correctas del cargador para reconstruir los datos, decisiones correctas, mínimo de 30 altas) y ese nivel y los siguientes empiezan de cero (intentos, pistas, decisiones, pistas de entrevistas, Comisión). No toca la confianza. Se puede repetir para volver a probar el mismo nivel, o ir hacia atrás. En la tabla de equipos, «Ir a nivel… ▶ Ir» hace lo mismo con un equipo existente. API: `POST /api/facilitator/test-team` `{alias, lockId}` y `POST /api/facilitator/jump` `{teamId, lockId}` (cabecera `x-facilitator-pin`).
- Estado de todos los equipos: `GET /api/facilitator/overview`.
- Tests de punta a punta con las soluciones: `npm run e2e` (usa `solutions/*.json`).
