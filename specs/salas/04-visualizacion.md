# Sala 4 · Visualización (R5) — «Que lo entienda la comisión»

**Objetivo:** contar la cifra sin engañar: indicador bien definido y gráficos honestos. **~25 min.**
**Briefing:** indicador que no engañe · cuadro de mando de 3-4 gráficos · revisión del crítico y centro con más reingresos.

## 4.1 KPI con sentido (`r5a_kpi`) · ~6 min · 2/5
| | |
|---|---|
| Hace | Elige cómo se calcula la tasa, **escribe** el mínimo de altas y decide qué hacer con el centro de 3 casos. |
| Problema detectado (24-nov) | «30 altas» parecía un número mágico: había que elegir entre 10 / 30 / 1 000 sin datos que lo justificaran. |
| Ahora | El nivel enseña la **tabla de los 9 centros** (altas, reingresos, tasa) con una columna **«1 reingreso más mueve la tasa… X puntos»** (33 puntos en la clínica de 3 casos; 0,3 en un hospital de 300). Al escribir un mínimo, la tabla marca qué centros se publicarían. **Vale cualquier mínimo entre 4 y 317**: deja fuera la clínica y mantiene todos los hospitales (`numeric_ranges` del candado, solo en servidor). El documento explica de dónde sale la costumbre real de 25-30 altas. |
| Si falla | Se pinta en rojo el desplegable o la caja que no vale (el mínimo, si deja fuera hospitales o mantiene la clínica). |
| Después | El mínimo del equipo se guarda y se usa en el dashboard («Aplicar vuestro mínimo de altas (≥ N)») y en R5D. |

## 4.2 Constructor de dashboard (`r5b_dashboard`) · ~8 min · 2/5
| | |
|---|---|
| Hace | Monta 3-4 gráficos **libres**: «＋ Añadir gráfico» y en cada uno **Tipo** (barras, línea, tabla, número grande) × **Qué dato** (tasa, nº de reingresos, nº de altas) × **Repartido por** (centro, tramo de edad, área sanitaria, mes, año), n, mínimo de altas, orden y colores. |
| Tipos trampa (26-nov) | Además de barras, línea, tabla y número grande, se ofrecen **área**, **tarta** y **anillo**. Tarta y anillo son **siempre 🔴** (el ojo compara mal ángulos; y una tasa por grupo no es parte de un total). El área cumple la regla de la línea (solo para tiempo). |
| Quitado | Las casillas «doble eje», «3D» y «el eje empieza en cero»: no tenía sentido elegirlas. Los gráficos se dibujan siempre con el eje en cero, sin 3D ni doble eje (lo dice una línea bajo las opciones). |
| Título | **Automático (26-nov):** se genera de lo elegido («Tasa de reingreso a 30 días por centro · centros con el mínimo de altas»). Antes había que escribirlo y el crítico lo juzgaba; escribirlo era un trámite y no es lo que enseña el nivel. |
| Se entrega | Con 3-4 gráficos. Aquí no se corrige: lo revisa el crítico en el nivel siguiente. |

## 4.3 Revisión del crítico (`r5c_critico`) · ~8 min · 3/5
| Color | Qué significa | Reglas |
|---|---|---|
| 🔴 Engaña | **Bloquea** la entrega | Comparar el **número** de reingresos entre centros o áreas · una **línea** (o **área**) para algo que no es tiempo · **tarta o anillo**, siempre · tasa por centro **sin el mínimo** de altas · ningún gráfico con la **tasa** · menos de 3 o más de 4 gráficos |
| 🟡 Mejorable | **Deja seguir**, pero cada uno resta un 15 % de la confianza del nivel (hasta un 60 %) | Tasa sin n · barras de centros/áreas sin ordenar · demasiados colores · dos gráficos iguales · KPI con un número en vez de la tasa |
| 🔵 Sugerencia | No cuenta | Lo que añade el modelo de IA (siempre 🔵: la IA no puede bloquear) |

El botón cambia de texto: «Arreglad lo rojo (N) para entregar» (desactivado) → «Entregar con N aviso(s) 🟡» → «Entregar dashboard revisado». Los paneles con rojo o amarillo llevan el borde de ese color.

## 4.4 El centro con mayor tasa (`r5d_codigo`) · ~6 min · 2/5
**Cambio 26-nov:** se resuelve con el **Laboratorio de preguntas** (antes, un botón con la consulta hecha daba la respuesta de un clic). El laboratorio tiene una pregunta nueva, «Para cada valor de una columna: cuántas filas hay y qué % tiene una marca (sí/no)», con «Solo grupos con al menos … filas» (`group by` + `having` + `order by … desc`). Se hace en `canon.fct_admission_clean` · `organization_name` · marca `is_readmission_30d` · mínimo del equipo. Sin mínimo gana Illas Cíes (3 altas, 100 %): es la trampa. La respuesta es la misma con cualquier mínimo válido.

## Probado
Speedrun e2e: un gráfico de tarta se dibuja (y se cambia a barras); R5D en el laboratorio: sin mínimo sale Illas Cíes, con 30 sale la respuesta; mínimo 3 → caja en rojo → 30; dashboard con un gráfico de nº de reingresos por centro y una línea por meses; el crítico marca rojo y el botón está bloqueado; se arregla solo lo rojo y se entrega con avisos amarillos. Unit: mínimo 3 y 1 000 rechazados, 25 aceptado; crítico rojo con recuentos por centro.
