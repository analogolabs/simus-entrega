# 8. API e integraciones

Qué expone `simus-api` y cómo está organizado.

La referencia es `simus-api/openapi.yaml`, el contrato que una prueba mantiene igual al código.
Declara **527 operaciones en 448 caminos** (corte del 23 de noviembre de 2026, `main` en `48f36810`), repartidas en once
prefijos, de los que **cuatro concentran 513**. Para recontarlas sobre el contrato vigente:
`python3 scripts/documentos/contar-contrato.py`.

---

## 8.1 Los ámbitos, y qué sesión exige cada uno

La convención del proyecto es `/api/v1/{ámbito}/{recurso}`, con cuatro ámbitos:

| Ámbito | Quién entra | Operaciones |
|---|---|---|
| `/api/v1/publico/` | cualquiera, sin sesión | 54 |
| `/api/v1/externo/` | una persona u organización, con su cookie externa (salvo el registro, el ingreso y la recuperación de clave, que son anónimos) | 218 |
| `/api/v1/institucional/` | el equipo del PNMC, con su cookie institucional y el módulo concedido | 144 |
| `/api/v1/admin/` | operación y gobierno de la consola | 97 |

Suman **513 de las 527**. En el corte del 20 de noviembre (505 operaciones) había 65 operaciones anónimas, más cuatro rutas de infraestructura declaradas en
`Program.cs` (la prueba `AutorizacionPorDefectoTests` cuenta 69). Qué política exige cada ruta, y qué módulo, está en
[`07`](../usuario/07-roles-y-permisos.md) y [`12`](12-acceso-por-superficie.md).

**Lo que creció fue el circuito de un proceso, no la superficie pública.** Desde la medición de septiembre (310
operaciones) el API sumó casi 200, y están sobre todo en `/externo` y en `/institucional`: los cinco procesos del
ecosistema —Festivales, Mercados, Talleres, Espacios y Redes— recorren el mismo circuito (registro, envío, revisión,
publicación, propuesta de cambio sobre lo publicado, retiro), más organizaciones, cuentas y perfiles, agenda de citas,
procesos históricos reclamables, importación asistida y consulta guiada.

## 8.2 Lo que no encaja en esos cuatro

Las 14 restantes viven en siete prefijos más. Están medidas, no supuestas:

| Prefijo | Operaciones | Qué es |
|---|---|---|
| `/api/v1/mapa/` | 5 | Cartografía y capas del mapa ecosistémico. Ámbito propio legítimo. |
| `/api/v1/notificaciones/` | 3 | Lectura de avisos. Sirve a los dos espacios, por eso no cuelga de ninguno. |
| `/api/v1/participaciones/` | 0 | **Retirado el 20 nov 2026** (S-09, decisión 164): no tenía consumidor y guardaba datos personales sin sesión. Ver §8.5. |
| `/api/v1/imagenes-web/`, `/contenido-web/`, `/equipo-web/` | 4 | El CMS: imágenes, contenido y equipo del sitio. |
| `/api/v1/csrf` | 1 | Entrega el testigo antiforgery de la consola. |
| `/api/v1/solicitudes-de-vinculacion` | 1 | Pedir vincularse a un registro del ecosistema. |

**No queda ninguna ruta en inglés**, salvo los tres prefijos del CMS que se explican abajo.

`auth` se conserva en los dos lados —`/admin/auth/` y `/externo/auth/`— a propósito: renombrar uno
y no el otro habría cambiado una incoherencia por otra.

Los tres prefijos del CMS siguen en inglés y **no se tocaron**: `web-content` no es solo una ruta,
es el nombre del concepto en las tablas, en el catálogo versionado y en el frontend. Renombrar la
ruta sin renombrar el concepto crea una incoherencia nueva; es una decisión aparte.

## 8.3 El contrato

`simus-api/openapi.yaml` se versiona y **una prueba comprueba que corresponde al código**. Si un
cambio añade o cambia un endpoint, la prueba falla hasta regenerarlo:

