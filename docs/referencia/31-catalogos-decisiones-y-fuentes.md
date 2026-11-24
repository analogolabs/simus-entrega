# Catálogos: decisiones y fuentes

Traza de **por qué** los catálogos de SIMUS están como están. Se actualiza con cada cambio de un catálogo. Complementa las cabeceras de las migraciones de `simus-database/schema/` (que explican el cómo) y `docs/desarrollo/05-base-de-datos.md` (que describe el modelo).

Estado documental actualizado al 9 de octubre de 2026. El detalle visual (antes y después de cada catálogo, fuentes, pendientes) está en el informe consolidado de la carpeta de documentación (`02_Documentacion/13_Catalogos_maestros/DER_Catalogos_informe_consolidado_v04_REV_2026_10_09.html`).

## Reglas

1. **La fuente es lo que se consultó.** Un catálogo se declara con un referente externo solo si se abrió y se comprobó; si viene del SIMUS histórico o lo definió el programa, se dice «acuerdo del programa».
2. **Los códigos propios son la llave.** Las equivalencias con otro estándar (MARC, DDEX, ISO, DIAN) van como columnas solo cuando el catálogo las necesita; no se guardan códigos ajenos «por si acaso».
3. **No se inventan códigos de un estándar.** Si el estándar no tiene el valor, se usa una clave propia y se deja la equivalencia vacía.
4. **Todo cambio de datos es idempotente,** conserva los ids de las filas existentes y se ensaya antes en una **copia de la base real** (no con una transacción que se revierte).
5. **Los términos y códigos de un estándar se comprueban contra la fuente descargada,** no contra resúmenes.
6. **Un cambio de catálogo deja huella aquí:** una fila en el registro de decisiones, la fuente en la cabecera de la migración y, si cambia una lista del contrato de la API, una prueba que mantenga las dos iguales.

## Idiomas: estructura vigente del código al 9 de octubre de 2026

La simplificación aprobada conserva dos tablas: `Idiomas` y `PublicacionesEditorialesIdiomas`. El catálogo tiene seis columnas: CodigoIdioma, NombreIdioma, CodigoIso6391, Verificacion, Descripcion y Activo. Se retiran Ambito, CodigoMarc e IdiomasNombres. La migración V20261009_01 se ensayó dos veces sobre una copia de SQL Server 2022: 266 idiomas y 178 vínculos conservados. Después del ensayo se aplicó en SIMUS_LOCAL de version-2 mediante DbUp: registrada en SchemaVersions, sin pendientes. El entorno institucional no se ha modificado. Los nombres alternativos y las fuentes están en `02_Documentacion/13_Catalogos_maestros/DER_Catalogos_anexo_idiomas_v05_REV_2026_10_09.html`.

La interfaz muestra nombres en una lista con búsqueda, sin categorías ni códigos como rótulos. Los códigos se conservan como claves internas. La relación permite varios idiomas por publicación y conserva su orden. Las importaciones aceptan nombre o código conocido; los términos desconocidos bloquean la fila y permanecen en el contenido de origen para revisión.

Ya se exportaron los 256 nombres alternativos y los 266 idiomas, incluidas las equivalencias retiradas, como referencia documental. Las decisiones D-15 a D-26 describen la evolución histórica y quedan supersedidas, donde corresponda, por D-28.

## Registro de decisiones

### D-01 · Alcance

- **Decisión:** Solo siete grupos se contrastan con fuentes: regiones OCAD, Divipola, zonas urbano/rural, niveles de cobertura, tipos de documento, naturaleza de la entidad y demografía. El resto se mantiene como estaba.
- **Alternativas consideradas:** Aplicar una forma común y renombres a los 22 catálogos (plan inicial, archivado).
- **Motivo y referente:** Evitar cambios sin fuente: muchos catálogos son acuerdos del programa heredados del SIMUS histórico. La base no se había modificado.
- **Quién:** Usuario
- **Dónde quedó:** R-06 del plan maestro; sin cambios en la base

### D-02 · Qué se llama «fuente»

