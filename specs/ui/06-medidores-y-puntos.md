# UI 06 · Un solo medidor: ⭐ Confianza de la Comisión

## Problema de partida
Había **puntos y tres medidores** (confianza, cumplimiento, calidad). Para un alumno de 16 años eran demasiados números y no estaba claro para qué servía cada uno (ADR 014).

## Ahora
- **Un solo indicador**, en la barra inferior: **⭐ Confianza de la Comisión** (0-100, con barra). Empieza en 40. **No hay puntos.**
- Todo lo que antes daba o quitaba puntos o medidores mueve este número:

| Acción | Efecto |
|---|---|
| Superar un nivel | +1 a +5 (según su peso: `points / 40` del candado) |
| Entrevistas | según las pistas conseguidas (25 % del nivel sin pistas, 100 % con las 3) |
| Dashboard con avisos 🟡 | −15 % del premio del nivel por aviso (máximo −60 %) |
| Decisión (p. ej. el reenvío) | media de sus efectos antiguos: «Quedarse con la última versión» +5, «Cargar todo» −5 |
| Cada pregunta a Lumi (ADR 015) | −1 |
| Pista 1 / 2 / 3 de Lumi | −5 cada una (antes −1 / −2 / −3) |
| Solución de Lumi | −10 (antes −5) |
| Marcar como falsa una afirmación cierta (R1C) | −2 por marca |
| Dejar un dato identificativo a la vista (R2A) | −6 la primera vez, −2 después |
| Llave maestra (facilitador) | −10 |
| Cada insignia al final | +2 |

- La Comisión usa la confianza junto a sus votos para el final (≥ 80: +2, ≥ 60: +1, < 35: −1).
- **Cada cambio** produce un aviso abajo («Pista 1 de Lumi · ⭐ Confianza de la Comisión −5», «Pregunta a Lumi · … −1») y el número parpadea con «+3 / −1».
- ❓ Confianza (barra inferior) explica de qué depende. El botón de pistas dice «(−5 confianza)».
- Facilitador: columna «Confianza» (en rojo por debajo de 35) en lugar de puntos, cumplimiento y calidad.

## Datos
Se guarda en `meters.trust`; `compliance`, `quality` y `teams.score` se conservan solo por compatibilidad. `state.score` devuelve la confianza.

## Probado
Unit: tutorial 40 → 41; decisión arriesgada −5; marca falsa −2; dato a la vista −6; escalera −5/−5/−5/−10; cada pregunta a Lumi −1 (los mensajes bloqueados no); llave maestra −10. E2E: aviso «Pregunta a Lumi … −1» tras la pregunta rápida y «Confianza de la Comisión −5» al pedir la pista 1.
