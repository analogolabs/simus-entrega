# Registro de cambios

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[semántico](https://semver.org/lang/es/).

## [1.0.0] — Entrega inicial (2026)

Primera entrega de SIMUS, Sistema de Información de la Música, para el Plan Nacional de Música para la
Convivencia. Autor y desarrollo: Edder Jiménez, entregado a través de la Fundación El Poliedro.

### Portal público
- Inicio, El Plan (PNMC: presentación, ejes, estrategias, actores, hitos, marco normativo y equipo), Catálogo Editorial,
  Galería de álbumes, fotos y videos, Noticias, Agenda y mapa ecosistémico con territorios (DIVIPOLA/MGN 2025).
- Directorios con ficha, filtros y recuento para Festivales, Mercados musicales, Lutería, Espacios para música en vivo,
  Redes y documentación, Territorios sonoros y Prácticas musicales.
- Consulta guiada pública con preguntas verificadas y parámetros tipados (sin modelo generativo).
- Boletín informativo con doble confirmación y baja pública.

### Espacio de las organizaciones y de las personas
- Registro, ingreso, recuperación de contraseña y organización activa en la dirección.
- Panel de la organización: Festivales y ediciones, Mercados, talleres de lutería, espacios y redes, con asistente de alta,
  borradores con autoguardado, revisión y publicación.
- Herramientas: agenda de citas entre artistas y compradores de un Mercado.
- Mi espacio: perfil enriquecido, directorio de personas y roles jerárquicos de los perfiles.

### Consola de gestión administrativa
- Bandeja de trabajo con solicitudes y revisiones, circuito de revisión y publicación con acciones por estado.
- Gestión del ecosistema (Festivales, Mercados, organizaciones y responsables), publicaciones y mediateca (Catálogo Editorial,
  Agenda, Noticias, Banco de archivos, Galería), CMS del sitio y boletín.
- Gobierno y control: análisis y consultas (incluye un Asistente con modelo local de lenguaje, Ollama/qwen, que corre en la
  propia máquina y no envía datos fuera), auditoría y trazabilidad, usuarios y roles, salud del sistema.
- Historial por campo, gobierno del dato, retención documental y gestión de archivos del producto.

### Plataforma
- API en .NET 10 con contrato OpenAPI, seguridad por superficie, CSRF, límites de uso y observabilidad.
- Base de datos SQL Server con migraciones DbUp (`simus-database/schema`, `seed`) y migrador.
- Aplicación Angular 21 con sistema de diseño, accesibilidad verificada y trinquetes de calidad.
- Entorno local reproducible, modos Local, Demo y Producción, siembra de datos sintéticos de demostración,
  infraestructura como código (Bicep) y flujos de despliegue.
- Pruebas: unitarias y de integración de la API (SQLite y SQL Server), pruebas de la web (Karma) y recorridos de navegador (Playwright).
