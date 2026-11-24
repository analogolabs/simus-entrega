#!/usr/bin/env bash
set -euo pipefail

# Reemplaza la regla transitoria de Azure por las IP de salida reales del App Service.
# Requiere az login y se ejecuta una vez despues de desplegar simus-demo.bicep.

grupo="${1:?Grupo de recursos requerido}"
sitio="${2:?Nombre del App Service requerido}"
servidor="${3:?Nombre del servidor SQL requerido}"

ips="$(az webapp show --resource-group "$grupo" --name "$sitio" --query outboundIpAddresses --output tsv)"
IFS=',' read -ra lista <<< "$ips"

for indice in "${!lista[@]}"; do
  ip="${lista[$indice]}"
  az sql server firewall-rule create \
    --resource-group "$grupo" \
    --server "$servidor" \
    --name "AppService-${indice}" \
    --start-ip-address "$ip" \
    --end-ip-address "$ip" \
    --output none
done

az sql server firewall-rule delete \
  --resource-group "$grupo" \
  --server "$servidor" \
  --name AzureServicesBootstrap \
  --yes \
  --output none

echo "Acceso SQL limitado a las IPs de salida de ${sitio}."
