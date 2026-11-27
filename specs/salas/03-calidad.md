# Sala 3 · Calidad (R4) — «Alguien ha tocado los datos»

**Objetivo:** investigar datos raros como detectives: patrones, personas que conocen el sistema y decisiones prudentes. **~16 min.**
**Briefing:** entender tres problemas de los datos · entrevistar a Noa y Brais (IA) para saber su causa · decidir qué hacer y contar lo que se quita.

**Cambio 26-nov:** se quita el nivel «Tablero de pruebas» (`r4a_pruebas`, elegir la causa de cada grupo en una lista): sobraba, y la causa es justo lo que se descubre en las entrevistas. La sala empieza por las entrevistas.

## 3.1 Entrevistas (`r4b_entrevistas`, IA) · ~8 min · 2/5
| | |
|---|---|
| Hace | Pregunta a Noa (Informática) y Brais (Admisiones) para resolver 3 preguntas. 6 preguntas por personaje. |
| Objetivo claro (**cambio 26-nov**) | La misión explica la situación (la cifra es provisional, tres grupos de registros sin sentido; los datos dicen qué, no por qué). Debajo, **«🔎 Los tres problemas que han encontrado los detectores»**: una tarjeta por problema con **qué se ha visto** (en palabras llanas, sin la causa), las cifras (registros, centros, fechas), **por qué importa** y el estado «❓ ¿Por qué pasa? Aún no lo sabéis» / «✔ Ya sabéis por qué pasa». Se quitó el recuadro «🎯 Qué queréis descubrir» (decía la pregunta exacta y quién la sabía: daba demasiada solución). Quién sabe qué se deduce del puesto: Informática (sistemas) y Admisiones (cómo se apuntan ingresos, altas y defunciones). |
| No bloquea, no salta | Antes el nivel se cerraba solo al conseguir 2 pistas (el alumno no llegaba a leer la respuesta) y sin pistas no se podía seguir. Ahora **nunca avanza solo** y el botón **«Terminar las entrevistas y seguir ▶»** está siempre (con 0 pistas pide confirmación). Cada pista vale más confianza: 0 pistas = 25 % del nivel, 3 pistas = 100 %. |
| Información en pantalla | Las tres tarjetas de problemas encima del chat (las mismas del veredicto). |
| Revelado | Noa: centro, fecha o migración. Brais: el tema (turno de noche / defunciones). Una pregunta vaga no da pista, pero la respuesta sugiere de qué preguntar. |

## 3.2 Veredicto (`r4c_veredicto`) · ~4 min · 2/5
3 desplegables (corregir / documentar / excluir y documentar / excluir y escalar) sobre las mismas tarjetas. Regla de oro en la misión: un dato clínico no se inventa. El paso 3 ya no dice qué grupo «arregla la fusión»: remite al documento del método. Los desplegables mal elegidos salen en rojo.

## 3.3 Registros excluidos (`r4d_codigo`) · ~4 min · 1/5
Suma de las tarjetas que el veredicto excluye. El «qué escribir» ya no nombra los dos grupos («cuántos registros quitan del cálculo vuestras reglas»): hay que conectar con la decisión anterior.

## Probado
Speedrun e2e: tarjetas con «Por qué importa» en las entrevistas, sin lista de objetivos, ✔ en cada tarjeta al conseguir su pista, pregunta vaga sin pista, las 3 pistas con ✔, el nivel no avanza solo y se sigue con el botón. Unit: entrevistas en castellano y gallego; las pistas no cierran el nivel; «seguir» siempre válido.
