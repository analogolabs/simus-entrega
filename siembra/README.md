# Kit de siembra integral de demostración

. Genera, sin tocar producción ni migraciones, los datos de la demo: cuentas de validación (nivel 0), fichas audiovisuales (1), de exploración (2) y de cobertura (3), con procedencia registrada en una tabla propia del kit.

| Carpeta | Qué hay |
|---|---|
| `docs/mapa-de-campos.md` | Inventario de lo que se siembra, leído del esquema real (generado). |
| `docs/procedencia.md` | Tabla `DatosDeDemostracion` y cómo identificar los registros de los videos. |
| `docs/agenda-de-citas.md` | Agendas de citas de mercados (dos abiertas —stands fijos y mesas fijas—, borrador y cerrada) y el mapa cuenta → rol → ruta para probar organizando y participando. |
| `docs/limpieza-controlada.md` | Qué se vacía, qué se conserva y en qué orden (paso 6). |
| `generador/` | Generador determinista (`siembra.py`), validaciones, instantáneas del esquema y de catálogos, pruebas. |
| `libro/` | Libro sintético de personajes y narrativas (muestra; el libro definitivo sigue su forma). |
| `libro/masivo/` | Motor masivo de N2/N3 (~220 y ~560 registros, determinista) con su verificador de calidad y `COORDINACION.md` (alias y lotes reservados). |
| `muestra/` | Recorte versionado de los datos públicos reales; los completos viven fuera de git (`--datos` o `SIMUS_SIEMBRA_DATOS`). |
| `kit/` | SQL que SOLO el kit aplica (no DbUp). |

## Uso

```bash
python3 -I siembra/generador/pruebas_generador.py            # pruebas livianas, sin base
./scripts/demo/siembra-integral.sh plan                            # valida y escribe el plan SQL en siembra/plan-generado/ (sin base)
SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/siembra-integral.sh preparar   # crea dbo.DatosDeDemostracion
SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/siembra-integral.sh sembrar    # aplica los lotes (idempotente)
./scripts/demo/siembra-integral.sh estado | identificar 1
python3 siembra/generador/refrescar_instantaneas.py [--comprobar]       # tras una migración: refresca/compara esquema y catálogos
```

Siempre contra una base `SIMUS_*` y con la confirmación explícita. Para ensayar usa una pila propia (`SIMUS_LOCAL_SQL_PORT`, `SIMUS_LOCAL_SQL_CONTAINER`, `SIMUS_LOCAL_DB_NAME`); la clave del SA sale del entorno o de `.env` y nunca se imprime.

Solo las agendas de citas, sobre una demo ya sembrada: `SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/sembrar-agenda-de-citas.sh --si` (idempotente; `mapa` imprime las rutas).

## Decisiones de modelo

- **Idempotencia por alias**: cada fila lleva un alias (`festival.<clave>`, `org.<clave>`…) guardado en `DatosDeDemostracion`; reaplicar no duplica. Las referencias entre filas se resuelven por alias en el momento de insertar, no por identificadores.
- **Determinismo**: semilla fija (`--semilla`), fecha de referencia fija (`--hoy`) y `random.Random("<semilla>:<alias>")` por fila: el mismo plan sale byte a byte.
- **Lo público y lo inventado**: los festivales y mercados reales entran como **históricos publicados, administrados por la entidad institucional** (nadie los reclama ni se atribuye su gestión a organizaciones reales o ficticias). Las organizaciones, personas, ediciones de festivales ficticios, programación, noticias y participaciones son sintéticas y no imitan nombres reales. Las reclamaciones (organización sintética sobre un histórico real) son escenarios de plataforma.
- **Sin etiquetas visibles**: ninguna ficha dice «ficticio»; la marca es la fila de `DatosDeDemostracion`. Correos `.test`, documentos `DEMO-…`, teléfonos de rango de prueba.
- **Validaciones previas** (error = no se escribe nada): alias único y referencias resueltas en el orden de los lotes, columnas y obligatorias del esquema real, longitudes, CHECK (enumeraciones y expresiones simples), únicos naturales, territorio DIVIPOLA, fechas coherentes con el estado, historiales que terminan en el estado actual, textos no repetidos, correos `.test`, administradora por organización activa, una reclamación/propuesta viva por registro.

## Cuentas de validación (nivel 0)

Seis cuentas con clave «admin» (solo demo local; no se exponen en una demo pública), definidas en `generador/cuentas_validacion.py`: `camila.restrepo@simus.test` (externa «Camila Restrepo», perfil personal muy cargado; administra una organización grande con los 5 tipos de proceso en los 6 estados, una mediana, una nueva sin confirmar y una vacía; es editor de otra), `webmaster@simus.test` y `gestor@simus.test` (gestión; firman los historiales), `editor@simus.test`, `reclamante@simus.test` (reclamaciones en 6 estados, incluido «ya reclamado») y `nuevo@simus.test` (sin datos). Los registros llevan claves estables `n0.…` en `DatosDeDemostracion`. Para mostrarlas en el acceso rápido temporal: `SIMUS_DEMO_CUENTAS_ACCESO_RAPIDO=scripts/demo/acceso-rapido-demo-cuentas-validacion.tsv ./scripts/demo/acceso-rapido-demo.sh escribir`. El hash de contraseña es de ASP.NET Identity V3, con la sal derivada del correo (reproducible) y comprobado contra el verificador real de .NET.

