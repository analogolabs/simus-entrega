#!/usr/bin/env bash

# Carga exclusivamente la configuracion local ignorada por Git. Los scripts que
# requieren servicios locales la incluyen para que `cp .env.example .env` sea
# suficiente y no haya credenciales versionadas ni valores secretos por defecto.

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ROOT_DIR/.env"
  set +a
fi

# Transición de PNMC a SIMUS: los nuevos entornos usan exclusivamente SIMUS_LOCAL_*.
# Leemos los nombres anteriores solo para que una instalación local existente no deje
# de arrancar al actualizar el repositorio; no se documentan ni se escriben de vuelta.
adoptar_variable_heredada() {
  local nueva="$1"
  local anterior="$2"
  if [[ -z "${!nueva:-}" && -n "${!anterior:-}" ]]; then
    export "$nueva=${!anterior}"
  fi
}

adoptar_variable_heredada SIMUS_LOCAL_SA_PASSWORD PNMC_LOCAL_SA_PASSWORD
adoptar_variable_heredada SIMUS_LOCAL_SQL_PORT PNMC_LOCAL_SQL_PORT
adoptar_variable_heredada SIMUS_LOCAL_DB_NAME PNMC_LOCAL_DB_NAME
adoptar_variable_heredada SIMUS_LOCAL_API_PORT PNMC_LOCAL_API_PORT
adoptar_variable_heredada SIMUS_LOCAL_WEB_PORT PNMC_LOCAL_WEB_PORT
adoptar_variable_heredada SIMUS_LOCAL_SQL_CONTAINER PNMC_LOCAL_SQL_CONTAINER
adoptar_variable_heredada SIMUS_LOCAL_SQL_TOOLS_IMAGE PNMC_LOCAL_SQL_TOOLS_IMAGE
adoptar_variable_heredada SIMUS_CONFIRMAR_BASELINE PNMC_CONFIRMAR_BASELINE
adoptar_variable_heredada SIMUS_PERMITIR_SIEMBRA_DESDE_WORKTREE PNMC_PERMITIR_SIEMBRA_DESDE_WORKTREE
adoptar_variable_heredada SIMUS_CHECK_TIMEOUT PNMC_CHECK_TIMEOUT
adoptar_variable_heredada SIMUS_SKIP_IPV6_CHECK PNMC_SKIP_IPV6_CHECK
