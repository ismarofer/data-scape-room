# UI 06 · Medidores y puntos: que se note

## Problema de partida
Confianza, cumplimiento y calidad cambiaban en silencio en la barra inferior; la puntuación ni se veía. Además la leyenda prometía cosas que no existen (auditoría si cumplimiento < 50, bonus de tiempo) y mostraba «Créditos de IA», que no se pueden gastar desde ninguna pantalla.

## Comportamiento
- Barra inferior: ⏱ tiempo · 🏆 Puntos · 🤝 Confianza · 🛡 Cumplimiento · 🧹 Calidad de datos (sin créditos de IA).
- **Cada cambio** (en cualquier portátil del equipo) produce:
  - un **aviso** centrado abajo, 6,5 s, clic para cerrar: título = motivo («Decisión: «Quedarse con la última versión…»», «Pista 1 de Lumi», «Entrega: Radar RGPD») y una línea por medidor («🧹 Calidad de datos +10», «🏆 Puntos −5»);
  - al superar un nivel, aviso dorado «🔓 ¡Nivel superado! <título>» con los puntos;
  - el medidor parpadea en verde/rojo y muestra «+10 / −5» flotando 2,6 s.
- El motivo lo pone el portátil que actuó (`noteAction`); los demás ven el cambio con un título genérico.
- Respeta «reducir movimiento».
- ❓ Medidores explica cada uno sin promesas falsas.

## Probado
E2E: aviso «Nivel superado» al abrir el tutorial; aviso «Pista 1 de Lumi · Puntos −5». Revisión visual con capturas (19-nov).

## Pendiente (propuesta)
- Historial de cambios («¿por qué tengo 55 de confianza?») en un desplegable del medidor, leyendo `meter_history`.
- Si se implementan los eventos E1-E6 (auditoría, prensa…), usar el mismo aviso.