Primer ingreso: con `SIMUS_SIEMBRA_EXIGIR_CAMBIO_DE_CLAVE=1` (por omisión `0`) las dos cuentas administrativas (`webmaster@simus.test`, `gestor@simus.test`) se siembran con `DebeCambiarContrasena=1` y deben cambiar la clave «admin» al entrar; las cuentas externas no se marcan. Aplica al generar (`plan`, `sembrar`, `completa`) en una base nueva; no modifica cuentas ya sembradas.

## Instantánea y restauración

`./scripts/demo/demo-instantanea.sh crear|restaurar|listar|borrar <nombre>` respalda y restaura la base de la demo con `BACKUP`/`RESTORE DATABASE` dentro del contenedor SQL (sin copiar archivos al anfitrión): en la base de prueba, crear tarda 1 s y restaurar 1 s (1,7 MB comprimida con el esquema completo y la muestra). Solo opera sobre bases `SIMUS_*`; restaurar exige `--si` (sin él solo explica). Antes de restaurar la demo, detén la API y la web. Flujo de tomas: `sembrar` → `crear sembrada` → grabar → `restaurar sembrada --si`. Guardas probadas sin base: `bash scripts/validacion/tests/test_siembra_guardas.sh`.

## Limpieza controlada y recorrido de aceptación

- `SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/siembra-integral.sh limpiar [--si]`: respaldo previo, una sola transacción, orden por FK reales, verificación posterior (ver `docs/limpieza-controlada.md`). Sin `--si` solo muestra el plan.
- `SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/sembrar-celebra-ediciones.sh --si`: añade SOLO las ediciones 2025 y 2026 de Celebra la música (libro `celebra`, lote `n1-celebra`) a una demo ya sembrada, sin borrar nada; idempotente. Sin `--si` solo explica.
- `simus-web/e2e/siembra-recorrido.spec.ts`: recorrido de aceptación etiquetado (`@siembra-publico`, `@siembra-externo`, `@siembra-gestion`, `@siembra-reclamacion`); solo corre con `SIMUS_E2E_SIEMBRA=1`. Es un esqueleto: los pasos de API están completos y los de interfaz esperan los selectores definitivos (`test.fixme`).

## Siembra integrada (todos los temas) y orden de armado

El libro completo es la suma de cinco temas (`siembra/libro/festivales`, `personas`, `contenido`, `masivo` y el sistema de `siembra/multimedia`) sobre la muestra y las cuentas de validación. `generador/reconciliar_libros.py` casa los alias de personas y festivales (organizadoras y aliadas reales, por `EntidadId`), `generador/multimedia_integral.py` enlaza los `img.*` de todos los libros con el manifiesto y `contenido/__init__.py` fija las fechas de las ediciones que las noticias dan por ciertas. Detalle y decisiones en `siembra/docs/integracion.md`.

**Orden correcto de armado de la base real de la demo** (cualquier otro orden rompe algo):

1. Migraciones: `./scripts/local/schema-local.sh migrar`.
2. Seeds de referencia: `./scripts/local/seed-local-db.sh` (DIVIPOLA, catálogos, roles, acervo).
3. Usuario del sistema (`sistema@pnmc.local`): la API lo crea al arrancar una vez en local (`scripts/local/api-local.sh`, luego se detiene).
4. Siembra: `SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/siembra-integral.sh completa --si [--datos DIR]`.

**NUNCA** correr `seed-local-db.sh` después de sembrar cuentas: vuelve a escribir tablas de referencia y rompe la limpieza por `FK_ProcedenciasDeRegistro_Usuario`. Para rehacer la demo se reconstruye desde cero (pasos 1–4) o se restaura una instantánea; no se siembra encima.

`completa` hace: comprobación del orden → respaldo (instantánea) → limpieza controlada → pool de imágenes si falta → siembra de N0 (cuentas), N1, N2/N3 y multimedia → verificación (verificador del motor masivo, verificador de multimedia, `DBCC CHECKCONSTRAINTS`, conteos por lote del plan frente a la base) y escribe `tmp/siembra/informe-de-carga.md` (`SIMUS_SIEMBRA_INFORME` lo cambia). Sin `--si` solo explica. Con una API levantada sobre la misma base, `./scripts/demo/siembra-integral.sh verificar-api [URL]` comprueba fichas y archivos públicos (200 con ETag; 404 para lo no publicado) y el ingreso de las seis cuentas.
