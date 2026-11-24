#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AGENDAS DE CITAS DE MERCADOS PARA LA DEMO INTEGRAL. Añade SOLO esto a una demo ya sembrada con
# `siembra-integral.sh completa`: no borra ni modifica nada más. Es idempotente (por alias en dbo.DatosDeDemostracion).
#
#   ./scripts/demo/sembrar-agenda-de-citas.sh            # explica qué hace y muestra el estado (no escribe)
#   SIMUS_SIEMBRA_CONFIRMAR=<base> ./scripts/demo/sembrar-agenda-de-citas.sh --si   # aplica y muestra el mapa cuenta → rol → URL
#   ./scripts/demo/sembrar-agenda-de-citas.sh mapa       # solo muestra el mapa cuenta → rol → URL (lee la base; no escribe)
#
# Qué siembra (lote `n1-agenda-de-citas`, nivel 1, sintético; claves estables `n1.agenda-de-citas.*`), sobre el Mercado PUBLICADO de la
# Corporación Sonora Andina (la organización grande de `camila.restrepo@simus.test`):
#   abierta   edición 2027: franjas, 5 artistas aprobados (cada uno con su stand), 1 por decidir, 2 en lista de espera, 1 rechazado, 4 compradores con mesa, citas en 5 estados;
#   mesas fijas  edición 2027 (ABIERTA en la otra modalidad: compradores con mesa, artistas que piden): 3 mesas, 4 artistas aprobados y 1 por decidir, y solicitudes
#             PENDIENTES de los artistas (eliecer.rios@ y otros hacia margarita.buelvas@) que cada comprador confirma o rechaza;
#   borrador  edición 2027: recién creada, sin franjas ni participantes (para organizar desde cero);
#   cerrada   edición 2025: ya realizada, con sus citas.
# EN UNA DEMO YA SEMBRADA solo AÑADE: inserta las filas que faltan (por alias) y pone su stand a los artistas admitidos de la agenda abierta que no lo tienen
# (UPDATE solo donde `Espacio` está vacío: no pisa lo que la organización asignó). No borra ni modifica nada más. Se puede repetir.
# Las cuentas que participan son las del libro N1 de personas (@simus.test, clave «admin»); `nuevo@simus.test` queda sin participación.
# El mapa completo está en siembra/docs/agenda-de-citas.md.
#
# Seguridad: opera solo sobre la base de SIMUS_LOCAL_DB_NAME (por omisión SIMUS_LOCAL), solo si empieza por SIMUS_, y escribir exige
# SIMUS_SIEMBRA_CONFIRMAR con el nombre exacto de la base. La clave del SA se lee del entorno o de .env y nunca se imprime.
# Requiere la demo sembrada (cuentas, Mercado y pool de imágenes: ver siembra/README.md).
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
# En un árbol enlazado el .env vive en el repositorio principal (fuera de git); la clave se lee sin imprimirla.
if [[ -z "${SIMUS_LOCAL_SA_PASSWORD:-}" ]]; then
  principal="$(git -C "$ROOT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's#/\.git$##')"
  if [[ -n "$principal" && -f "$principal/.env" ]]; then
    SIMUS_LOCAL_SA_PASSWORD="$(grep -E '^SIMUS_LOCAL_SA_PASSWORD=' "$principal/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"; export SIMUS_LOCAL_SA_PASSWORD
  fi
fi
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

ACCION="${1:-estado}"
[[ "$ACCION" == "--si" ]] && ACCION="aplicar"

if [[ -z "$SQL_DB_PASSWORD" ]]; then echo "[agenda-de-citas] Falta SIMUS_LOCAL_SA_PASSWORD." >&2; exit 1; fi
if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[agenda-de-citas] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2; exit 1
fi
case "$ACCION" in estado|aplicar|mapa) ;; *) sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2 ;; esac

consulta() { sql_consulta "$1" 2>/dev/null | tr -d '\r' | sed 's/ *$//' | grep -v '^$'; }
id_de() { consulta "SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'$1'" | head -1; }

