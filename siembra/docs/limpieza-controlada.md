# SIMUS — plan de limpieza controlada de la demo

. Prepara la base de la demo para la siembra integral: vacía lo operativo de prueba, conserva lo estructural y verifica. **Solo en el entorno de demostración local autorizado**; nunca producción ni Azure. Se ejecuta únicamente con `SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/siembra-integral.sh limpiar --si` (sin `--si` solo muestra el plan). Lo genera `siembra/generador/plan_de_limpieza.py` leyendo las FK reales de la base, de modo que no se desactualiza con las migraciones.

## Pasos

1. **Respaldo previo**: `scripts/demo/demo-instantanea.sh crear antes-de-limpiar-<fecha>` (segundos). Sin respaldo no se limpia. Deshacer: `restaurar … --si`.
2. **Una sola transacción** (`XACT_ABORT`): cualquier fallo revierte todo.
3. **Orden**: de hijos a padres según las FK reales; la FK a sí misma (`Festivales.FusionadoEnId`, `Categorias`) se resuelve en una sola sentencia; el ciclo `Archivos.OrganizacionId` ↔ `Entidades.ArchivoFotoId` se rompe poniendo en NULL la columna de los archivos de entidades que se van.
4. **Conservar lo que una tabla conservada referencia** (p. ej. los archivos del acervo editorial).
5. **Verificación posterior, dentro de la transacción** (si falla, se revierte): los conteos de todas las tablas conservadas son idénticos a los de antes; `DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS` no encuentra ninguna restricción rota; `dbo.DatosDeDemostracion` queda vacía.
6. Después: `./scripts/demo/siembra-integral.sh sembrar` (idempotente) y, si todo está bien, `demo-instantanea.sh crear sembrada` como punto de restauración de las tomas.

## Qué se conserva

- **Catálogos y referencias**: divisiones territoriales (DIVIPOLA, regiones OCAD), roles, permisos y su relación, estados de contenido, prácticas y territorios sonoros con sus fichas, expresiones artísticas, modalidades, tipos de ingreso y de organizador, periodicidades, tipologías, fuentes de financiación, políticas de datos, tipos de documento, géneros, orientaciones, pertenencias étnicas, enfoques, discapacidad, zonas, idiomas, taxonomía de perfiles, familias de instrumentos, servicios, tipos y equipamiento de espacios, formas de acceso y formatos de documentación de redes, categorías (y etiquetas de partida), menú y diario de migraciones.
- **Configuración y contenido institucional**: textos del sitio y su historial, contenido web, equipo web, medios web (logotipo y fondo). El micrositio Celebra la música NO se conserva: sus ediciones, categorías, recursos, preguntas y galería las siembra la siembra integral (libro `celebra`, lote `n1-celebra`) y la limpieza las retira con ella; los proyectos transversales de cada edición sí se conservan.
- **Acervo editorial** completo (publicaciones, agentes, créditos, identificadores, accesos, fuentes, programas, tipologías) y su procedencia (`ProcedenciasDeRegistro` del módulo `catalogo-editorial`), más las titulaciones colectivas y los proyectos transversales de partida (Celebra la música y sus dos ediciones; las campañas que añade la siembra se retiran con ella).
- **Cuentas administrativas necesarias**: las de arranque (webmaster, gestor, externo de prueba y participantes, más el usuario del sistema `@pnmc.local`), con sus roles y módulos por cuenta, y la **entidad institucional** del PNMC.

## Qué se vacía

Todo lo operativo: usuarios y organizaciones que no son de arranque (incluidas las cuentas `@simus.test`), perfiles públicos y sus enlaces/clasificaciones, equipos e invitaciones, festivales, mercados, talleres, espacios y redes con sus ediciones y pivotes, agendas y citas, eventos, noticias, etiquetas de contenido, notificaciones, borradores, revisiones, envíos, propuestas, historiales, cambios de registro, bitácora de auditoría, duplicados y calidad, solicitudes de vinculación, reclamaciones, aclaraciones, conciliaciones, transferencias, archivos de registro, autorizaciones, suscripciones al boletín, importaciones y sesiones efímeras.

## Orden y alcance generados de la base de prueba

