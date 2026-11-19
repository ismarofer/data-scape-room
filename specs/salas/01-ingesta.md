# Sala 1 · Ingesta (R1) — «La bandeja de entrada»

**Objetivo:** recibir datos de otros sin romperlos, limpiar un reenvío, desconfiar de una IA y proteger datos personales. ~30 min.
**Briefing:** cargar 8 ficheros con su formato · decidir qué hacer con un fichero repetido · pillar a una IA que miente · proteger datos (RGPD).
Respuestas: `SOLUCION.md` (R1A-R1C, R2A).

## 1.1 La bandeja de entrada (`r1a_bandeja`, cargador)
- **Hace:** para cada uno de 8 ficheros elige separador, codificación y formato de fecha hasta que la vista previa salga limpia; «Validar carga».
- **Dificultad:** 3/5. Repetitivo (8 ficheros), con una sola trampa real (H3: «;», Latin-1, fecha d/m/a) y una trampa de comprensión (H4 tiene 17 filas rotas que *deben* rechazarse).
- **Simplificaciones que ya había y se mantienen:** avisos en lenguaje llano bajo la tabla («Solo se ve UNA columna enorme: el separador no es el correcto»), nota verde para las 17 filas de H4.
- **Cambio aplicado:** misión de 3 frases, 4 pasos cortos, ficha «¿Qué es esto?» del fichero; Lumi ve opciones de cada fichero, cuáles están cargados y qué dice el servidor de cada uno (`r1a` se valida fichero a fichero).
- **Propuesta pendiente:** marcar en la lista de ficheros un ⚠ cuando la vista previa tiene avisos, para no tener que abrir uno a uno.

## 1.2 El reenvío (`r1b_reenvio`, decisión + código)
- **Hace:** elige qué hacer con los duplicados (afecta a medidores) y cuenta `encounter_id` distintos en el laboratorio.
- **Dificultad:** 2/5 con los pasos (filas vs. distintos).
- **Cambio:** pasos con las dos preguntas exactas del laboratorio; el aviso de medidores muestra el efecto de la decisión.

## 1.3 Auditoría de Ada (`r1c_ada`, verificación)
- **Hace:** comprueba 6 afirmaciones y marca las 2 falsas (cada falsa marcada de más: −10).
- **Dificultad antes:** 4/5 — había que saber construir 6 consultas, una con dos condiciones y otra con «no aparece en otra tabla».
- **Simplificación aplicada:** botón **«🔬 Comprobar»** por afirmación que prepara el laboratorio (tabla + tipo de pregunta; columna solo si no delata la respuesta). Afirmaciones numeradas y marca «← marcada como FALSA». **Dificultad ahora: 2-3/5**; se conserva lo importante (interpretar: 9 015 fichas ≠ 9 003 personas).
- **Riesgo:** Lumi en nivel 0 llegó a señalar qué afirmaciones mirar → regla reforzada (ver UI 03).

## 1.4 Radar RGPD (`r2a_radar`, decisión)
- **Hace:** clasifica 19 columnas en Eliminar / Pseudonimizar / Mantener / Generalizar.
- **Dificultad:** 3/5; con `docs/guia-privacidad.md` es consulta. Admite hasta 3 «mejorables».
- **Cambio:** misión explica «pseudonimizar» y «generalizar» entre paréntesis; regla práctica de 4 líneas en los pasos; Lumi ve qué columnas están en cada cajón y cuáles marca mal el servidor (crítico/bloqueante).
- **Consecuencia visible:** dejar un identificador en claro baja Cumplimiento (−20 la primera vez) con aviso.

## Probado
Speedrun e2e completo de la sala (incluye un fallo en R1C y otro en R2A a propósito), unit de `diagnose` en R2A, captura visual de R1A y R1C.
