# BUILD REPORT (seed 20261117)

- Pacientes únicos: 9003 (filas en patients.csv: 9015)
- Encuentros únicos: 59484
- Episodios (modelo base): 4786; (limpio): 4752
- Reingresos 30d base: 481; limpio: 475 → tasa limpia 10.0 %
- Registros excluidos R4C: 35
- Centro con mayor tasa (n≥30): Hospital Illa Verde-F

## Tasa por centro (modelo limpio)

| name                                            |   altas |   reing |   tasa |
|:------------------------------------------------|--------:|--------:|-------:|
| Clínica Illas Cíes                              |       3 |       3 |  100   |
| Hospital Illa Verde-F                           |     746 |     137 |   18.4 |
| Complexo Hospitalario do Miño-F                 |     588 |      58 |    9.9 |
| Hospital da Mariña Alta-F                       |     499 |      48 |    9.6 |
| Hospital Comarcal Ría Norte                     |     598 |      50 |    8.4 |
| Hospital Val do Sar-F                           |     482 |      40 |    8.3 |
| Hospital Santa Eira                             |     529 |      42 |    7.9 |
| Hospital Universitario Costa Atlántica (HUCA-F) |     990 |      75 |    7.6 |
| Hospital Terra de Montes-F                      |     317 |      22 |    6.9 |

## Objetivos 9.1

- Pacientes 8.000-10.000: OK
- Episodios 2.500-6.000: OK
- Tasa 9-14 %: OK
- ≥8 centros con ≥100 ingresos: OK

## Notas
- Base clínica: Synthea (ADR 002), localizada a Galicia; reingresos naturales adelgazados y señal añadida hasta 9-14 %.
- T12 (6 ingresos sin alta) añadida para la afirmación falsa de R1C.
- Base = inpatient con stop_ts no nulo; limpio = base sin T4 (stop<start) ni T5 (inicio posterior al fallecimiento).