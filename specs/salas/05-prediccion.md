# Sala 5 · Predicción, bonus (R6) — «¿Podemos anticiparnos?»

**Objetivo:** un modelo que avise antes del alta, sin trampas, con límites reales y justo. Opcional: «Saltar a la Comisión». ~20 min.
**Briefing:** entrenar · evitar usar datos del futuro · elegir cuántas llamadas y revisar la equidad.

## 5.1 Entrenar el modelo (`r6a_entrenar`)
- Marca variables, entrena, entrega. La variable trampa da AUC ≈ 0,99 y el servidor la rechaza explicando por qué.
- **Dificultad:** 3/5. El paso 2 explica el AUC en una línea (0,5 = azar, 1 = acertar siempre).

## 5.2 Umbral con presupuesto (`r6b_umbral`)
- Deslizador hasta ≤ 40 llamadas/semana y ≥ 30 % detectado (≈ 15-17 %). Dificultad 2/5, muy visual.

## 5.3 Equidad y decisión (`r6c_equidad`)
- Elige desplegar / con revisión / no, y escribe una frase ≥ 40 letras que nombre grupos y revisión.
- **Dificultad:** 3/5 por la frase. La rúbrica es por palabras clave; el mensaje de error dice qué falta.

## Probado
Speedrun e2e con las tres entregas.