# La demo debe estar sembrada: el kit, las cuentas de validación, el Mercado publicado con su edición 2027 y las personas del libro N1.
comprobar_demo() {
  local falta=""
  [[ "$(consulta "SELECT COUNT(*) FROM sys.tables WHERE name = N'DatosDeDemostracion'")" == "1" ]] || falta="no existe dbo.DatosDeDemostracion (siembra-integral.sh preparar)"
  if [[ -z "$falta" ]]; then
    local n; n="$(consulta "SELECT COUNT(*) FROM dbo.DatosDeDemostracion WHERE Alias IN (N'mercado.camila-grande-mercado-publicado.edicion.2027', N'mercado.camila-grande-mercado-publicado.edicion.2025', N'cuenta.externo-camila', N'persona.eliecer-rios', N'persona.margarita-buelvas', N'persona.olga-mejia')")"
    [[ "$n" == "6" ]] || falta="la demo no está sembrada con la siembra integral (faltan el Mercado de la organización de Camila o las personas del libro N1)"
  fi
  if [[ -n "$falta" ]]; then echo "[agenda-de-citas] $falta. Base: $SQL_DB_NAME." >&2; return 1; fi
}

estado() {
  local n; n="$(consulta "SELECT COUNT(*) FROM dbo.DatosDeDemostracion WHERE Lote = N'n1-agenda-de-citas'")"
  echo "[agenda-de-citas] base: $SQL_DB_NAME · filas del lote n1-agenda-de-citas ya sembradas: ${n:-0}"
}

mapa() {
  local web="${SIMUS_WEB_URL:-http://127.0.0.1:${SIMUS_LOCAL_WEB_PORT:-4300}}"
  local org mercado ab bo ce ed27 ed25
  org="$(id_de org.camila-grande)"; mercado="$(id_de mercado.camila-grande-mercado-publicado)"
  ab="$(id_de agenda-de-citas.abierta)"; fj="$(id_de agenda-de-citas.abierta-mesas-fijas)"; bo="$(id_de agenda-de-citas.borrador)"; ce="$(id_de agenda-de-citas.cerrada)"
  ed27="$(id_de mercado.camila-grande-mercado-publicado.edicion.2027)"; ed25="$(id_de mercado.camila-grande-mercado-publicado.edicion.2025)"
  if [[ -z "$ab" ]]; then echo "[agenda-de-citas] Las agendas aún no están sembradas en $SQL_DB_NAME." >&2; return 1; fi
  [[ -n "$fj" ]] || fj="(aún no sembrada: aplica el script con --si)"
  local testigo; testigo="$(python3 -I "$ROOT_DIR/siembra/generador/agenda_de_citas.py" --testigo)"
  cat <<EOF

MAPA cuenta → rol → URL (clave de todas: admin). Base: $SQL_DB_NAME · web: $web
Organización: Corporación Sonora Andina (id $org) · Mercado publicado id $mercado · edición 2027 id $ed27 · edición 2025 id $ed25
Agendas: abierta (stands fijos) id $ab · abierta (mesas fijas) id $fj · borrador id $bo · cerrada id $ce

ORGANIZANDO
  camila.restrepo@simus.test   administra la organización (abre, cierra, aprueba, rechaza y cancela)
      $web/gestion/o/$org/herramientas/agenda-de-citas                       lista de ediciones con agenda
      $web/gestion/o/$org/procesos/mercados/$mercado/agenda-de-citas/$ab     abierta (stands fijos; los compradores rotan): franjas, participantes, citas
      $web/gestion/o/$org/procesos/mercados/$mercado/agenda-de-citas/$fj     abierta (mesas fijas; los artistas rotan): mesas y solicitudes de los artistas por decidir
      $web/gestion/o/$org/procesos/mercados/$mercado/agenda-de-citas/$bo     borrador: configurar, generar franjas, invitar compradores y abrir
      $web/gestion/o/$org/procesos/mercados/$mercado/agenda-de-citas/$ce     cerrada: consultar y exportar
  editor@simus.test          editor de la misma organización (prepara; abrir, cerrar, rechazar y cancelar siguen con el administrador)
      las mismas URL de arriba

PARTICIPANDO (Mi espacio → agenda de citas): $web/gestion/cuenta/agenda-de-citas   y, con una agenda, …/agenda-de-citas/$ab
  eliecer.rios@simus.test        ARTISTA aprobado con citas confirmadas y solicitudes por responder (también aprobado en la cerrada); en la de mesas fijas pide citas y espera la respuesta
  martha.rangel@simus.test       ARTISTA aprobada con citas
  gilberto.pedraza@simus.test    ARTISTA aprobado (representa a una banda) con citas
  dennis.bryan@simus.test        ARTISTA aprobado con citas (en la cerrada figura retirado)
  fabian.rojas@simus.test        ARTISTA aprobado con citas
  tatiana.cardozo@simus.test     ARTISTA con inscripción PENDIENTE de decisión de la organización
  olga.mejia@simus.test          ARTISTA en LISTA DE ESPERA (lugar 1)
  julian.arboleda@simus.test     ARTISTA en LISTA DE ESPERA (lugar 2)
  angela.burbano@simus.test      ARTISTA con inscripción RECHAZADA (con motivo)
  margarita.buelvas@simus.test   COMPRADORA con Mesa 1 (agencia: Marea Alta Producciones); pide citas a los artistas; en la de mesas fijas RECIBE solicitudes por confirmar o rechazar
  hernan.velasquez@simus.test    COMPRADOR con Mesa 2 (sello: Altamira Discos)
  rosalba.perez@simus.test       COMPRADORA con Mesa 3 (sala: Casa de la Música La Candelaria)
  nuevo@simus.test               SIN participación: se inscribe como artista desde cero en la agenda abierta
Compradora invitada sin cuenta (Yuliana Mosquera Mena, Mesa 4, Festival de Arrullos y Alabaos del Baudó): su invitación pendiente se abre en
      $web/ecosistema/invitacion-agenda?testigo=$testigo

PÚBLICO (sin cuenta): $web/ecosistema/agenda-de-citas    (lista solo la agenda abierta)   API: /api/v1/publico/agendas-de-citas
EOF
}