- **Decisión:** La columna de fuente lleva solo lo que se consultó. Los catálogos heredados del SIMUS histórico se declaran acuerdos del programa, sin referente externo.
- **Alternativas consideradas:** Mantener «DANE», «Ministerio» u otra entidad como fuente candidata.
- **Motivo y referente:** Se había anotado fuente sin consultarla (zonas, titulaciones, expresiones artísticas).
- **Quién:** Usuario señaló la confusión
- **Dónde quedó:** Informe consolidado, sección de fuentes

### D-03 · Regiones OCAD

- **Decisión:** Pasan a los nombres oficiales «Centro Sur Amazonía» y «Llanos»; los slugs se conservan.
- **Alternativas consideradas:** Mantener los nombres heredados; renombrar la tabla a «regiones del SGR».
- **Motivo y referente:** Ley 2056 de 2020, art. 45 (anexo de MinCiencias). Los slugs evitan romper datos y enlaces.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_01 · 04e5b59

### D-04 · Correspondencia departamento → región

- **Decisión:** Se documenta y se agrega la vista VistaDepartamentosPorRegionOcad. No se crea tabla de departamentos ni clave foránea.
- **Alternativas consideradas:** Tabla Departamentos con clave foránea desde la correspondencia y desde Divipola.
- **Motivo y referente:** No existe tabla de departamentos; queda como mejora opcional (P-10).
- **Quién:** Usuario
- **Dónde quedó:** V20261007_02 · 04e5b59

### D-05 · Zona urbano / rural

- **Decisión:** Pasa a las tres clases del DANE. «Urbana» → «Cabecera municipal»; «Rural» → «Rural disperso» (suposición). La regla de titulación colectiva rige para centro poblado y rural disperso.
- **Alternativas consideradas:** Dejar dos valores con equivalencia documentada (recomendación inicial).
- **Motivo y referente:** DANE, Marco Geoestadístico Nacional: clase 1 cabecera, 2 centro poblado, 3 rural disperso. Ninguna localización usaba la zona.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_01 y API · 04e5b59

### D-06 · Tipos de documento

- **Decisión:** La lista sigue la del RUT: rótulo «Registro civil»; PEP se conserva activo. No se guardan los códigos de la DIAN.
- **Alternativas consideradas:** Columna con el código DIAN; agregar NIT y certificado de la Registraduría.
- **Motivo y referente:** Lo importante es el catálogo de los referentes, no sus códigos. NUIP y carné diplomático no están en el RUT y se conservan.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_01 · 04e5b59

### D-07 · Naturaleza de la entidad

- **Decisión:** Sin cambios de valores. Se retiró el código del RUT de la descripción.
- **Alternativas consideradas:** Descripción con la casilla 62 del RUT; catálogo aparte de tipo de organización (casillas 63–69).
- **Motivo y referente:** El código no aporta a quien elige. Los tres valores coinciden con el RUT, casilla 62.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_01 y _03 · 04e5b59, fd05a5d

### D-08 · Niveles de cobertura

- **Decisión:** Sin cambios: municipal, departamental y nacional como restricción en cuatro tablas.
- **Alternativas consideradas:** Volverlo catálogo; agregar el nivel «regional».
- **Motivo y referente:** Decisión del usuario («está bien»).
- **Quién:** Usuario
- **Dónde quedó:** —

### D-09 · Titulaciones colectivas

- **Decisión:** Descripción con la norma de cada figura.
- **Alternativas consideradas:** Buscar un referente adicional; agregar otras figuras (raizales, Rrom).
- **Motivo y referente:** Ley 70 de 1993 (consejos comunitarios) y Decreto 2164 de 1995 (resguardos), vía la Agencia Nacional de Tierras. Otras figuras no se verificaron.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_04 · eb91564

### D-10 · Fuentes de financiación

- **Decisión:** Se agregan cuatro: Estampilla Procultura, contribución parafiscal de espectáculos públicos, regalías y cooperación internacional. «Otra» queda al final.
- **Alternativas consideradas:** Alinear con COFOG; agregar un «grupo» (público nacional, territorial, privado, propio).
- **Motivo y referente:** Ley 1493 de 2011 y Estampilla Procultura (consultadas). Regalías y cooperación se aprobaron sin fuente consultada.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_04 · eb91564

