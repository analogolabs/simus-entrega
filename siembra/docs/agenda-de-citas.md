# Agendas de citas de mercados en la demo integral

. La herramienta de agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md) cuelga de una **edición de un Mercado**: la organización la habilita, fija franjas y compradores; los artistas se inscriben y piden o responden citas. La siembra clásica (`sembrar-demo.sh`) creaba la del «Mercado Musical del Valle»; la integral no, y por eso `dbo.AgendasDeCitas` quedaba vacía. Este lote la repone con datos propios de la siembra integral.

- Generador: `siembra/generador/agenda_de_citas.py` (determinista; lo invoca `siembra.py` al final del plan, solo con cuentas de validación). Pruebas: `python3 -I siembra/generador/pruebas_agenda_de_citas.py`.
- Procedencia: lote `n1-agenda-de-citas`, nivel 1, `sintetico`; claves estables `n1.agenda-de-citas.abierta`, `.borrador`, `.cerrada`. Alias `agenda-de-citas.<agenda>[.franja.NN | .artista.<clave> | .comprador.<clave> | .cita.NN | .invitacion.<clave>]`.
- Se aplica con la siembra integral (`completa`) o **sola** sobre una demo ya sembrada: `SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/sembrar-agenda-de-citas.sh --si` (idempotente; `mapa` imprime el mapa de abajo con los identificadores reales).
- Imágenes: los participantes con cuenta muestran la foto de su perfil público (retratos del pool de las personas N1); la compradora invitada sin cuenta lleva una foto propia (`img.participante.yuliana-mosquera.foto`, ilustración del pool, privada: solo con sesión).

## Dónde está

Organización **Corporación Sonora Andina**, administrada por `camila.restrepo@simus.test` (editora: `editor@simus.test`). Su Mercado publicado (Cúcuta) tiene las ediciones 2024 y 2025 (realizadas) y 2027 (programada, 4 al 6 de junio de 2027).

| Agenda | Edición | Estado | Modo | Qué tiene |
|---|---|---|---|---|
| Rueda de citas con programadores y sellos | 2027 | **abierta** | los compradores rotan; el artista confirma; aprobación por la organización; cupo 5 | 24 franjas (4 y 5 de junio, desde las 9:00, de 20 min); artistas: 5 aprobados, 1 pendiente, 2 en lista de espera, 1 rechazado; 4 compradores con mesa (3 con cuenta, 1 invitada sin cuenta); 43 citas: confirmadas, solicitadas (esperan al artista), rechazadas con motivo, canceladas y vencidas |
| Rueda de citas con mesas fijas | 2027 | **abierta** | los compradores son fijos (reciben en su mesa) y los artistas rotan y piden; aprobación por la organización; cupo 6 | 16 franjas (4 y 5 de junio, desde las 14:00, de 20 min con 10 de pausa); 3 compradores con Mesa 1, 2 y 3; artistas: 4 aprobados y 1 por decidir; 16 citas, con **solicitudes pendientes de los artistas (`eliecer.rios@` y otros) hacia `margarita.buelvas@`** y hacia los demás compradores, para confirmar o rechazar desde el lado del comprador |
| Ronda de citas con medios y editoriales | 2027 | **borrador** | los compradores son fijos; aprobación automática; cupo 8 | solo configurada: sin franjas ni participantes (se prueba organizar desde cero: generar franjas, invitar compradores y abrir) |
| Rueda de citas 2025 | 2025 | **cerrada** | los compradores son fijos (reciben en su mesa) y los artistas rotan | 16 franjas (21 y 22 de oct. de 2025), 4 artistas aprobados y 1 retirado, 3 compradores con mesa, 18 citas ya ocurridas (confirmadas, rechazadas, canceladas, vencida) |

El esquema no tiene estado «realizada» para una cita: las confirmadas de la agenda cerrada son las citas que se realizaron.

## Mapa cuenta → rol → organización / mercado / agenda

Todas con clave `admin`. Las rutas son de la web (`<web>` = la URL de la web de la demo); los identificadores `<org>`, `<mercado>`, `<ab>`, `<fj>`, `<bo>` y `<ce>` los imprime `./scripts/demo/sembrar-agenda-de-citas.sh mapa`.

