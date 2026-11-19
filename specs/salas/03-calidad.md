# Sala 3 · Calidad (R4) — «Alguien ha tocado los datos»

**Objetivo:** investigar datos raros como detectives: patrones, personas que conocen el sistema y decisiones prudentes. ~25 min.
**Briefing:** causa de tres grupos raros · entrevistar a Noa y Brais (IA) · decidir qué hacer y contar lo que se quita.

## 3.1 Tablero de pruebas (`r4a_pruebas`)
- **Hace:** asigna a 3 grupos (estancias negativas, encuentros tras fallecer, fragmentación en H3) una de 3 causas.
- **Dificultad:** 2/5. Los nombres ayudan; el criterio («un fallo de migración tiene fecha y lugar») está en los pasos.
- **Cambio:** las causas llevan explicación entre paréntesis («Error de captura (al teclear)», «Error de migración (cambio de sistema)»).

## 3.2 Entrevistas (`r4b_entrevistas`, IA)
- **Hace:** consigue 2 de 3 pistas preguntando a Noa (concreción: centro + fecha) y Brais (empatía + tema). 6 preguntas por personaje.
- **Dificultad:** 3/5. La regla de revelado es determinista por palabras clave.
- **Fallo corregido:** en gallego Brais no entendía «noite», «quenda», «imaxino», «falecemento»… → palabras gl añadidas (`content/characters/*.yaml`) y test unitario en gallego.
- **Cambio:** pasos con cómo hablar a cada uno; pista 3 da preguntas de ejemplo.

## 3.3 Veredicto (`r4c_veredicto`)
- 3 desplegables (documentar / excluir y documentar / excluir y escalar). Dificultad 2/5. Regla de oro en la misión: un dato clínico no se inventa.

## 3.4 Registros excluidos (`r4d_codigo`)
- Suma dos contadores de las tarjetas (35). Dificultad 1/5; sirve de respiro y refuerza qué se excluye y qué no.

## Probado
Speedrun e2e (pregunta vaga sin pista y luego las buenas), unit de entrevistas en castellano y gallego.