### D-11 · Tipologías de festival

- **Decisión:** Se retiran «Conferencia», «Mercado» y «Mercados culturales» (quedan 7).
- **Alternativas consideradas:** Unificar Mercado con Mercados culturales; dejar todas.
- **Motivo y referente:** Conferencia no es un tipo de festival y los Mercados tienen su propio módulo. La migración se niega si alguna edición las usa.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_04 · eb91564

### D-12 · Periodicidades

- **Decisión:** Tabla Periodicidades con clave foránea desde Festivales, Versiones y Mercados. Valores: los ya aceptados por la API y el formulario, más «Única vez».
- **Alternativas consideradas:** Vocabulario completo de Dublin Core (17 valores); «Cada N años».
- **Motivo y referente:** «Otra periodicidad regular» con detalle ya cubre «cada N años». Dublin Core queda como equivalencia conceptual. «Bianual» y «Semestral» significan lo mismo: pendiente (P-04).
- **Quién:** Usuario
- **Dónde quedó:** V20261007_05 y V9 · eb91564

### D-13 · Demografía

- **Decisión:** Seis listas de valores sin uso (sexo, identidad de género, orientación sexual, pertenencia étnica, discapacidad, enfoques diferenciales). La orientación sexual se captura solo autodiligenciada, opcional y con consentimiento. «Barrismo social» queda inactivo.
- **Alternativas consideradas:** Capturarlos en formularios; incluir ocupaciones (CUOC).
- **Motivo y referente:** Guía del DANE de enfoque diferencial (V2, 2026), Resolución 1197 de 2024 y las leyes citadas. Son datos sensibles (Ley 1581): falta la revisión jurídica.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_02 · 04e5b59

### D-14 · NIT de la organización

- **Decisión:** Se mantiene opcional.
- **Alternativas consideradas:** Hacerlo obligatorio; validar el dígito de verificación al capturar.
- **Motivo y referente:** Hoy 46 de 48 organizaciones no lo tienen.
- **Quién:** Usuario
- **Dónde quedó:** Sin cambio

### D-15 · Idiomas: clave y estructura

- **Decisión:** Catálogo con clave ISO 639-3 y equivalencias ISO 639-1, MARC y BCP 47; relación varios a varios con las publicaciones; el texto de la ficha se conserva.
- **Alternativas consideradas:** ISO 639-1 o ISO 639-2/MARC como clave; dejar solo texto.
- **Motivo y referente:** ISO 639-1 y 639-2 no cubren las lenguas indígenas colombianas; 639-3 sí. La ficha ya guardaba etiquetas BCP 47.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_06 y API · 058caba

### D-16 · Lenguas nativas

- **Decisión:** Se cargan las de la lista del Ministerio (65 indígenas, 2 criollas, romaní) y 2 de señas. Nueve con código candidato sin confirmar se cargaron inactivas y después se activaron (D-22).
- **Alternativas consideradas:** Cargar solo las verificadas.
- **Motivo y referente:** Requisito del proyecto de incluir todo lo sugerido. Los códigos existen en la tabla de SIL; lo no confirmado es que correspondan al pueblo.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_06 · 058caba

### D-17 · «(lengua nativa)» en publicaciones

- **Decisión:** Las 5 publicaciones pasan a «indeterminado» (und).
- **Alternativas consideradas:** Asignar una lengua concreta.
- **Motivo y referente:** El acervo nunca dijo cuál. Hay que preguntarlo (P-03).
- **Quién:** Decisión técnica
- **Dónde quedó:** V20261007_06 · 058caba

### D-18 · Código propio para lenguas sin ISO

- **Decisión:** Kichwa, Miraña, Pisamira, Taiwano, Tucuná y Yanuro entran con códigos de uso privado qaa–qaf, activas. Verificacion = codigo_propio los distingue de los oficiales (una restricción impide mezclarlos); si SIL asigna uno oficial, se anota en Descripcion.
- **Alternativas consideradas:** Dejarlas fuera; asignarles un código ISO parecido; usar «otros idiomas» o «indeterminado»; inventar códigos fuera del rango privado.
- **Motivo y referente:** IANA y RFC 5646 reservan qaa..qtz para uso privado; ISO lo reserva igual; SIL no tiene ningún código ahí. Afirmar un código ISO sin confirmar sería inventar un dato.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_07 · da4c8dd

