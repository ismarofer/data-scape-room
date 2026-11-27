# Sala 5 · Predicción, bonus (R6) — «¿Podemos anticiparnos?»

**Objetivo:** un modelo que avise antes del alta, sin trampas, con límites reales y justo. Opcional: «Saltar a la Comisión». **~20 min.**
**Briefing:** entrenar · evitar usar datos del futuro · elegir cuántas llamadas y revisar la equidad.

## 5.1 Entrenar el modelo (`r6a_entrenar`) · ~7 min · 3/5
| | |
|---|---|
| Hace | Marca variables, entrena, entrega. |
| Información en pantalla | Lista de variables con su nombre en castellano; AUC explicado en una línea (0,5 = azar, 1 = acertar siempre); la misión dice «solo vale lo que se sabe en el momento del alta». |
| Cómo predice (**27-nov**) | Bajo las cifras, «¿Qué significa cada medida?» (AUC, sensibilidad, precisión, reingresos reales, matriz de confusión, en una frase cada una) y el gráfico **«¿Cómo predice este modelo?»**: pacientes ordenados por el riesgo que da el modelo y partidos en 10 grupos; puntos = % real que volvió en cada grupo, línea = % que predijo el modelo, discontinua = media (un modelo que no sabe nada); debajo, una rayita por paciente (roja = volvió). Con un modelo honesto la línea sube poco a poco (AUC ≈ 0,70); con la variable trampa, los grupos 1-7 salen a 0 % y el 10 casi al 100 %: se ve que es «demasiado bueno». |
| Cómo se resuelve | Entrenar con todo → AUC ≈ 0,99 «demasiado bueno» → buscar la variable que habla del futuro → quitarla → entrenar y entregar. El servidor rechaza la variable trampa explicando por qué. |

## 5.2 Umbral con presupuesto (`r6b_umbral`) · ~5 min · 2/5
Deslizador hasta ≤ 40 llamadas/semana y ≥ 30 % detectado. Los dos contadores están en pantalla; el «qué escribir» dice las dos condiciones. Muy visual.

## 5.3 Equidad y decisión (`r6c_equidad`) · ~6 min · 3/5
Elige desplegar / con revisión / no, y escribe una frase ≥ 40 letras que nombre grupos y revisión. Las barras rojas marcan los grupos con menos aciertos. La rúbrica es por palabras clave; el mensaje de error dice qué falta.

## Si va justo de tiempo
El facilitador o el propio equipo puede pulsar «⏭ Saltar a la Comisión» al entrar: la sala no es necesaria para el final.

## Probado
Speedrun e2e con las tres entregas y el gráfico de predicción (10 grupos) y la ayuda de las medidas.
