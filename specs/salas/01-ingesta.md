# Sala 1 · Ingesta (R1) — «La bandeja de entrada»

**Objetivo:** recibir datos de otros sin romperlos, limpiar un reenvío, desconfiar de una IA y proteger datos personales. **~33 min.**
**Briefing:** cargar 8 ficheros con su formato · decidir qué hacer con un fichero repetido · pillar a una IA que miente · proteger datos (RGPD).
Respuestas: `SOLUCION.md` (R1A-R1C, R2A).

## 1.1 La bandeja de entrada (`r1a_bandeja`, cargador) · ~12 min · 3/5
| | |
|---|---|
| Hace | Para cada uno de 8 ficheros elige separador, codificación y formato de fecha hasta que la vista previa salga limpia; «Cargar este fichero» ×8 y «Validar carga». |
| Cambio 26-nov | Antes casi todos se leían con coma y UTF-8 y solo había que cambiar la fecha. Ahora **cada sistema exporta a su manera**: barra vertical (`organizations`), tabulador + Latin-1 (`conditions`), Latin-1 (`encounters_H2`), punto y coma + Latin-1 + día/mes/año (`encounters_H3`) y tabulador (`encounters_H4`). Los valores no cambian (mismos datos canónicos y respuestas); solo cómo están escritos (`FORMATS` en `data/03_inject.py`, `apps/server/src/loader-truth.ts`). |
| Información en pantalla | Vista previa de las primeras filas; avisos en lenguaje llano bajo la tabla («Solo se ve UNA columna enorme: mira qué símbolo se repite…», «símbolos raros: cambia la codificación»); hoja de especificaciones del fichero (acierta salvo la codificación de H2 y H3); nota verde para las 17 filas rotas de H4. |
| Cómo se resuelve | Fichero a fichero: separador hasta que salgan las columnas, codificación hasta que se vean las tildes, fecha hasta que no haya filas rojas. Las 17 filas rechazadas de H4 son correctas. |
| Si falla | Se marca el fichero que no cuadra (validación fichero a fichero). |
| Ayudas | 1 qué mirar en cada fichero, 2 cómo reconocer separador/codificación y que la hoja falla en dos, 3 las combinaciones que no son las normales, solución. |

## 1.2 El reenvío (`r1b_reenvio`, decisión + código) · ~6 min · 2/5
| | |
|---|---|
| Hace | Elige qué hacer con los duplicados (afecta a la confianza) y cuenta `encounter_id` distintos en el laboratorio. |
| Información en pantalla | Opciones con su explicación; laboratorio con la tabla `encounters` y las preguntas en castellano; los pasos dicen las dos preguntas exactas (filas vs. distintos). |
| Cómo se resuelve | Decidir → «Contar filas» → «Contar valores DISTINTOS» en `encounter_id` → copiar ese número. |
| Si falla | «No es correcto»; Lumi ve la última consulta y su resultado. |

## 1.3 Auditoría de Ada (`r1c_ada`, verificación) · ~10 min · 2-3/5
| | |
|---|---|
| Hace | Comprueba 6 afirmaciones y marca las 2 falsas (cada falsa marcada de más: −2 de confianza). |
| Información en pantalla | Botón **«🔬 Comprobar»** por afirmación que prepara el laboratorio (tabla + tipo de pregunta); el alumno elige columna/condición y compara con lo que dice Ada. |
| Cómo se resuelve | Comprobar las 6 una a una; las que no coinciden con el laboratorio son las falsas. La clave conceptual: fichas ≠ personas (contar por `ssn`). |
| Si falla | Se dice qué afirmación está mal clasificada (no cuál es la buena). |

## 1.4 Radar RGPD (`r2a_radar`, decisión) · ~5 min · 2/5
| | |
|---|---|
| Hace | Clasifica **8 columnas** en Eliminar / Pseudonimizar / Mantener / Generalizar (dos o tres por acción). Admite 1 «mejorable». |
| Cambio 26-nov | Antes eran las 19 columnas de `patients` y se hacía pesado; 11 no se usan en ningún sitio del proyecto. Ahora salen en una franja gris como «ya quitadas por Noa» y solo se deciden `patient_id`, `ssn`, `first_name`, `address`, `birthdate`, `postal_code`, `gender` y `deathdate`. |
| Información en pantalla | Recuadro con la regla de las 4 acciones encima de los cajones y, en cada columna, qué contiene y su riesgo. No dice la acción: la deduce el alumno con la regla. |
| Cómo se resuelve | Identifica y no hace falta → eliminar; identifica pero hace falta para unir → pseudonimizar; útil pero muy exacta → generalizar; inofensiva → mantener. |
| Si falla | Columnas en rojo con el motivo (identifica en claro / hace falta para unir / hay un tratamiento mejor). Dejar un identificador en claro baja la confianza (−6 la primera vez). |

## Probado
Speedrun e2e completo de la sala (incluye un fallo en R1C y otro en R2A a propósito), unit de `diagnose` en R2A, captura visual de R1A y R1C.