### D-19 · Roles de crédito (propuesta)

- **Decisión:** Un catálogo con 51 roles: código MARC como clave cuando existe, clave propia cuando no, y equivalencia con DDEX (obra y grabación), marcada exacta, aproximada o ninguna.
- **Alternativas consideradas:** Solo MARC; solo DDEX; texto libre como hoy.
- **Motivo y referente:** MARC es el lenguaje de la catalogación bibliográfica y base de RDA; no cubre mezcla, masterización ni productor artístico, que DDEX sí. No existe mapeo oficial MARC–DDEX.
- **Quién:** Pendiente de decisión (P-01)
- **Dónde quedó:** Propuesta y migración probada en una copia; sin aplicar

### D-20 · Diferidos

- **Decisión:** Sectores y áreas culturales, CUOC y ocupaciones, roles musicales e instrumentos quedan para después.
- **Alternativas consideradas:** —
- **Motivo y referente:** Primero consolidar los catálogos generales y transversales.
- **Quién:** Usuario
- **Dónde quedó:** R-05 del plan maestro

### D-21 · Método de trabajo

- **Decisión:** Todo cambio de datos es idempotente, conserva los ids y se ensaya antes en una copia de la base real; los códigos y términos de los estándares se comprueban contra la fuente descargada.
- **Alternativas consideradas:** Ensayar con una transacción que se revierte; confiar en resúmenes de la investigación.
- **Motivo y referente:** Un ensayo con XACT_ABORT confirmó cambios fuera de la transacción de prueba, y un informe citó términos DDEX que no existen. Una corrida de pruebas con binario viejo ocultó una prueba fallida.
- **Quién:** Decisión técnica
- **Dónde quedó:** Informe consolidado, sección «Comprobaciones»

### D-22 · Ampliación del catálogo de idiomas

- **Decisión:** Se activan las 9 lenguas «por verificar» (siguen marcadas «código por verificar») y el catálogo se amplía a todos los idiomas con código ISO 639-1: 174 más, para un total de 266. Nombres en español de Unicode CLDR 48.
- **Alternativas consideradas:** Mantener las 9 inactivas hasta confirmarlas; cargar solo los idiomas frecuentes; cargar los ~480 de ISO 639-2 o los 7.927 de ISO 639-3.
- **Motivo y referente:** Requisito del proyecto: «lo más amplio posible desde el minuto uno». Los de dos letras cubren los idiomas de uso general; el resto se agrega cuando se necesite. Los 174 nombres existen en CLDR y ninguno choca. Lo no confirmado se dice en pantalla.
- **Quién:** Usuario
- **Dónde quedó:** V20261007_08

### D-23 · Nombres del idioma y búsqueda

- **Decisión:** Cada idioma tiene un solo nombre en el catálogo (NombreIdioma). Los nombres alternos (SIL y Ministerio de Cultura) viven en la tabla IdiomasNombres y la búsqueda los usa junto con el código.
- **Alternativas consideradas:** Tres columnas de nombre en la misma tabla (NombreIdioma, NombreSil, NombreOficialColombia).
- **Motivo y referente:** Una sola columna de nombre para mostrar evita elegir cuál usar; los alternos solo sirven para buscar y para dejar traza de la fuente, y ahí cuestan menos (256 filas). Reemplaza la decisión previa de no crear tabla de alias.
- **Quién:** Usuario y decisión técnica
- **Dónde quedó:** V20261007_09; API y formulario

### D-24 · Qué toma cada tabla y cómo se elige un idioma