```bash
cd simus-api && ACTUALIZAR_OPENAPI=1 dotnet test --filter ContratoOpenApi
```

Hay endpoints cuyos esquemas de respuesta no quedan expandidos en el contrato —los de importación,
comprobado—. Es una limitación conocida del generador, no una ruta sin documentar.

**Fechas.** Un instante (creado, enviado, decidido) viaja **siempre en UTC con «Z»**:
`"2026-11-05T23:23:00Z"`. Una fecha de calendario (`DateOnly`: fecha de una edición, de un evento,
de publicación de una noticia) viaja **sin hora ni zona**: `"2026-11-05"`. La base guarda los
instantes en `datetime2` como UTC; `InstanteUtcConverter` (convención de `SimusDbContext`) los marca
como UTC al leerlos, también en las proyecciones, y por eso el serializador escribe la «Z» sin
tocar ningún contrato. La web los pinta en hora de Bogotá y en es-CO con un solo formateador
(`simus-web/src/app/shared/utils/formatos-de-fecha.ts`, pipe `fecha`); las fechas de calendario no
se desplazan. Lo prueba `InstantesEnUtcTests`.

## 8.4 Comprobar qué hay registrado, sin leer código

Con el API en marcha:

```bash
curl -s http://127.0.0.1:8180/swagger/v1/swagger.json | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(len(d['paths']),'caminos')"
```

Una ruta escrita y no registrada no aparece ahí, que es justo lo que interesa: para quien la llama,
no existe.

## 8.5 Participaciones (retirado)

`/api/v1/participaciones` recogía un formulario de «quiero participar en el ecosistema»: tipo de actor, nombre, correo, departamento,
municipio y el resto del formulario en JSON. **Se retiró el 20 de noviembre de 2026** (auditoría de seguridad S-09, decisión 164):
el POST era anónimo, guardaba datos personales sin base de tratamiento y su cupo era una sola ventana global; el listado cargaba todas
las filas en memoria; y ninguna pantalla lo llamaba. Se quitaron las tres operaciones, el limitador `participation-submit`, el almacén,
los contratos (`ParticipationSubmission*`) y sus pruebas.

**La tabla `dbo.Participaciones` se conserva**, con sus filas si las hay, y la consola de datos (`/admin/data`) sigue contándola: no se
borran datos sin una decisión del responsable del tratamiento. Si el producto decide abrir un formulario de participación, se hace nuevo,
con el modelo de cuentas y organizaciones, módulo de consola, paginación en la base y límite por origen.

## 8.6 Por módulo

- **Festivales y Ediciones**: 92 operaciones —42 en `/externo`, 35 en `/institucional`, 9 en `/admin` y 6 en
  `/publico`—. El recorrido completo está en el mapa de rutas del módulo.
- **Mercados Musicales**: 59 operaciones —28 en `/externo`, 23 en `/institucional`, 4 en `/admin` y 4 en
  `/publico`—, el mismo circuito que Festivales.
- **Mantenimiento**: las rutas de normalización y diagnóstico de los perfiles públicos de Festival
  (`normalizar-versiones-historicas` y su `diagnostico-…`) **se retiraron** con la tabla `PerfilesPublicosFestival`
  (decisiones 145 y 152 de [`20`](../referencia/20-decisiones-y-flujos-por-modulo.md)); ya no hay operaciones de mantenimiento de
  Festivales que se invoquen a mano.
- **Cómo se sabe qué llama una pantalla, y cómo no.** Un contraste estático entre los caminos del
  contrato y los literales del frontend **no sirve**: media docena de servicios componen la
  dirección —`` `${base}/consultar` ``, `` `.../${id}/baja` ``—, así que un buscador de textos da
  decenas de falsos huérfanos. El 17 de septiembre de 2026 dio 74, y el primero de la lista era la
  Consulta Guiada, que funciona. Para saberlo de verdad hay que **mirar el tráfico** con la
  aplicación en marcha, o instrumentar el cliente.

- **`/participaciones`**: retirado (ver §8.5). Era la única capacidad completa sin pantalla que guardaba datos personales de forma anónima.

---

