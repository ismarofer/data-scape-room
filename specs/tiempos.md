# Estimación de tiempos por sala y nivel (24-nov-2026)

Para un equipo de 2-3 alumnos de 16 años, sin experiencia con datos, que pide alguna pista. Son los minutos que se ven en la cabecera de cada nivel (`time_target_min`) y en el briefing de cada sala (`target_minutes`). **Hay que validarlos en el ensayo** (M10): la consola del facilitador ya registra minutos y ayudas por nivel.

| Sala | Nivel | Min | Dónde se va el tiempo |
|---|---|---|---|
| — | Historia (4 pantallas) + guía de la pantalla | 5 | Lectura. |
| **0 · Tutorial** | El primer candado | 3 | — |
| | **Total sala 0** | **8** | |
| **1 · Ingesta** | La bandeja de entrada | 12 | 8 ficheros; 5 necesitan algo distinto de lo normal (separador, codificación o fecha). |
| | El reenvío | 6 | Dos consultas en el laboratorio. |
| | Auditoría de Ada | 10 | 6 comprobaciones. |
| | Radar RGPD | 5 | 8 columnas (las otras 11 salen ya quitadas). |
| | **Total sala 1** | **33** | La sala más larga: si un equipo va lento, el facilitador mira aquí. |
| **2 · Modelado** | Esquema en estrella | 7 | Sin prefijos hay que leer qué es cada fila y sus columnas. |
| | Modelo de reingreso | 13 | Leer el protocolo (antes era otro nivel), cálculo en el navegador (≈ 20-60 s) y contar con el Laboratorio. |
| | **Total sala 2** | **20** | El nivel «El protocolo» se fusionó con el del modelo (ADR 014). |
| **3 · Calidad** | Entrevistas | 8 | Leer las 3 tarjetas de problemas y escribir preguntas; se sigue cuando se quiera. (El «Tablero de pruebas» se quitó el 26-nov.) |
| | Veredicto | 4 | |
| | Registros excluidos | 4 | Hay que conectar con el veredicto. |
| | **Total sala 3** | **16** | |
| **4 · Visualización** | KPI con sentido | 6 | Mirar la tabla de centros y decidir el mínimo. |
| | Constructor de dashboard | 8 | Gráficos libres: hay que pensar qué enseñar. |
| | Revisión del crítico | 8 | Solo lo rojo es obligatorio. |
| | El centro con mayor tasa | 6 | Montar la pregunta en el Laboratorio (porcentaje por centro con el mínimo). |
| | **Total sala 4** | **27** | (28 ajustado: lo amarillo no obliga a más vueltas) |
| **5 · Predicción (bonus)** | Entrenar el modelo | 7 | |
| | Umbral con presupuesto | 5 | |
| | Equidad y decisión | 6 | Escribir la frase. |
| | **Total sala 5** | **20** | Se puede saltar. |
| **F · Presentación** | La Comisión | 17 | 5 respuestas de ~3 min + resultado (27-nov: antes 6). |

## Totales
| | Min |
|---|---|
| Juego completo (historia + 7 salas, 18 niveles) | **≈ 141** |
| Sin la sala bonus | **≈ 121** |
| Sesión prevista (`session.yaml → target_minutes`) | 180 |
| Margen | ≈ 39 min con bonus · ≈ 59 sin bonus (arranque, dudas, descanso) |

## Reglas de gestión del tiempo
- A los **105 min** un equipo debería estar entrando en la sala 4. Si no, que salte la sala 5 («⏭ Saltar a la Comisión»).
- La Comisión debe empezar como muy tarde a los **155 min**.
- Las ayudas de Lumi se abren antes que en la versión del 19-nov (pista 2 a los 2 min o tras 1 fallo, pista 3 a los 4 min o tras 2 fallos, solución a los 6 min o tras 2 fallos): **ningún nivel debería bloquear a un equipo más de ~6-7 minutos** si piden ayuda.
