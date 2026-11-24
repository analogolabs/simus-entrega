# SIMUS — procedencia de los registros de demostración

. La procedencia vive en **una tabla propia del kit de demo, `dbo.DatosDeDemostracion`**, que crea únicamente `scripts/demo/siembra-integral.sh preparar`
(`siembra/kit/00_procedencia.sql`). **No está en `simus-database/schema`, no la crea DbUp y producción no la tiene.** Ninguna ficha pública muestra etiquetas: la marca es interna.
(`ProcedenciasDeRegistro`, la tabla de negocio con contexto `siembra`, es otra cosa y se rellena cuando el API la exige.)

## Columnas

| Columna | Significado |
|---|---|
| `Tabla`, `IdRegistro` | Tabla de negocio (sin esquema) y su clave primaria como texto. Único conjunto `(Tabla, IdRegistro)`. Sin FK: la tabla no depende del esquema y se puede retirar sin dejar rastro. |
| `Lote` | Agrupa lo que se siembra y se retira junto: `cuentas-validacion`, `n1-festivales`, `n1-mercados`, `n2-organizaciones`, `n3-cobertura`, … |
| `Procedencia` | `publico` (dato verificable de fuente pública), `sintetico` (inventado), `hibrido` (estructura pública + contenido inventado). |
| `Fuente` | URL o referencia pública. **Obligatoria si no es sintético** (CHECK). Las imágenes anotan su fuente aquí y en `Archivos.Credito`. |
| `Nivel` | 0 cuentas de validación, 1 audiovisual (muy profundo), 2 exploración, 3 cobertura. |
| `ClaveEstable` | Identificador legible y permanente, **solo niveles 0 y 1**: es lo que citan los guiones de los videos y el recorrido de aceptación. Único. |
| `Semilla` | Semilla del generador que produjo la fila (reproducibilidad). |
| `FechaSiembra` | Marca de tiempo UTC. |

## Reglas de procedencia

- **Público**: solo hechos citados (nombre, municipio, año, fechas, sede, organizador) de `datos/*.json`. La certeza «baja» se siembra como festival histórico, sin ediciones inventadas.
- **Híbrido**: festival/mercado real con contenido inventado alrededor (programación, noticias, participantes). Participaciones y artistas **siempre sintéticos**; nunca atribuidos a una persona u organización real.
- **Sintético**: entidades ficticias que no imitan nombres reales. Personas con nombres inventados y correos `.test`.
- Una fila de `DatosDeDemostracion` por cada fila de negocio sembrada (también pivotes principales), no por cada pivote menor.

## Cómo se identifican los registros de los videos (nivel 1)

Claves estables con la forma `n1.<tipo>.<nombre-corto>` (minúsculas, sin tildes, hasta 80 caracteres):
`n1.festival.rock-al-parque`, `n1.edicion.rock-al-parque-2025`, `n1.mercado.circulart`, `n1.organizacion.<nombre>`, `n1.persona.<nombre>`, `n1.noticia.<tema>`, `n1.evento.<tema>`, `n1.reclamacion.<escenario>`.
Las cuentas de validación usan `n0.cuenta.<rol>` (p. ej. `n0.cuenta.externo-camila`).

```sql
-- los registros de los videos y a qué fila apuntan
SELECT ClaveEstable, Tabla, IdRegistro, Procedencia, Fuente FROM dbo.DatosDeDemostracion WHERE Nivel = 1 ORDER BY Tabla, ClaveEstable;
-- resolver una clave concreta
SELECT Tabla, IdRegistro FROM dbo.DatosDeDemostracion WHERE ClaveEstable = N'n1.festival.rock-al-parque';
-- resumen del entorno
SELECT Lote, Nivel, Procedencia, COUNT(*) AS Filas FROM dbo.DatosDeDemostracion GROUP BY Lote, Nivel, Procedencia ORDER BY Nivel, Lote;
```

Por línea de órdenes: `./scripts/demo/siembra-integral.sh estado` y `./scripts/demo/siembra-integral.sh identificar 1`.

## Retirar un lote

El generador es idempotente por `(Tabla, IdRegistro)`. Retirar un lote es borrar sus filas de negocio en orden inverso de dependencias (plan de limpieza en `siembra/docs/limpieza-controlada.md`) y luego sus filas de `DatosDeDemostracion`. Nada de esto toca los catálogos.

## Aviso de entorno

Si el entorno completo llega a ser accesible a terceros debe identificarse como demostrativo (aviso discreto, texto «Datos utilizados exclusivamente con fines demostrativos»), ver `docs/demo-azure-precauciones` en la memoria del proyecto: las cuentas con clave «admin» no se exponen en una demo pública.