- **Decisión:** Toda tabla guarda una clave foránea a CodigoIdioma (nunca el nombre). La etiqueta para la web se deduce (2 letras si existe, si no el código) y no se guarda. MARC usa CodigoMarc. El formulario ofrece un buscador y un desplegable agrupado por categoría del idioma, con lo ya usado primero.
- **Alternativas consideradas:** Guardar el nombre; guardar la etiqueta BCP 47 en una columna; una lista plana.
- **Motivo y referente:** El nombre cambia (tildes, rótulos); la etiqueta se puede calcular; con 266 idiomas una lista plana no sirve.
- **Quién:** Usuario (pregunta) y decisión técnica
- **Dónde quedó:** API, formulario y pruebas

### D-25 · Estructura mínima de Idiomas

- **Decisión:** Idiomas queda con 8 columnas: CodigoIdioma, CodigoIso6391, CodigoMarc, NombreIdioma, Ambito, Verificacion, Descripcion, Activo. Se retiran EtiquetaBcp47, NombreSil, NombreOficialColombia, AlcanceIso, OrdenVisualizacion, OrigenCodigo, ReemplazadoPor y CodigoMarcGrupo. Un CHECK separa los códigos propios (qaa–qtz) de los ISO.
- **Alternativas consideradas:** Conservar las columnas de trazabilidad en la misma tabla.
- **Motivo y referente:** Cada columna debía responder a un uso real. Lo deducible se calcula; la trazabilidad pasa a Verificacion, Descripcion e IdiomasNombres; el orden se obtiene por ámbito y nombre.
- **Quién:** Usuario y decisión técnica
- **Dónde quedó:** V20261007_09

### D-26 · El idioma de la publicación vive solo en la relación

- **Decisión:** Se elimina la columna de texto PublicacionesEditoriales.Idioma. El idioma de cada publicación se guarda únicamente en PublicacionesEditorialesIdiomas; el formulario, la importación y la API usan la misma clase IdiomasDeContenido.
- **Alternativas consideradas:** Mantener el texto y la relación a la vez.
- **Motivo y referente:** Dos lugares para el mismo dato se desajustan. La migración reconstruye la relación y se detiene (errores 51040/51041) si algún texto no se reconoce.
- **Quién:** Usuario y decisión técnica
- **Dónde quedó:** V20261007_10; API, formulario, importación

### D-27 · Catálogos demográficos con un solo código

- **Decisión:** Cada catálogo demográfico usa como clave su código (Codigo<X>) en lugar de Id + Slug, con Nombre<X>, Descripcion, Orden y Activo.
- **Alternativas consideradas:** Conservar Id numérico más Slug único.
- **Motivo y referente:** Un identificador y un código para lo mismo es redundante; las tablas no tenían relaciones que dependieran del Id.
- **Quién:** Usuario y decisión técnica
- **Dónde quedó:** V20261007_11

## Registro de fuentes

