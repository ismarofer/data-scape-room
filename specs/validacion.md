# Validación: dificultad, explicaciones y fases (19-nov-2026)

Revisión de los 20 niveles con la mirada de un alumno de 16 años. Escala 1 (trivial) - 5 (bloqueante sin ayuda).

## 1. Dificultad por nivel
| Sala | Nivel | Antes | Ahora | Qué se hizo |
|---|---|---|---|---|
| 0 | El primer candado | 1 | 1 | Enseña además a pedir ayuda. |
| 1 | La bandeja de entrada | 3 | 3 | Textos cortos, ficha del fichero, Lumi ve opciones y diagnóstico por fichero. |
| 1 | El reenvío | 2 | 2 | Pasos con las preguntas exactas. |
| 1 | Auditoría de Ada | **4** | **2-3** | «🔬 Comprobar» prepara el laboratorio en cada afirmación. |
| 1 | Radar RGPD | 3 | 3 | Términos explicados en la misión; regla práctica en los pasos. |
| 2 | El protocolo | 2 | 2 | — |
| 2 | Esquema en estrella | 3 | 3 | Hecho/dimensión con ejemplo en la misión. |
| 2 | Modelo de reingreso | **5** | **2-3** | Piezas en castellano, protocolo al lado, sin SQL obligatorio. |
| 3 | Tablero de pruebas | 2 | 2 | Causas explicadas entre paréntesis. |
| 3 | Entrevistas | 3 (gl: 5) | 3 | Palabras clave en gallego; preguntas de ejemplo en la pista 3. |
| 3 | Veredicto | 2 | 2 | — |
| 3 | Registros excluidos | 1 | 1 | — |
| 4 | KPI con sentido | 2 | 2 | — |
| 4 | Constructor de dashboard | 1 | 1 | — |
| 4 | Revisión del crítico | 4 | 3-4 | Reglas repartidas en la escalera; Lumi ve hallazgos. Propuesta en sala 4. |
| 4 | Centro con mayor tasa | 1 | 1 | — |
| 5 | Entrenar / Umbral / Equidad | 3 / 2 / 3 | igual | AUC explicado en una línea. |
| F | La Comisión | 3 | 3 | Fórmula «cifra + límite + propuesta». |

Curva resultante: no hay ningún nivel ≥ 4 sin ayuda específica; los picos (R1C, R3C) bajaron a 2-3; cada sala empieza con algo asequible.

## 2. Explicaciones
- Misión ≤ 55 palabras, 3-4 pasos ≤ 30 palabras, «qué escribir» ≤ 35 palabras. **Los 20 niveles cumplen** (`content:validate` sin avisos).
- Lo largo (por qué importa, profesión, glosario) pasa a «📚 Saber más», plegado.
- Eliminadas referencias obsoletas: roles, «ficha del rol», «Sala 2», créditos de IA, promesas de auditoría y bonus de tiempo que no existen.

## 3. ¿Fase de explicación en cada sala?
Sí: **briefing** antes del primer nivel de cada sala (ver [UI 02](ui/02-guia-y-briefing.md)). No es un nivel (no puntúa), se ve una vez por portátil y se puede reabrir. Nombres de sala acordados: Tutorial, Ingesta, Modelado, **Calidad** (añadida: la investigación de datos sucios es una etapa propia), Visualización, Predicción (bonus) y Presentación.

## 4. Otras mejoras aplicadas
Lumi como única ayuda con escalera y solución ([UI 03](ui/03-asistente-lumi.md)); guía de pantalla con spotlight; ficha «¿Qué es esto?» unificada para ficheros, tablas y modelos; columnas plegadas en la base de datos; avisos de puntos y medidores; tecnología fuera de la vista (nombres de capas, SQL legible, «Calcular» en vez de «Ejecutar modelos y tests»).

## 5. Pendiente (no bloquea el evento)
- Ensayo con alumnado real (M10): medir minutos y ayudas por nivel y ajustar `help_gate_*` y costes.
- Revisión del gallego por persona nativa (todo el texto nuevo está en gl).
- Propuestas marcadas en cada sala (⚠ en la lista del cargador, explicación del resultado del laboratorio, plantilla de respuesta para la Comisión, historial de medidores).
- Lector de pantalla y navegadores distintos de Edge.

## 5 bis. Revisión del 23-nov: ¿se puede resolver con lo que hay en pantalla?
Repaso nivel a nivel buscando datos que el alumno necesita pero que no están en la pantalla del nivel, y dificultades motoras o de tono. Detalle en cada spec de sala y en el ADR 013.