```text
Tablas en la base: 160
Se CONSERVAN (66): AccesosEditoriales, AgentesEditoriales, AlcancesMercado, CatalogosReferenciaFuente, Categorias, ContenidoWeb, ContenidoWebHistorial, CreditosEditoriales, DepartamentosRegionOcad, Divipola, EnfoquesDiferenciales, EquipamientoDeEspacio, EquipoWeb, EstadosContenido, Etiquetas, ExpresionesArtisticas, FamiliasDeInstrumentos, FichasConceptualesPracticasMusicales, FichasConceptualesTerritoriosSonoros, FormasDeAccesoDeRed, FormatosDeDocumentacion, FuentesEditoriales, FuentesFinanciacion, IdentidadesGenero, IdentificadoresEditoriales, Idiomas, MediosWeb, MediosWebHistorial, MenuElementos, ModalidadesMercado, ModalidadesParticipacion, NaturalezasEntidad, OrientacionesSexuales, PalabrasClaveEditoriales, Periodicidades, Permisos, PertenenciasEtnicas, PoliticasDatos, PracticasMusicales, ProgramasEditoriales, PublicacionesEditoriales, PublicacionesEditorialesFuentes, PublicacionesEditorialesIdiomas, PublicacionesEditorialesPracticasMusicales, PublicacionesEditorialesProgramas, PublicacionesEditorialesTerritoriosSonoros, PublicacionesEditorialesTipologias, RegionesOcad, Roles, RolesPermisos, SchemaVersions, ServiciosDeTaller, Sexos, TerritoriosSonoros, TextosSitio, TextosSitioHistorial, TipologiasEditoriales, TipologiasFestival, TiposDeEspacio, TiposDiscapacidad, TiposDocumento, TiposIngreso, TiposOrganizador, TitulacionesColectivas, ValoresDeTaxonomiaDePerfiles, ZonasUrbanoRural
Se VACÍAN (94), en este orden (hijos primero):
    1. ArchivosDeRegistro
    2. AutorizacionesDatos
    3. BitacoraAuditoria
    4. BoletinSuscripciones
    5. CambiosDeRegistro
    6. CambiosDeRegistro_RespaldoClase_20261119
    7. CelebraCategorias
    8. CelebraGaleria
    9. CelebraPreguntas
   10. CelebraRecursos
   11. CitasDeAgenda
   12. ConfirmacionesDeCorreo
   13. DatosDeDemostracion
   14. DecisionesImportacion
   15. EdicionesFestival
   16. EntidadesAliadasDeRegistro
   17. EntidadesResponsable   [solo donde IdEntidad IN (SELECT IdEntidad FROM dbo.Entidades WHERE NOT (EsInstitucional = 1))]
   18. EnviosDeRevision
   19. EspaciosEquipamiento
   20. EspaciosPracticasMusicales
   21. EspaciosTipos
   22. EtiquetasEventoAgenda
   23. EtiquetasNoticia
   24. EventosAgendaArchivos
   25. EventosAgendaPracticasMusicales
   26. EventosAgendaProyectosTransversales
   27. EventosAgendaTerritoriosSonoros
   28. ExpresionesArtisticasDeRegistro
   29. ExtraccionesAsistidas
   30. FestivalesReferenciasHistoricas
   31. HallazgosImportacion
   32. IntentosDeIngresoFallidos
   33. InvitacionesDeAgenda
   34. InvitacionesDeOrganizacion
   35. LocalizacionesDeRegistro
   36. MercadosPracticasMusicales
   37. MercadosTerritoriosSonoros
   38. ModalidadesParticipacionDeRegistro
   39. ModulosPorCuenta   [solo donde IdUsuarioQueOtorgo IN (SELECT IdUsuario FROM dbo.Usuarios WHERE NOT (CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test'))) AND IdUsuario IN (SELECT IdUsuario FROM dbo.Usuarios WHERE NOT (CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test')))]
   40. NoticiasArchivos
   41. NoticiasPracticasMusicales
   42. NoticiasProyectosTransversales
   43. NoticiasTerritoriosSonoros
   44. Notificaciones
   45. Participaciones
   46. PerfilesPublicosClasificaciones
   47. PerfilesPublicosEnlaces
   48. PerfilesPublicosPracticas
   49. PracticasMusicalesDeRegistro
   50. ProcedenciasDeRegistro   [solo donde NOT (ModuloId = N'catalogo-editorial')]
   51. PropuestasDeCambioCampos
   52. ReclamacionesAclaraciones
   53. ReclamacionesConciliaciones
   54. RedesFormasDeAcceso
   55. RedesFormatos
   56. RedesPracticasMusicales
   57. RegistrosCalidadDatos
   58. RegistrosDuplicadosCandidatos
   59. RegistrosRevisionHistorial
   60. RestablecimientosDeContrasena
   61. RevisionesDeRegistroObservaciones
   62. SolicitudesVinculacionRegistros
   63. TalleresFamiliasDeInstrumentos
   64. TalleresPracticasMusicales
   65. TalleresServicios
   66. TerritoriosSonorosDeRegistro
   67. TiposIngresoDeRegistro
   68. TransferenciasAdministracion
   69. UsuariosCodigosVerificacion
   70. UsuariosEntidades
   71. UsuariosRoles   [solo donde IdUsuario IN (SELECT IdUsuario FROM dbo.Usuarios WHERE NOT (CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test')))]
   72. CelebraEdiciones
   73. EventosAgenda
   74. FilasImportacion
   75. FranjasDeCitas
   76. Noticias
   77. ParticipantesDeCitas
   78. PerfilesPublicos
   79. PropuestasDeCambio
   80. ReclamacionesAdministracion
   81. RevisionesDeRegistro
   82. AgendasDeCitas
   83. BorradoresProceso
   84. Espacios
   85. LotesImportacion
   86. ProyectosTransversales   [solo donde NOT (Codigo IN (N'celebra-la-musica', N'celebra-la-musica-2025', N'celebra-la-musica-2026'))]
   87. Redes
   88. Talleres
   89. EdicionesMercado
   90. Mercados
   91. Festivales
   92. Entidades   [solo donde NOT (EsInstitucional = 1)]
   93. Archivos   [solo donde IdArchivo NOT IN (SELECT ArchivoId FROM dbo.AccesosEditoriales WHERE ArchivoId IS NOT NULL)]
   94. Usuarios   [solo donde NOT (CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test'))]
```

## Lo probado (base de prueba aislada)

Sembrada la muestra y las cuentas, `limpiar --si` en ~8 s (incluye el respaldo): 42 tablas cambiaron, **ninguna conservada** cambió, quedaron 6 cuentas `@pnmc.local`, la entidad institucional y los módulos por cuenta; luego `sembrar` reconstruyó todo (idempotente) y `restaurar` devolvió el estado anterior en ~1 s.