| Catálogo | Referente | Entidad | Verificación |
|---|---|---|---|
| Regiones del SGR | Ley 2056 de 2020, art. 45 (anexo de MinCiencias: `minciencias.gov.co/sites/default/files/upload/convocatoria/anexo_8._distribucion_geografica_por_departamento_y_regiones_11.pdf`) | Congreso; DNP | Verificado (lista); vigencia de los OCAD sin verificar |
| Divipola | DANE, DIVIPOLA / MGN 2025 (`geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer`) | DANE | Verificado |
| Zona urbano/rural | DANE, Marco Geoestadístico Nacional (`geoportal.dane.gov.co/descargas/descarga_mgn/fichatecnicamgn2017.pdf`) | DANE | Verificado los nombres; definición completa por confirmar |
| Tipos de documento | DIAN, RUT, instructivo IN-CAC-0237 v3, casilla 25 | DIAN | Verificado como guía de la lista (no se guardan sus códigos) |
| Naturaleza de la entidad | DIAN, RUT, casilla 62; Ley 489 de 1998 | DIAN | Verificado el RUT; Ley 489 referida |
| Titulaciones colectivas | Ley 70 de 1993; Decreto 2164 de 1995; ANT, Dirección de Asuntos Étnicos | Congreso; ANT | Verificado Ley 70 y ANT; Decreto referido |
| Fuentes de financiación | Ley 1493 de 2011; Ministerio de Cultura (IGMC) | Congreso; MinCultura | Verificado; regalías y cooperación sin fuente consultada |
| Tipologías de festival | — (acuerdo del programa, SIMUS histórico) | — | Sin referente externo |
| Periodicidades | Dublin Core, vocabulario de frecuencia (`dublincore.org/specifications/dublin-core/collection-description/frequency/`) | DCMI | Verificado; los códigos son los de la API |
| Idiomas | ISO 639-3, tabla de SIL (`iso639-3.sil.org/sites/iso639-3/files/downloads/iso-639-3.tab`, 7.927 filas); MARC Code List for Languages (`loc.gov/marc/languages/language_code.html`); registro IANA de subetiquetas (corte 2026-09-17); RFC 5646; nombres en español de Unicode CLDR 48 (`cldr-json`, `cldr-localenames-full`, locale `es`) | SIL; Biblioteca del Congreso; IANA; Unicode | Verificado; cada código comprobado |
| Lenguas nativas | Lista del Ministerio de Cultura según Colombia Aprende | MinCultura (vía tercero) | **Por contrastar** con MinCultura y el Instituto Caro y Cuervo |
| Demografía | DANE, Guía de enfoque diferencial e interseccional V2 (2026); Resolución 1197 de 2024 (Minsalud); Acto Legislativo 01 de 2023; Ley 1448 de 2011; Ley 2136 de 2021 | DANE; Minsalud; Congreso | Verificado; «barrismo social» sin fuente |
| Roles de crédito (propuesta) | MARC Code List for Relators (`loc.gov/marc/relators/relacode.html`); DDEX AVS ResourceContributorRole y MusicalWorkContributorRole (`service.ddex.net/dd/DD-AVS-CURRENT/dd/`) | Biblioteca del Congreso; DDEX | Verificado (descargadas); sin aplicar |

## Por qué MARC y DDEX (resumen)

MARC es el lenguaje de la catalogación bibliográfica: su lista de relatores (309 códigos de tres letras) dice qué papel tuvo un agente frente a un recurso, es el vocabulario de las bibliotecas y la base de RDA, que el catálogo editorial ya usa. Se mantiene fuera de SIMUS, de modo que sus códigos son estables. No cubre mezcla, masterización, productor artístico ni remix. DDEX es el estándar con que la industria discográfica intercambia créditos con distribuidoras y plataformas; tiene un vocabulario de obra (compositor, letrista, arreglista) y otro de grabación (intérprete, ingeniero de mezcla, productor). No existe un mapeo oficial MARC–DDEX: el cruce es de SIMUS y cada equivalencia se marca exacta, aproximada o ninguna.

## Pendientes

Están en el informe consolidado (sección «Decisiones y trabajo pendiente») y en el plan de trabajo (`DER_Plan_de_trabajo_simus_v06`, tareas T-200 a T-207).

### D-28 · Idiomas depurados

- **Decisión:** Dos tablas; catálogo de seis campos; lista visible de nombres sin categorías; retiro de alias y MARC del modelo operativo.
- **Quién:** Usuario, 9 de octubre de 2026.
- **Motivo:** Mantener un catálogo sencillo y evitar tablas y equivalencias sin necesidad operativa.
- **Conservación:** No se cambian códigos ni relaciones de publicaciones; la información retirada se exporta antes de desplegar.
- **Dónde quedó:** V20261009_01, modelo, API, importación y selector editorial. Ensayo SQL completado y migración aplicada en SIMUS_LOCAL de version-2; despliegue institucional pendiente.


### D-29 · Categorías propias de noticias y agenda; revisión editorial

- **Decisión:** Siete categorías de noticias y cinco de agenda en Categorias, separadas por CodigoModulo. Sin temas comunes obligatorios.
- **Quién:** Usuario, 9 de octubre de 2026.
- **Implementación:** V20261009_02 y semilla final V20261009_01; nombres e ids conservados cuando corresponde; fusión de Encuentro. Altas, edición, filtros y administración validan módulo.
- **Editorial:** Conservar nueve secciones y 22 rutas durante revisión; 170 fichas coherentes y una sin sección/ruta. No reclasificar ni retirar campos secundarios automáticamente.
- **Verificación:** SQL Server sobre copia restaurada, recarga de semillas y despliegue local; 96 pruebas API, 122 interfaz, build web y consultas públicas reales.
- **Pendiente:** Revisar definiciones y casos editoriales documentados; versión y QA institucionales.


