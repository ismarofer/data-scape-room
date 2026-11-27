# Sala 2 · Modelado (R3) — «El plano del hospital»

**Objetivo:** dibujar el plano de los datos y convertir una definición escrita en un cálculo. «Si cambia la definición, cambia el número.» **~20 min, 2 niveles.**
**Briefing:** dibujar el esquema en estrella · leer el protocolo y convertirlo en el cálculo · comprobar la cifra con el Laboratorio.

> **Cambio 24-nov (ADR 014):** el antiguo nivel «El protocolo» (R3A, 4 desplegables) se fusiona con «Modelo de reingreso»: los dos pedían leer el protocolo y traducirlo. Ahora el protocolo completo está al lado de las piezas del cálculo.

## 2.1 Esquema en estrella (`r3b_estrella`, construcción) · ~7 min · 3/5
| | |
|---|---|
| Hace | Marca 5 tablas como hecho o dimensión y une cada hecho con las dimensiones que lo describen. |
| Información en pantalla | Cada tarjeta: nombre **sin prefijo** (`patient`, `hospital`, `date`, `admission`, `condition`), **qué es una fila** («Una fila cada vez que alguien ingresa» / «Una fila por centro») y sus **columnas clave** (las **reales** de la tabla que se crea después: `patient_key · organization_id · admit_date…`). Las tarjetas están mezcladas (no hay fila de hechos y fila de dimensiones). Enlace a «📄 Esquema en estrella: hechos y dimensiones». |
| Por qué sin prefijos | `fct_`/`dim_` daban la respuesta. Ahora se deduce con el método real: qué es una fila (algo que pasa vs. una cosa que existe) y qué códigos tiene el hecho (cada código apunta a una dimensión). |
| Cómo se resuelve | Leer el documento (mismo método con otro ejemplo: una app de música) → marcar tipos → unir cada hecho con las dimensiones cuyas columnas tiene → «Comprobar esquema». |
| Interacción | [UI 08](../ui/08-esquema-en-estrella.md): clic en dos tarjetas o arrastrar desde cualquier punto; la flecha se orienta sola; dos del mismo tipo no se unen (mensaje). |
| Si falla | **Se pinta en rojo** lo que el servidor marca mal: la tarjeta cuyo tipo está mal y la unión que sobra (✘ en la lista). Las que faltan se cuentan («os faltan 2 elementos»), sin decir cuáles. La marca roja desaparece al cambiar ese elemento. |
| Ayudas | 1 «mirad qué es una fila», 2 «mirad las columnas: cada código apunta a una dimensión», 3 qué tablas son hechos y que un diagnóstico no tiene hospital, solución. |
| Se construye (**27-nov**) | El esquema no se queda en dibujo: al pulsar «▶ Calcular» en el nivel siguiente se crean en `marts` (capa oro) `fct_admission`, `fct_condition`, `dim_patient` (una fila por persona), `dim_hospital` y `dim_date`, con tests de clave única y de relación hecho → dimensión. El constructor enseña la cadena completa y sus filas; el panel BASE DE DATOS y el Laboratorio las muestran con la explicación de cada columna. |

## 2.2 Modelo de reingreso (`r3c_modelo`, respuesta) · ~13 min · 3/5
| | |
|---|---|
| Hace | Lee el protocolo, elige 3 piezas del cálculo, calcula y cuenta con el **Laboratorio de preguntas** cuántos episodios salen marcados como reingreso. |
| Información en pantalla | Una línea con enlace a `docs/peticiones-direccion.md`, donde está el protocolo (las reglas ya **no** se copian junto a las piezas desde el 26-nov: encontrarlas en el documento es parte del nivel). Cada pieza es una pregunta en castellano con sus opciones. Debajo, el Laboratorio de preguntas con las tablas del cálculo (`marts.fct_admission`, `marts.int_admission_episodes`). Documentos: «Peticiones de la dirección y el protocolo» y «Claves, capas y modelos». |
| Cómo se resuelve | Para cada pieza, buscar la regla del protocolo que la responde → «▶ Calcular» → Laboratorio: tabla de vuestro cálculo, «Contar cuántas filas hay», condición sobre la marca de reingreso → escribir la cifra. |
| Por qué el Laboratorio | Antes un botón daba la cifra directamente. Ahora se usa la misma herramienta que en la sala 1: el alumno formula la pregunta y ve la SQL. Tras «▶ Calcular», el laboratorio se actualiza solo con las tablas nuevas (y tiene «↻ Actualizar tablas»). |
| Si falla | «Esa respuesta no es correcta». Lumi ve qué pieza está mal (`slotKey`) y la última consulta del laboratorio. |
| Aviso amarillo | Estancias negativas: «lo investigaréis en la sala siguiente». |

## Pasos (método, no respuesta)
Los pasos de los dos niveles ya no dicen qué opción elegir: dicen **dónde mirar y cómo trabajar** (abrir el documento, leer qué es una fila, buscar la regla del protocolo, contar con el laboratorio). Lo concreto queda para las pistas de Lumi.

## Probado
Speedrun e2e: tarjetas sin `fct_`/`dim_`, un tipo mal a propósito → tarjeta en rojo → se quita al cambiarla; unión por clic en dos tarjetas; dos dimensiones no se unen; el resto con «Desde / Hasta». R3C: protocolo completo visible y cifra obtenida con el Laboratorio sobre `marts.fct_admission`. Unit: diagnóstico de piezas.
