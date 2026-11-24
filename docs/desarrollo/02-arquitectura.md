# 2. Arquitectura

De qué está hecho el sistema, qué hace cada pieza y dónde están las fronteras que no se cruzan.

Las cifras de este documento se obtienen del repositorio —el contrato publicado, los guiones de
`simus-database/schema/` y el código de las dos suites de pruebas— y pueden recomprobarse. **Corte: 20 de
noviembre de 2026, `main` en `e13002c4`.** Para recontarlas: `python3 scripts/documentos/contar-contrato.py` (operaciones y
caminos), `ls simus-database/schema | wc -l` (migraciones) y el recuento de tablas de [`05`](05-base-de-datos.md).

---

## 2.1 Las tres piezas

| Pieza | Tecnología | Qué es |
|---|---|---|
| `simus-web/` | Angular 21 con señales, componentes autónomos y Tailwind 4 | El portal público, el espacio de la organización y la consola de gestión administrativa |
| `simus-api/` | .NET 10, Minimal APIs, EF Core | La única puerta a los datos: **527 operaciones** en 448 caminos |
| `simus-database/` | SQL Server, migraciones con DbUp | **161 tablas** (esquema `dbo`), **171 migraciones** de esquema y 41 guiones de semilla |

Alrededor: `scripts/` levanta y comprueba el entorno local, `infra/` guarda lo de despliegue y
`docs/` es lo que está leyendo.

## 2.2 Las fronteras que no se cruzan

**El frontend no habla con la base de datos.** Ni con un ORM, ni con una cadena de conexión, ni con
un servicio intermedio: todo pasa por el API.

**El API no crea estructura al arrancar.** Las tablas las crea DbUp aplicando los guiones de
`simus-database/schema/` en orden; una semilla nunca sustituye a una migración.

**Hay dos sesiones y no se mezclan.** La externa —la persona u organización que registra sus procesos— y la
institucional —el equipo del PNMC—. Son dos cookies distintas (`simus.external` y `simus.admin`) y cada ruta declara cuál exige;
las únicas excepciones son las rutas anónimas y las tres de notificaciones, que aceptan cualquiera de las dos. Un
endpoint que aceptara cualquiera de las dos borraría la frontera entre los dos espacios.

**Los tres orígenes de un registro se guardan por separado**: qué entidad lo incorporó
(procedencia), qué cuenta ejecutó la acción, y qué organización responde por él. Que el PNMC haya
incorporado un Festival no lo convierte en su organización responsable.

## 2.3 Los tres espacios de la aplicación

| Espacio | Ruta | Quién entra |
|---|---|---|
| Portal público | `/` y sus secciones | cualquiera |
| Espacio de la organización | `/gestion` | una organización con correo confirmado |
| Consola de gestión administrativa | `/administracion` | el equipo del PNMC, por rol |

Comparten componentes —la ficha del Festival es literalmente la misma en los tres, con distinto
envoltorio— pero no comparten sesión ni permisos.

## 2.4 Cómo se sostiene

- **Pruebas** (recuento por texto del código; el total que reporta cada ejecutor se confirma corriendo): **1 617**
  métodos de prueba en el API —1 349 `[Fact]`, 114 `[Theory]` con 456 filas y 154 con SQL Server real, que se omiten
  sin `SIMUS_PRUEBAS_SQLSERVER=1`— y **2 552** casos `it(` del frontend en 283 archivos; además, 56
  especificaciones de navegador (Playwright).
- **Contrato**: `simus-api/openapi.yaml` se versiona y una prueba comprueba que corresponde al
  código. Se regenera con `ACTUALIZAR_OPENAPI=1 dotnet test --filter ContratoOpenApi`.
- **Trinquetes**: **diecinueve** métricas de interfaz y una de tipado, con techo sellado, y pruebas
  propias que fijan qué cuenta cada métrica y qué no. No dejan que la deuda suba sin que alguien lo
  decida. Viven en `simus-web/trinquete/`.
- **Puertas**: ver [`10-pruebas.md`](10-pruebas.md).

## 2.5 Lo que este documento no cubre

El detalle de cada módulo está en [`06`](../usuario/06-modulos-y-funcionalidades.md); el del API en [`08`](08-api-e-integraciones.md); el
de la base en [`05`](05-base-de-datos.md); el árbol de carpetas en
[`03`](03-estructura-del-proyecto.md); los roles y las guardas en [`07`](../usuario/07-roles-y-permisos.md) y
[`12`](12-acceso-por-superficie.md).

---