| Nivel | Fallo | Arreglo | Dificultad |
|---|---|---|---|
| 0 · El primer candado | El hospital solo se nombraba en la historia/briefing. | La misión lo nombra. | 1 |
| 1 · Radar RGPD | La explicación de cada columna estaba en `docs/`. | Regla de 4 acciones + qué contiene y riesgo en cada columna; pista 3 cubre las 19. | 3 → 2 |
| 2 · Esquema en estrella | Puntos de conexión diminutos y dirección obligatoria. | Clic-clic o arrastrar desde la tarjeta; flecha automática; uniones sin sentido explicadas ([UI 08](ui/08-esquema-en-estrella.md)). | 3 → 2 |
| 3 · Entrevistas | Centro/fecha en el nivel anterior; dos grupos de palabras obligatorios; Noa seca. | Tarjetas encima del chat (con «H3»); basta con el tema; respuestas amables que sugieren el tema. | 3 → 2 |
| 3 · Tablero de pruebas | La tarjeta de fragmentación no decía qué centro. | Muestra «H3 (ORG05)». | 2 |
| 4 · KPI con sentido | El porqué del mínimo solo en `docs/`. | La misión lo dice. | 2 |
| Todas · Lumi y personajes | Tono de rechazo; falsos positivos del filtro de inyección. | Ver [UI 03](ui/03-asistente-lumi.md#tono-de-su-parte-nunca-hater-23-nov). | — |
| Todas · Ayudas | Solución a los 10 min o 3 fallos. | 6 min o 2 fallos. | — |

Sin fallos de este tipo: R1A, R1B, R1C, R3A (fusionado con R3C el 24-nov), R3C, R4C, R4D, R5B, R5C, R5D, R6A-C y la Comisión (toda su información está en la herramienta o en la misión). Tiempos: [tiempos.md](tiempos.md).

## 5 ter. Revisión del 24-nov (ADR 014)
| Nivel | Problema | Cambio | Dificultad |
|---|---|---|---|
| 2 · Esquema en estrella | Los prefijos `fct_`/`dim_` daban la respuesta; al fallar no se veía qué estaba mal. | Nombres sin prefijo + qué es una fila + columnas clave; posiciones mezcladas; documento nuevo con otro ejemplo; tarjeta/unión en rojo tras fallar. | 2 → 3 (sube a propósito: ahora hay que razonar) |
| 2 · El protocolo + Modelo de reingreso | Casi lo mismo dos veces. | Fusionados: protocolo completo junto a las piezas; la cifra se saca con el Laboratorio. | 3 |
| 2 · Pasos | Casi daban la respuesta. | Pasos = método y dónde mirar; lo concreto, en las pistas; documento enlazado. | — |
| 3 · Entrevistas | Avanzaba sola al conseguir 2 pistas; objetivo poco claro; sin pistas no se seguía. | Lista de 3 preguntas a resolver; nunca avanza sola; «Terminar las entrevistas y seguir» siempre; más confianza por pista. | 2 |
| 3 · Tablero / Veredicto / Excluidos | Sin marca de qué falla; pasos que daban la respuesta. | Desplegables en rojo; nº de centros en todas las tarjetas; pasos sin nombrar los grupos. | 2 / 2 / 2 |
| 4 · KPI | «30 altas» arbitrario. | Tabla de centros con «1 reingreso mueve la tasa X puntos»; mínimo numérico (vale 4-317); explicación en el documento. | 2 |
| 4 · Dashboard + crítico | Tipos fijos; casillas inútiles (doble eje, 3D, eje en cero); «≤ 1 hallazgo». | Gráficos libres (tipo × dato × reparto); eje en cero siempre; crítico 🔴 bloquea / 🟡 deja seguir con menos confianza / 🔵 sugiere. | 2 / 3 |
| Todas | Puntos + 3 medidores; «código». | Un solo medidor (⭐ Confianza de la Comisión); «respuesta»; Laboratorio disponible en todos los niveles con datos; documentación del nivel enlazada. | — |

## 6. Cómo se ha probado
| Prueba | Resultado (19-nov) |
|---|---|
| `npm test` (motor, Lumi, escalera, diagnóstico, gallego, fuga en bundle) | 53/53 ✔ |
| `npm run e2e` (speedrun 20 niveles, guía, Lumi, 2 portátiles, facilitador) | 4/4 ✔ |
| `npm run content:validate` | OK, 0 avisos |
| `npm run typecheck` | OK |
| Capturas en Edge 1440×860 + conversación con la IA real en 4 niveles | revisado; 1 fuga de Lumi corregida en el prompt |
| 23-nov: `npm test` / `npm run e2e` / `content:validate` / `typecheck` | 54/54 ✔ · 4/4 ✔ · OK · OK |
| 24-nov (ADR 014): `npm test` / `npm run e2e` / `content:validate` / `typecheck` | 54/54 ✔ · 4/4 ✔ · OK (19 niveles, 10 documentos) · OK |
