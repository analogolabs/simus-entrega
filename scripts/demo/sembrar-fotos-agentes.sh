#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PONE LAS FOTOS LIBRES A LAS FICHAS DEL DIRECTORIO DE AGENTES en una demo YA SEMBRADA, sin resembrar. Nunca se ejecuta sola ni la llama otro guion.
#
#   ./scripts/demo/sembrar-fotos-agentes.sh            # sin --si: valida el plan (sin tocar la base) y explica qué haría
#   ./scripts/demo/sembrar-fotos-agentes.sh --si       # aplica (exige SIMUS_SIEMBRA_CONFIRMAR=<nombre de la base>)
#
# Qué hace: (1) carga en el Banco de archivos las 31 fotos libres de `siembra/imagenes/` (instrumentos musicales, CC0 / dominio público, ver LICENCIAS.md; filas de
# `Archivos` del lote `n3-multimedia`, registradas en `dbo.DatosDeDemostracion` con alias `img.pool.agente.NNN`); (2) cambia `PerfilesPublicos.ArchivoFotoId` de cada ficha
# sembrada que tenía un retrato ilustrado por su foto libre, con el MISMO reparto determinista que la siembra completa. Las ilustraciones antiguas quedan sin vínculo
# (la API solo sirve archivos vinculados a algo publicado) y no se borra nada.
# Es IDEMPOTENTE: repetirlo no duplica archivos ni vuelve a escribir fichas que ya tienen su foto. Los binarios vienen del repositorio: no necesita pool externo ni red.
#
# Seguridad: opera solo sobre la base de SIMUS_LOCAL_DB_NAME y solo si su nombre empieza por SIMUS_. No usa red ni servicios institucionales.
# La clave del SA se lee del entorno o de .env y nunca se imprime.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

APLICAR=""
for arg in "$@"; do
  case "$arg" in
    --si) APLICAR=1 ;;
    -h|--help) sed -n 2,17p "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "[fotos-agentes] Opción desconocida: $arg (usa --si o --help)." >&2; exit 2 ;;
  esac
done

if [[ -z "$APLICAR" ]]; then
  python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --solo-plan --solo-fotos-agentes || exit 1
  echo "[fotos-agentes] (SIN EJECUTAR) Para aplicarlo: SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME $0 --si" >&2
  exit 2
fi

if [[ -z "$SQL_DB_PASSWORD" ]]; then echo "[fotos-agentes] Falta SIMUS_LOCAL_SA_PASSWORD." >&2; exit 1; fi
if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[fotos-agentes] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2; exit 1
fi
if [[ "${SIMUS_SIEMBRA_CONFIRMAR:-}" != "$SQL_DB_NAME" ]]; then
  echo "[fotos-agentes] Esto escribe en $SQL_DB_NAME. Confirma con SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME." >&2; exit 2
fi

sembrada="$(sql_consulta "SET NOCOUNT ON; SELECT CASE WHEN OBJECT_ID(N'dbo.DatosDeDemostracion', N'U') IS NULL THEN 0 ELSE 1 END" | tr -dc '0-9')"
sis="$(sql_consulta "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local'" | tr -dc '0-9')"
if [[ "${sembrada:-0}" == "0" || "${sis:-0}" == "0" ]]; then
  echo "[fotos-agentes] La base no tiene la tabla del kit de demostración (dbo.DatosDeDemostracion) ni el usuario del sistema: primero la siembra integral (siembra-integral.sh preparar / completa)." >&2; exit 1
fi

python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --aplicar --solo-fotos-agentes || { echo "[fotos-agentes] La carga de las fotos falló (cada lote va en una transacción)." >&2; exit 1; }

ajustes="$(mktemp -t simus-fotos-agentes-XXXXXX.sql)"
python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --sql-ajustes-fotos-agentes "$ajustes" || { rm -f "$ajustes"; exit 1; }
if sql_fichero "$ajustes"; then rm -f "$ajustes"; else rm -f "$ajustes"; echo "[fotos-agentes] El cambio de foto de las fichas falló." >&2; exit 1; fi

echo "[fotos-agentes] Verificación:"
sql_consulta "SELECT N'fotos libres cargadas: ' + CAST(COUNT(*) AS nvarchar(6)) FROM dbo.DatosDeDemostracion WHERE Tabla = N'Archivos' AND Alias LIKE N'img.pool.agente.%'"
sql_consulta "SELECT N'fichas con foto libre: ' + CAST(COUNT(*) AS nvarchar(6)) + N'; con otra foto (p. ej. retrato ilustrado): ' + CAST((SELECT COUNT(*) FROM dbo.PerfilesPublicos WHERE ArchivoFotoId IS NOT NULL) - COUNT(*) AS nvarchar(6)) FROM dbo.PerfilesPublicos p JOIN dbo.DatosDeDemostracion d ON d.Tabla = N'Archivos' AND d.IdRegistro = CAST(p.ArchivoFotoId AS nvarchar(120)) AND d.Alias LIKE N'img.pool.agente.%'"
echo "[fotos-agentes] Listo. Para comprobarlo en la API: GET /api/v1/publico/personas (fotoUrl de cada ficha)."