| Cuenta | Rol | Organización / agenda | Ruta |
|---|---|---|---|
| `camila.restrepo@simus.test` | **Organizando**: administrador (abre, cierra, aprueba, rechaza, cancela) | Corporación Sonora Andina · las tres agendas | `<web>/gestion/o/<org>/herramientas/agenda-de-citas` (lista) · `<web>/gestion/o/<org>/procesos/mercados/<mercado>/agenda-de-citas/<ab>` (abierta), `/<bo>` (borrador), `/<ce>` (cerrada) |
| `editor@simus.test` | Organizando: editor (prepara; abrir, cerrar, rechazar y cancelar siguen con el administrador) | la misma | las mismas rutas |
| `margarita.buelvas@simus.test` (mesas fijas) | **Compradora que decide**: en «Rueda de citas con mesas fijas» recibe solicitudes pendientes de `eliecer.rios@` y otros artistas, para confirmar o rechazar | mesas fijas | `<web>/gestion/cuenta/agenda-de-citas/<fj>` (`<fj>` lo imprime `mapa`) |
| `eliecer.rios@simus.test` | **Artista aprobado con citas**: confirmadas, solicitudes por responder, una rechazada, una cancelada y una vencida; aprobado también en la cerrada | abierta y cerrada | `<web>/gestion/cuenta/agenda-de-citas` · `…/agenda-de-citas/<ab>` |
| `martha.rangel@simus.test` | Artista aprobada con citas | abierta y cerrada | ídem |
| `gilberto.pedraza@simus.test` | Artista aprobado (representa a una banda) con citas | abierta y cerrada | ídem |
| `dennis.bryan@simus.test` | Artista aprobado con citas (en la cerrada figura retirado) | abierta y cerrada | ídem |
| `fabian.rojas@simus.test` | Artista aprobado con citas | abierta y cerrada | ídem |
| `tatiana.cardozo@simus.test` | Artista con inscripción **pendiente** de decisión | abierta | ídem |
| `olga.mejia@simus.test` | Artista en **lista de espera**, lugar 1 | abierta | ídem |
| `julian.arboleda@simus.test` | Artista en **lista de espera**, lugar 2 | abierta | ídem |
| `angela.burbano@simus.test` | Artista con inscripción **rechazada** (con motivo) | abierta | ídem |
| `margarita.buelvas@simus.test` | **Compradora con mesa** (Mesa 1, Marea Alta Producciones, agencia): pide citas a los artistas | abierta y cerrada | ídem |
| `hernan.velasquez@simus.test` | Comprador con Mesa 2 (Altamira Discos, sello) | abierta y cerrada | ídem |
| `rosalba.perez@simus.test` | Compradora con Mesa 3 (Casa de la Música La Candelaria, sala) | abierta y cerrada | ídem |
| `nuevo@simus.test` | **Sin participación**: se inscribe como artista desde cero | puede inscribirse en la abierta | `<web>/gestion/cuenta/agenda-de-citas/<ab>` |
| (sin cuenta) Yuliana Mosquera Mena | Compradora invitada, Mesa 4 (Festival de Arrullos y Alabaos del Baudó), invitación pendiente | abierta | `<web>/ecosistema/invitacion-agenda?testigo=<testigo>` (el guion imprime el testigo, solo de la demo) |
| público | Ve que hay una agenda abierta y su cupo (ningún dato de personas) | | `<web>/ecosistema/agenda-de-citas` · API `/api/v1/publico/agendas-de-citas` |

Las demás cuentas de validación (`webmaster@simus.test`, `gestor@simus.test`, `reclamante@simus.test`) no participan; la consola (`webmaster@simus.test`) ve las cuatro agendas en `/api/v1/institucional/agendas-de-citas`.

## Diseño de los datos

- **Stands**: en la agenda abierta de stands fijos cada artista admitido tiene su stand (Stand 1 a Stand 5), de modo que la parrilla, las tarjetas de mesa y «Tu stand» muestran el dato. Es dato de siembra: la organización ya puede asignar stands y mesas desde Participantes.
- **Sin doble reserva**: ni el artista ni el comprador tienen dos citas vivas (solicitada o confirmada) en la misma franja, como exigen los índices únicos de la base; el generador lo comprueba al construir el plan y la prueba lo repite.
- **Solicitudes que siguen vivas**: la agenda abierta usa vencimiento de 720 horas, de modo que las solicitudes pendientes no se vencen solas durante varias semanas; las vencidas son anteriores.
- **Coherencia cronológica**: la agenda se creó antes de abrir la inscripción; cada inscripción, carga de comprador y solicitud es posterior a ella; la agenda cerrada se cierra después de la edición.
- **Textos**: presentaciones, mensajes y motivos son distintos entre sí; los correos de contacto y los de invitación son `.test`.