### D-29 · Clasificación editorial de dos niveles

- **Decisión:** Reutilizar Categorias con padre opcional y asignar categoría principal más subcategoría opcional a cada publicación. Editorial usa su catálogo propio. Las prácticas musicales se mantienen en el catálogo maestro, con relaciones múltiples; colección, programas, palabras clave y los cuatro ejes de tipología son independientes.
- **Fuente:** Aprobación de Edder Jiménez; revisión de las 171 fichas y 22 rutas originales de SIMUS_LOCAL el 2026-10-09. Definiciones operativas propias de SIMUS, documentadas en el reporte de categorías v04.
- **Implementación local:** V20261009_03; 9 categorías principales y 20 subcategorías. 170 fichas con categoría, 70 con subcategoría por correspondencia explícita, 143 vínculos de prácticas en 126 fichas. La fuente original permanece intacta y consultable en la consola. La clasificación actual se resuelve por relaciones; no se edita otra ruta manual.
- **Pendientes:** PNMC-ED-001, revisión de las 101 fichas sin subcategoría, Creación y Circulación, equivalencias ambiguas de prácticas y QA/versionamiento institucional. Una asignación automática basada en la etiqueta de origen sigue sujeta a revisión del contenido.


### D-30 · Recargas que respetan el catálogo editorial administrado

- **Decisión:** Inicializar el catálogo una sola vez por migración. La recarga de semillas no actualiza, repone ni elimina categorías editoriales, y no reclasifica publicaciones existentes.
- **Implementación:** Semilla administrativa V20261009_03 sin editorial; acervo V20261009_04 con captura temporal de IDs recién insertados y clasificación dentro de la transacción; publicación inicial V20261009_05 con procedencia vigente. El cargador local retira las versiones anteriores de su flujo. Se conservan los scripts históricos; no deben ejecutarse manualmente sobre el catálogo gestionado.
- **Verificación:** Prueba permanente CatalogoEditorialSemillasSqlServerTests aprobada; recargas sobre copias SQL Server conservan nombres, slugs, descripciones, orden, padres, altas, retiradas y decisiones de clasificación. Primera carga: 171 fichas, 170 con categoría, 70 con subcategoría, 143 vínculos de prácticas. Cargador local completo ensayado en una copia, sin alterar SIMUS_LOCAL.
- **Pendientes:** Revisión conjunta de 60 fichas de Creación y Circulación; validación del cargador PowerShell completo y del perfil institucional antes del despliegue. Reporte de categorías v05.

### D-31 · Revisión temática por ficha del acervo editorial

- **Decisión:** La categoría describe la finalidad o el tema de la publicación. El tipo de contenido y el soporte se conservan como facetas independientes: por ejemplo, música interpretada y disco de audio, o música notada y volumen. La convocatoria, programa o colección tampoco define por sí sola la categoría.
- **Implementación:** V20261009_04 incorpora las subcategorías «Creación e interpretación musical» y «Registros de conciertos y experiencias de circulación», y reasigna únicamente las fichas cuya descripción de origen permite establecer un criterio. La carga inicial vigente V20261009_06 aplica las mismas decisiones exclusivamente a las fichas nuevas.
- **Trazabilidad:** Cada decisión conserva las columnas de origen `SeccionPrincipal`, `RutaSeccion`, `Subcategoria`, `PracticaMusical` y `CategoriaSecundaria`. El reporte de trazabilidad editorial v06 registra por ficha la ruta de origen, la clasificación anterior, la actual, el fundamento y las observaciones pendientes.
- **Pendientes:** Confirmar los recursos de las fichas que presentan información contradictoria o incompleta —en especial PNMC-ED-014, 053, 054, 057, 104, 116/148 y 151, 160 a 163— antes de declarar cerrada su catalogación.