case "$ACCION" in
  estado)
    estado
    comprobar_demo && echo "[agenda-de-citas] La demo está lista. (SIN EJECUTAR) Para aplicar: SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME $0 --si" ;;
  mapa)
    mapa ;;
  aplicar)
    if [[ "${SIMUS_SIEMBRA_CONFIRMAR:-}" != "$SQL_DB_NAME" ]]; then
      echo "[agenda-de-citas] Esta acción escribe en $SQL_DB_NAME. Confirma con SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME." >&2; exit 2
    fi
    comprobar_demo || exit 1
    estado
    guiones="$(mktemp -d -t simus-agenda-de-citas-XXXXXX)"
    trap 'rm -rf "$guiones"' EXIT
    echo "[agenda-de-citas] Generando el plan (determinista) y validándolo …"
    python3 -I "$ROOT_DIR/siembra/generador/agenda_de_citas.py" --salida "$guiones" >/dev/null || { echo "[agenda-de-citas] El plan no se pudo generar (¿falta el pool de imágenes? construir.py completar)." >&2; exit 1; }
    for g in "$guiones"/*.sql; do
      echo "[agenda-de-citas] aplicando $(basename "$g") …"
      sql_fichero "$g" || { echo "[agenda-de-citas] FALLÓ $(basename "$g"); no se aplicó nada de ese lote (transacción)." >&2; exit 1; }
    done
    estado
    violaciones="$(sql_consulta "SET NOCOUNT ON; DBCC CHECKCONSTRAINTS ('dbo.AgendasDeCitas') WITH ALL_CONSTRAINTS, NO_INFOMSGS; DBCC CHECKCONSTRAINTS ('dbo.ParticipantesDeCitas') WITH ALL_CONSTRAINTS, NO_INFOMSGS; DBCC CHECKCONSTRAINTS ('dbo.CitasDeAgenda') WITH ALL_CONSTRAINTS, NO_INFOMSGS; DBCC CHECKCONSTRAINTS ('dbo.FranjasDeCitas') WITH ALL_CONSTRAINTS, NO_INFOMSGS" 2>&1 | tr -d '[:space:]')"
    if [[ -n "$violaciones" ]]; then echo "[agenda-de-citas] DBCC CHECKCONSTRAINTS encontró violaciones." >&2; exit 1; fi
    echo "[agenda-de-citas] Aplicado (restricciones sin violaciones)."
    mapa ;;
esac
