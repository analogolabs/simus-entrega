# Documentación de SIMUS

> **Autor y desarrollo:** Edder Jiménez · **Entregado a través de la Fundación El Poliedro** ·
> Plan Nacional de Música para la Convivencia (Ministerio de las Culturas, las Artes y los Saberes) ·
> Contacto: [edderjimenezg@gmail.com](mailto:edderjimenezg@gmail.com)

La documentación está ordenada por público. El número que lleva cada documento es su identificador estable:
las secciones se citan como `§N.M` (por ejemplo, `§20.4` es la sección 4 del documento 20) desde otros documentos,
el código y las pruebas.

## Para quien usa el sistema

| Doc. | Documento | Contenido |
|---|---|---|
| 1 | [Descripción general](usuario/01-descripcion-general.md) | Qué es SIMUS, para quién y qué significa cada registro |
| 6 | [Módulos y funcionalidades](usuario/06-modulos-y-funcionalidades.md) | Qué hay en cada espacio |
| 7 | [Roles y permisos](usuario/07-roles-y-permisos.md) | Quién puede hacer qué |
| 23 | [Guía de estilo de textos](usuario/23-guia-de-estilo-de-textos.md) | Cómo se escriben los textos de la web |

## Para quien instala, despliega y mantiene

| Doc. | Documento | Contenido |
|---|---|---|
| 4 | [Instalación y configuración](operacion/04-instalacion-y-configuracion.md) | Montar el entorno local |
| 9 | [Despliegue](operacion/09-despliegue.md) | Requisitos y pasos de despliegue |
| 11 | [Operación y mantenimiento](operacion/11-operacion-y-mantenimiento.md) | Operación corriente y reinicio de la demostración |
| — | [Accesos iniciales](accesos-iniciales.md) | Cuentas con las que arranca el sistema y cómo asegurarlas |
| 15 | [Modos de ejecución y paso a producción](operacion/15-modos-de-ejecucion-y-paso-a-produccion.md) | Local, Demo y Producción |
| 28 | [Tabla de retención documental](operacion/28-tabla-de-retencion-documental.md) | Series, plazos y gestión del almacenamiento |
| 29 | [Gestión de archivos](operacion/29-gestion-de-archivos.md) | Quién sube qué, cuotas, deduplicación, retiro y copias |

## Para quien modifica el sistema

| Doc. | Documento | Contenido |
|---|---|---|
| 2 | [Arquitectura](desarrollo/02-arquitectura.md) | Piezas, fronteras y reglas que no se cruzan |
| 3 | [Estructura del proyecto](desarrollo/03-estructura-del-proyecto.md) | Carpetas y su responsabilidad |
| 5 | [Base de datos](desarrollo/05-base-de-datos.md) | Modelo, migraciones y siembras |
| 8 | [API e integraciones](desarrollo/08-api-e-integraciones.md) | Superficie de la API |
| 10 | [Pruebas](desarrollo/10-pruebas.md) | Qué se comprueba y cómo se corre |
| 12 | [Acceso por superficie](desarrollo/12-acceso-por-superficie.md) | Línea base de exposición de la API |
| 13 | [Núcleo de procesos](desarrollo/13-nucleo-de-procesos.md) | Cómo se construye un proceso nuevo |
| 14 | [Sistema de diseño](desarrollo/14-sistema-de-diseno.md) | Criterios de diseño reutilizables de la interfaz |
| 19 | [Cuentas y organizaciones](desarrollo/19-cuentas-y-organizaciones.md) | Persona, cuenta, organización, membresía y roles |
| 24 | [Versionamiento y gobierno del dato](desarrollo/24-versionamiento-y-gobierno-del-dato.md) | Historial por campo y clases de dato |
| 30 | [Consola y acceso](desarrollo/30-consola-y-acceso.md) | Estructura, piezas comunes y modelo de los procesos |
| 33 | [Galería y archivos multimedia](desarrollo/33-galeria-y-archivos-multimedia.md) | Dónde vive cada cosa, cómo funciona la Galería y cómo se generan las imágenes de la demostración |

## Referencia: el porqué y las especificaciones de módulos

| Doc. | Documento | Contenido |
|---|---|---|
| 20 | [Decisiones y flujos por módulo](referencia/20-decisiones-y-flujos-por-modulo.md) | Decisiones numeradas, quién crea, revisa y publica, estados e historial |
| 25 | [Módulos restantes](referencia/25-modulos-restantes.md) | Talleres, espacios y redes |
| 26 | [Agenda de citas y mercados](referencia/26-agenda-de-citas-y-mercados.md) | Agenda de citas entre artistas y compradores |
| 27 | [Fuentes de la lutería](referencia/27-fuentes-de-luteria.md) | Fuentes colombianas para los vocabularios de Lutería |
| 31 | [Catálogos: decisiones y fuentes](referencia/31-catalogos-decisiones-y-fuentes.md) | Por qué los catálogos están como están |
| 32 | [Directorio de actores](referencia/32-directorio-de-actores.md) | Estado y brechas del directorio de personas y organizaciones |

## Convenciones

- Todo en español, de tú, con las siglas **SIMUS** (el sistema) y **PNMC** (el Plan Nacional de Música para la Convivencia).
- Los enlaces entre documentos son relativos; los revisa `scripts/documentos/comprobar-enlaces-docs.py`
  (también dentro de `scripts/validacion/validar-local.sh`).
- Créditos y condiciones de uso: [CREDITOS.md](../CREDITOS.md) y [LICENSE](../LICENSE).
