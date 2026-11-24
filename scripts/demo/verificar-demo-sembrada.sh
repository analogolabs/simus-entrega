#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VERIFICA QUE LA DEMO SEMBRADA ESTÁ COMPLETA, consultando la API (y, en el modo integral, la base local en solo lectura).
# Falla (código 1) si falta algo.
#
#   ./scripts/demo/verificar-demo-sembrada.sh                      # API local en 8180 (SIMUS_LOCAL_API_PORT)
#   ./scripts/demo/verificar-demo-sembrada.sh http://127.0.0.1:8261
#
# DOS MODOS (SIMUS_VERIFICAR_MODO = integral | clasica; sin definir: «clasica» si SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1 y «integral» si no;
# lo fija reiniciar-demo.sh según la siembra que hizo):
#
#   INTEGRAL (la demo sembrada con `siembra-integral.sh completa`; 89 comprobaciones, 90 con Mailpit). Ver la función verificar_integral:
#   - ingreso real por la API de las seis cuentas de validación (@simus.test, clave `admin`) y de las tres @pnmc.local que se
#     conservan (admin, gestor, externo), con lo que cada cuenta debe ver;
#   - conteos mínimos de `dbo.DatosDeDemostracion` por nivel (0 a 3) y tipo (festivales, mercados, talleres, espacios, redes, organizaciones,
#     perfiles, eventos, noticias, archivos…), y la mezcla de procedencias;
#   - festivales N1 (ficha pública de cada uno, sus ediciones), mercados N1 y las listas públicas por tipo;
#   - noticias, agenda, organizaciones, directorio, Catálogo Editorial y mapa;
#   - agenda de citas de mercados (siembra/docs/agenda-de-citas.md): API pública, la organización (abierta, borrador y cerrada) y las vistas externas de cada
#     cuenta (artista aprobado, compradora con mesa, lista de espera, pendiente y persona nueva sin participación), la consola y el registro de procedencia;
#   - reclamaciones (consola, en varios estados, y las de la organización reclamante), coincidencias y propuestas en revisión;
#   - imágenes públicas (200 con ETag igual a la huella SHA-256 del cuerpo) y archivos de fichas sin publicar (404);
#   - catálogos intactos (frente a siembra/generador/catalogos-instantanea.json), cuentas de arranque, restricciones (DBCC CHECKCONSTRAINTS);
#   - el motor: verificador del motor masivo y verificación de multimedia del kit.
#
#   CLÁSICA (la demo sembrada con `sembrar-demo.sh`; 47 comprobaciones, 48 con Mailpit). Comprueba, módulo por módulo, lo que `sembrar-demo.sh` (sin argumentos) debe haber dejado:
#   - ingreso de las cuentas demo (clave `admin`): consola (admin y gestor) y las 8 externas;
#   - procesos de los 5 tipos, con al menos dos HISTÓRICOS sin responsable por tipo y la sede de todos;
#   - agenda de citas del Mercado del Valle: franjas, artistas, compradores con mesa, citas en varios estados;
#     y el rol de cada cuenta demo en ella;
#   - propuestas de cambio en revisión (consola) y en «Mi actividad y solicitudes» de la organización;
#   - directorio de personas (roles y servicios), perfil público enriquecido y fichas con foto;
#   - noticias, agenda, Catálogo Editorial, mapa, solicitudes de la consola.
#   - con SIMUS_VERIFICAR_MAILPIT=1 (lo pone reiniciar-demo.sh): que la bandeja Mailpit responde.
# Los mínimos son los de la siembra actual: si la siembra crece, se suben aquí. No escribe nada, no imprime claves,
# y no sirve contra producción (solo se conecta a la URL indicada, pensada para 127.0.0.1).
#
# - taxonomía de perfiles en tablas y roles jerárquicos: categorías con subcategorías, una categoría que
#     se elige a sí misma, personas con varios roles y lo que el filtro «Categoría de rol» del directorio encuentra.
# - siembra limpia de entrega (semilla `entrega`): Mercado y Festivales sin rótulos de prueba ni patrón repetido, noticias
#     sin «demostración», algo que atender para Lucía, pocas citas variadas para Valentina y una agenda que parte de hoy.
# ---------------------------------------------------------------------------
set -uo pipefail

API_BASE="${1:-http://127.0.0.1:${SIMUS_LOCAL_API_PORT:-8180}}"
A="${API_BASE%/}/api/v1"
CLAVE_DEMO="${SIMUS_DEMO_CLAVE:-admin}"
JARRAS="$(mktemp -d)"
trap 'rm -rf "$JARRAS"' EXIT

command -v python3 >/dev/null || { echo "[verificar] Falta python3." >&2; exit 2; }
if [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$API_BASE/health/ready" 2>/dev/null)" != "200" ]]; then
  echo "[verificar] La API no responde en $API_BASE (health/ready). Arráncala antes: ./scripts/local/dev-up.sh" >&2
  exit 2
fi

FALLOS=0
OK=0
OMITIDAS=0
PENDIENTES_DE_CLAVE=()   # cuentas de la consola que deben cambiar la clave en su primer ingreso
ok()   { OK=$((OK + 1)); printf '  ok     %s\n' "$1"; }
AVISOS=0
fallo() {
  if [[ -z "${MUESTRA:-}" ]]; then  # sin los datos públicos completos: solo la muestra versionada
    if [[ -f "${SIMUS_SIEMBRA_DATOS:-$RAIZ/tmp/siembra/datos}/festivales.json" ]]; then MUESTRA=0; else MUESTRA=1; fi
  fi
  if [[ "$MUESTRA" == 1 && "$1" =~ ^(conteos\ mínimos|publicado:|festivales\ N1\ publicados|Rock\ al\ Parque\ trae|ediciones\ de\ los\ procesos\ N1|festivales\ públicos|mercados\ públicos|festivales\ históricos\ reales|edición\ [0-9]+:\ los\ [0-9]+\ aliados) ]]; then
    AVISOS=$((AVISOS + 1)); printf '  AVISO  %s (mínimo pensado para los datos públicos completos; el repositorio trae solo la muestra)\n' "$1"; return
  fi
  FALLOS=$((FALLOS + 1)); printf '  FALTA  %s\n' "$1"
}
seccion() { printf '\n%s\n' "$1"; }

# json GET [jarra]: cuerpo (vacío si no es 200).
json() {
  local url="$1" jarra="${2:-}" args=(-s --max-time 20 -w '\n%{http_code}')
  [[ -n "$jarra" ]] && args+=(-b "$JARRAS/$jarra")
  local salida cuerpo codigo
  salida="$(curl "${args[@]}" "$url" 2>/dev/null)" || true
  codigo="${salida##*$'\n'}"; cuerpo="${salida%$'\n'*}"
  [[ "$codigo" == "200" ]] && printf '%s' "$cuerpo"
}

# evaluar "<descripción>" "<expresión Python sobre d>" [jarra] <url>: ok si la expresión es verdadera.
evaluar() {
  local descripcion="$1" expresion="$2" jarra="$3" url="$4" cuerpo
  if [[ " ${PENDIENTES_DE_CLAVE[*]:-} " == *" $jarra "* ]]; then
    OMITIDAS=$((OMITIDAS + 1)); printf '  OMITE  %s (%s debe cambiar su clave en el primer ingreso)\n' "$descripcion" "$jarra"; return
  fi
  cuerpo="$(json "$url" "$jarra")"
  if [[ -z "$cuerpo" ]]; then fallo "$descripcion (sin respuesta 200 de ${url#"$A"})"; return; fi
  if printf '%s' "$cuerpo" | python3 -I -c "
import sys, json
d = json.load(sys.stdin)
sys.exit(0 if ($expresion) else 1)" 2>/dev/null; then ok "$descripcion"; else fallo "$descripcion"; fi
}

# evaluar_roles "<descripción>" "<expresión Python sobre T (taxonomía) y PERSONAS (directorio)>": ok si es verdadera.
evaluar_roles() {
  local descripcion="$1" expresion="$2" t p
  t="$(json "$A/publico/taxonomia-de-perfiles")"; p="$(json "$A/publico/personas")"
  if [[ -z "$t" || -z "$p" ]]; then fallo "$descripcion (sin respuesta 200 de la taxonomía o del directorio)"; return; fi
  if SIMUS_T="$t" SIMUS_P="$p" python3 -I -c "
import os, json, sys
T = json.loads(os.environ['SIMUS_T']); PERSONAS = json.loads(os.environ['SIMUS_P'])
CAT = {s['codigo']: c['codigo'] for c in T['rolesPorCategoria'] for s in c['subcategorias']}
sys.exit(0 if ($expresion) else 1)" 2>/dev/null; then ok "$descripcion"; else fallo "$descripcion"; fi
}

# EL INGRESO EXTERNO TIENE UN CUPO DE 10 POR MINUTO Y POR IP (Program.cs, CreateExternalAuthRateLimitPartition) y aquí
# se entra con 8 cuentas externas: si el cupo está gastado (otra corrida reciente, otro guion) responde 429. No es un
# fallo de la demo, así que se espera a que se renueve la ventana y se reintenta antes de dar la cuenta por rota.
ingreso() { # ingreso <consola|externo> <correo>: guarda la cookie en una jarra con el nombre del correo
  local tipo="$1" correo="$2" ruta codigo intento
  ruta="externo/auth/login"; [[ "$tipo" == "consola" ]] && ruta="admin/auth/login"
  for intento in 1 2 3 4 5; do
    codigo="$(curl -s -o "$JARRAS/$correo.cuerpo" -w '%{http_code}' --max-time 20 -c "$JARRAS/$correo" -X POST "$A/$ruta" \
      -H 'Content-Type: application/json' -d "{\"email\":\"$correo\",\"password\":\"$CLAVE_DEMO\"}")"
    [[ "$codigo" != "429" ]] && break
    printf '  (cupo de ingresos agotado; espero 15 s y reintento %s/5)\n' "$intento"
    sleep 15
  done
  if [[ "$codigo" == "200" && "$tipo" == "consola" ]] && grep -qiE '"debeCambiarContrasena"[[:space:]]*:[[:space:]]*true' "$JARRAS/$correo.cuerpo" 2>/dev/null; then
    PENDIENTES_DE_CLAVE+=("$correo"); ok "ingreso $tipo: $correo (con cambio de clave obligatorio pendiente)"
  elif [[ "$codigo" == "200" ]]; then ok "ingreso $tipo: $correo"; else fallo "ingreso $tipo: $correo (HTTP $codigo)"; fi
}

verificar_clasica() {
  seccion "Cuentas demo"
  ingreso consola webmaster@simus.test
  ingreso consola gestor@simus.test
  ingreso externo externo@simus.test
  for c in lucia.ramirez@cantaclaro.test diana.zapata@bandasoriente.test camilo.rojas@llanoadentro.test \
    mariana.palacios@sonoracaribe.test andres.munoz@cantaclaro.test jose.caicedo@sonoracaribe.test valentina.ocampo@correo.test; do
    ingreso externo "$c"
  done
  evaluar "Lucía administra al menos una organización" "len(d['organizations']) >= 1" lucia.ramirez@cantaclaro.test "$A/externo/auth/me"
  evaluar "Camilo pertenece a dos organizaciones (cuenta con varias)" "len(d['organizations']) >= 2" camilo.rojas@llanoadentro.test "$A/externo/auth/me"
  evaluar "Valentina no tiene organización (espacio personal)" "len(d['organizations']) == 0" valentina.ocampo@correo.test "$A/externo/auth/me"

  seccion "Procesos de los cinco tipos (históricos y sede)"
  for par in "festivales:100:2" "mercados:4:2" "talleres:5:2" "espacios:5:2" "redes:5:2"; do
    IFS=: read -r tipo minimo historicos <<<"$par"
    evaluar "$tipo: al menos $minimo publicados, $historicos o más históricos sin responsable y todos con sede" \
      "d['total'] >= $minimo and sum(1 for x in d['items'] if x.get('esRegistroHistorico')) >= $historicos and all((x.get('sede') or x.get('territorioPrincipal')) for x in d['items'])" \
      "" "$A/publico/$tipo?limit=500"
  done

  seccion "Agenda de citas (Mercado del Valle)"
  evaluar "agenda pública de citas abierta" "len(d) >= 1 and d[0]['estado'] == 'abierta'" "" "$A/publico/agendas-de-citas"
  evaluar "la organización ve franjas, artistas, 3 compradores con mesa y citas en varios estados" \
    "len(d['franjas']) >= 20 and sum(1 for p in d['participantes'] if p['rol']=='artista') >= 4 and sum(1 for p in d['participantes'] if p['rol']=='comprador' and p.get('espacio')) >= 3 and len({c['estado'] for c in d['citas']}) >= 3" \
    lucia.ramirez@cantaclaro.test "$A/externo/organizaciones/32/agendas-de-citas/1"
  evaluar "Diana participa como compradora aprobada" "any(a['miRol']=='comprador' and a['miEstado']=='aprobado' for a in d)" diana.zapata@bandasoriente.test "$A/externo/agendas-de-citas"
  evaluar "Camilo participa como artista aprobado" "any(a['miRol']=='artista' and a['miEstado']=='aprobado' for a in d)" camilo.rojas@llanoadentro.test "$A/externo/agendas-de-citas"
  evaluar "Mariana está en lista de espera" "any(a['miEstado']=='lista_de_espera' for a in d)" mariana.palacios@sonoracaribe.test "$A/externo/agendas-de-citas"
  evaluar "la consola ve la agenda de citas" "len(d) >= 1" webmaster@simus.test "$A/institucional/agendas-de-citas"

  seccion "Propuestas y solicitudes"
  evaluar "propuestas de cambio de Festival en revisión (consola)" "len(d) >= 1" webmaster@simus.test "$A/institucional/propuestas-cambio-festival/en-revision"
  evaluar "la organización ve su propuesta entre sus solicitudes" "any(s.get('tipo')=='propuesta' for s in d)" lucia.ramirez@cantaclaro.test "$A/externo/organizaciones/32/solicitudes"
  evaluar "solicitudes de vinculación en la consola" "len(d['items']) >= 1" webmaster@simus.test "$A/admin/solicitudes-de-vinculacion"
  evaluar "organizaciones en la consola" "d['total'] >= 30" webmaster@simus.test "$A/admin/organizaciones"

  seccion "Personas, perfiles y directorio"
  evaluar "directorio de personas: 10 o más, con 9 roles y 8 servicios distintos" \
    "len(d) >= 10 and len({r for p in d for r in p['roles']}) >= 9 and len({s for p in d for s in p['servicios']}) >= 8" "" "$A/publico/personas"
  evaluar "las personas del directorio tienen municipio y al menos 4 llevan foto (las seis añadidas por DIR no)" "all(p.get('municipio') for p in d) and sum(1 for p in d if p.get('fotoUrl')) >= 4" "" "$A/publico/personas"
  evaluar "perfil público de Lucía existe y con enlaces" "d['existe'] and len(d['enlaces']) >= 1 and len(d['idsPracticas']) >= 1" lucia.ramirez@cantaclaro.test "$A/externo/cuenta/perfil-publico"
  evaluar "perfiles en la consola (moderación)" "len(d) >= 8" webmaster@simus.test "$A/admin/perfiles-publicos"

  seccion "Taxonomía de perfiles y roles jerárquicos"
  evaluar "la taxonomía trae servicios e instrumentos y roles en árbol: 4 o más categorías, 3 o más con subcategorías" \
    "len(d['servicios']) >= 8 and len(d['instrumentos']) >= 1 and len(d['rolesPorCategoria']) >= 4 and sum(1 for c in d['rolesPorCategoria'] if c['subcategorias']) >= 3" \
    "" "$A/publico/taxonomia-de-perfiles"
  evaluar "«Gestor(a) cultural» es categoría sin subcategorías y cada subcategoría apunta a su categoría (dos niveles)" \
    "any(c['codigo']=='gestor' and not c['subcategorias'] for c in d['rolesPorCategoria']) and all(s['padre']==c['codigo'] for c in d['rolesPorCategoria'] for s in c['subcategorias']) and sum(1 for r in d['roles'] if r.get('padre')) == sum(len(c['subcategorias']) for c in d['rolesPorCategoria'])" \
    "" "$A/publico/taxonomia-de-perfiles"
  evaluar_roles "hay perfiles con varios roles: uno con dos subcategorías de la misma categoría y otro con categorías distintas" \
    "any(len(p['roles']) >= 2 and len({CAT.get(r, r) for r in p['roles']}) == 1 for p in PERSONAS) and any(len({CAT.get(r, r) for r in p['roles']}) >= 2 for p in PERSONAS)"
  evaluar_roles "filtro «Categoría de rol» del directorio: cada categoría (con o sin subcategorías) encuentra al menos una persona" \
    "all(any(CAT.get(r, r) == c['codigo'] for p in PERSONAS for r in p['roles']) for c in T['rolesPorCategoria'])"

  seccion "Siembra limpia de entrega "
  evaluar "el Mercado Musical del Valle se llama así, sin sufijo, y ningún Mercado dice «demostración»" \
    "any(x['nombre'] == 'Mercado Musical del Valle' for x in d['items']) and not any('demostraci' in (x['nombre'] or '').lower() for x in d['items'])" \
    "" "$A/publico/mercados?limit=500"
  evaluar "Festivales sin rótulo de prueba: nombres casi todos distintos, 25 o más organizaciones responsables y sin los sitios del patrón del mapa" \
    "not any('demostraci' in ((x['nombre'] or '') + (x['descripcion'] or '')).lower() for x in d['items']) and len({x['nombre'] for x in d['items']}) >= 0.97 * len(d['items']) and len({x['organizacionResponsable'] for x in d['items']}) >= 25 and not any(('festival' in (x.get('sitioWeb') or '')) and (x.get('sitioWeb') or '')[8:].split('.')[0].replace('festival','').isdigit() for x in d['items'])" \
    "" "$A/publico/festivales?limit=500"
  evaluar "noticias sin el rótulo «demostración» ni en el cuerpo, la autoría o las etiquetas" \
    "not any('demostraci' in json.dumps([x['titulo'], x['resumen'], x['cuerpo'], x['autoriaNombre'], x['etiquetas']], ensure_ascii=False).lower() for x in d['items'])" \
    "" "$A/publico/noticias?tamano=100"
  evaluar "Lucía tiene algo que atender en su organización (ajustes pedidos de un Festival): el inicio no dice «nada pendiente»" \
    "any(s['espera'] == 'tu_accion' and s['tipo'] != 'cita' for s in d)" lucia.ramirez@cantaclaro.test "$A/externo/organizaciones/32/solicitudes"
  evaluar "Lucía tiene una invitación por aceptar en las solicitudes de su cuenta" \
    "any(s['tipo'] == 'invitacion' and s['espera'] == 'tu_accion' for s in d)" lucia.ramirez@cantaclaro.test "$A/externo/cuenta/solicitudes"
  evaluar "Valentina ve pocas citas y distintas: 6 o menos, una por responder, dos o más confirmadas y una rechazada (no seis tarjetas iguales)" \
    "len([s for s in d if s['tipo'] == 'cita']) <= 6 and sum(1 for s in d if s['tipo'] == 'cita' and s['estadoEtiqueta'] == 'Por responder') == 1 and sum(1 for s in d if s['tipo'] == 'cita' and s['estadoEtiqueta'] == 'Confirmada') >= 2 and sum(1 for s in d if s['tipo'] == 'cita' and s['estadoEtiqueta'] == 'Rechazada') >= 1" \
    valentina.ocampo@correo.test "$A/externo/cuenta/solicitudes"
  evaluar "la agenda parte de hoy: 100 o más eventos próximos (no solo pasados), con títulos casi todos distintos" \
    "d['total'] >= 100 and len({e['titulo'] for e in d['items']}) >= 0.9 * len(d['items'])" \
    "" "$A/publico/agenda?cuando=proximos&tamano=50"

  seccion "Contenidos y mapa"
  evaluar "noticias publicadas (10 o más)" "d['total'] >= 10" "" "$A/publico/noticias"
  evaluar "agenda cultural (100 o más eventos)" "d['total'] >= 100" "" "$A/publico/agenda"
  evaluar "Catálogo Editorial (100 o más fichas)" "d['total'] >= 100" "" "$A/publico/catalogo-editorial"
  evaluar "cartografía de departamentos del mapa" "d.get('type') == 'Topology'" "" "$A/mapa/cartografia/departamentos"

}

# ---------------------------------------------------------------------------------------------------------------------------------
# MODO INTEGRAL: la demo sembrada con scripts/demo/siembra-integral.sh. Lee la base local (solo SELECT y DBCC) además de la API.
# ---------------------------------------------------------------------------------------------------------------------------------
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Resultado de un bloque Python que imprime «ok|texto» o «fallo|texto» por comprobación.
volcar_resultados() {
  local linea
  while IFS= read -r linea; do
    case "$linea" in
      ok\|*) ok "${linea#ok|}" ;;
      fallo\|*) fallo "${linea#fallo|}" ;;
    esac
  done
}

verificar_integral() {
  ROOT_DIR="$RAIZ"
  source "$RAIZ/scripts/local/load-local-env.sh"
  # En un árbol enlazado el .env vive en el repositorio principal (fuera de git); la clave se lee sin imprimirla.
  if [[ -z "${SIMUS_LOCAL_SA_PASSWORD:-}" ]]; then
    local principal; principal="$(git -C "$RAIZ" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's#/\.git$##')"
    if [[ -n "$principal" && -f "$principal/.env" ]]; then
      SIMUS_LOCAL_SA_PASSWORD="$(grep -E '^SIMUS_LOCAL_SA_PASSWORD=' "$principal/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"; export SIMUS_LOCAL_SA_PASSWORD
    fi
  fi
  source "$RAIZ/scripts/local/sql-local-comun.sh"

  seccion "Cuentas de validación y de arranque (ingreso real por la API)"
  for c in camila.restrepo@simus.test editor@simus.test reclamante@simus.test nuevo@simus.test; do ingreso externo "$c"; done
  for c in webmaster@simus.test gestor@simus.test; do ingreso consola "$c"; done
  ingreso externo externo@simus.test
  evaluar "Camila (externa) administra o edita varias organizaciones (tres o más, con ambos roles)" \
    "len(d['organizations']) >= 3 and {o['role'] for o in d['organizations']} >= {'administrador','editor'}" camila.restrepo@simus.test "$A/externo/auth/me"
  evaluar "Camila (externa) tiene el perfil público cargado: enlaces, prácticas y foto" \
    "d['existe'] and len(d['enlaces']) >= 2 and len(d['idsPracticas']) >= 1 and bool(d.get('fotoUrl'))" camila.restrepo@simus.test "$A/externo/cuenta/perfil-publico"
  evaluar "Camila (externa) tiene solicitudes de su cuenta de varios tipos" "len(d) >= 5 and len({s['tipo'] for s in d}) >= 2" camila.restrepo@simus.test "$A/externo/cuenta/solicitudes"
  evaluar "la persona nueva no tiene organización (recorrido desde cero)" "len(d['organizations']) == 0" nuevo@simus.test "$A/externo/auth/me"
  evaluar "la persona reclamante administra la organización que reclama" "len(d['organizations']) >= 1" reclamante@simus.test "$A/externo/auth/me"
  evaluar "la administración ve todas las organizaciones de la siembra (190 o más)" "d['total'] >= 190" webmaster@simus.test "$A/admin/organizaciones"

  # Una sola consulta a la base trae lo que hace falta (cada llamada puede costar un contenedor de herramientas).
  local entradas="$JARRAS/entradas.tsv" t=$'\t'
  seccion "Base de la demo (DatosDeDemostracion, catálogos y restricciones)"
  # Las consultas largas viajan como FICHERO (sql_fichero): `sqlcmd -Q` corrompe las de más de ~1000 caracteres en el contenedor de
  # herramientas. Cada una anexa a las entradas solo las líneas con tabulador (sin el relleno de espacios de la columna).
  : > "$entradas"
  sql_a_entradas() {
    local guion salida rc; guion="$(mktemp -t simus-verificar-XXXXXX.sql)"
    { echo "SET NOCOUNT ON;"; echo "$1"; } > "$guion"
    salida="$(sql_fichero "$guion" 2>/dev/null)"; rc=$?
    rm -f "$guion"; [[ $rc -eq 0 ]] || return 1
    printf '%s\n' "$salida" | tr -d '\r' | grep -F "$t" | sed 's/ *$//' >> "$entradas"; return 0
  }
  if ! sql_a_entradas "
SELECT N'conteo${t}' + CAST(Nivel AS nvarchar(2)) + N'${t}' + Tabla + N'${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.DatosDeDemostracion GROUP BY Nivel, Tabla
UNION ALL SELECT N'procedencia${t}' + CAST(Nivel AS nvarchar(2)) + N'${t}' + Procedencia + N'${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.DatosDeDemostracion GROUP BY Nivel, Procedencia
UNION ALL SELECT N'festival_n1${t}' + d.ClaveEstable + N'${t}' + d.IdRegistro + N'${t}' + f.EstadoRegistro FROM dbo.DatosDeDemostracion d JOIN dbo.Festivales f ON CAST(f.IdFestival AS nvarchar(20)) = d.IdRegistro WHERE d.ClaveEstable LIKE N'n1.festival.%'
UNION ALL SELECT N'mercado_n1${t}' + d.ClaveEstable + N'${t}' + d.IdRegistro + N'${t}' + m.EstadoRegistro FROM dbo.DatosDeDemostracion d JOIN dbo.Mercados m ON CAST(m.IdMercado AS nvarchar(20)) = d.IdRegistro WHERE d.ClaveEstable LIKE N'n1.mercado.%'
UNION ALL SELECT N'edicion_n1${t}n1${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.DatosDeDemostracion WHERE ClaveEstable LIKE N'n1.edicion.%'
UNION ALL SELECT N'rock${t}' + IdRegistro FROM dbo.DatosDeDemostracion WHERE ClaveEstable = N'n1.festival.rock-al-parque'
UNION ALL SELECT N'total${t}Archivos${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Archivos
UNION ALL SELECT N'total${t}FestivalesPublicados${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Festivales WHERE EstadoRegistro = N'publicado'
UNION ALL SELECT N'total${t}NoticiasPublicadas${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Noticias WHERE Estado = N'publicado'
UNION ALL SELECT N'total${t}EventosPublicados${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.EventosAgenda WHERE Estado = N'publicado'
UNION ALL SELECT N'total${t}FilasFueraDeNivel${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.DatosDeDemostracion WHERE Nivel NOT BETWEEN 0 AND 3
UNION ALL SELECT N'total${t}ArranquePnmc${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Usuarios WHERE CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test')
UNION ALL SELECT N'total${t}EntidadInstitucional${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Entidades WHERE EsInstitucional = 1
UNION ALL SELECT N'total${t}UsuarioSistema${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local'
" || ! sql_a_entradas "
SELECT N'catalogo${t}divipola${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Divipola
UNION ALL SELECT N'catalogo${t}practicas${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.PracticasMusicales
UNION ALL SELECT N'catalogo${t}territorios${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.TerritoriosSonoros
UNION ALL SELECT N'catalogo${t}periodicidades${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Periodicidades
UNION ALL SELECT N'catalogo${t}tipologias_festival${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.TipologiasFestival
UNION ALL SELECT N'catalogo${t}fuentes_financiacion${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.FuentesFinanciacion
UNION ALL SELECT N'catalogo${t}tipos_organizador${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.TiposOrganizador
UNION ALL SELECT N'catalogo${t}alcances_mercado${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.AlcancesMercado
UNION ALL SELECT N'catalogo${t}modalidades_mercado${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.ModalidadesMercado
UNION ALL SELECT N'catalogo${t}categorias${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Categorias
UNION ALL SELECT N'catalogo${t}estados_contenido${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.EstadosContenido
UNION ALL SELECT N'catalogo${t}tipos_documento${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.TiposDocumento
UNION ALL SELECT N'catalogo${t}roles${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Roles
UNION ALL SELECT N'catalogo${t}permisos${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.Permisos
UNION ALL SELECT N'catalogo${t}publicaciones_editoriales${t}' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.PublicacionesEditoriales
" || ! sql_a_entradas "
SELECT N'img_publica${t}' + CAST(ArchivoId AS nvarchar(20)) FROM (
  SELECT TOP 6 a.ArchivoId FROM dbo.ArchivosDeRegistro a JOIN dbo.Festivales f ON CAST(f.IdFestival AS nvarchar(120)) = a.RegistroId
  WHERE a.ModuloId = N'festivales' AND a.ArchivoId IS NOT NULL AND f.EstadoRegistro = N'publicado' AND a.RolArchivo IN (N'portada', N'logo') ORDER BY a.ArchivoId) x
UNION ALL SELECT N'img_publica${t}' + CAST(ArchivoFotoId AS nvarchar(20)) FROM dbo.PerfilesPublicos WHERE ArchivoFotoId IS NOT NULL AND IdUsuario = (SELECT CAST(IdRegistro AS int) FROM dbo.DatosDeDemostracion WHERE Alias = N'persona.nubia-palacios')
UNION ALL SELECT N'img_publica${t}' + CAST(ArchivoFotoId AS nvarchar(20)) FROM dbo.Entidades WHERE ArchivoFotoId IS NOT NULL AND IdEntidad = (SELECT CAST(IdRegistro AS int) FROM dbo.DatosDeDemostracion WHERE Alias = N'org.corp-cabildo-sonoro-del-atrato')
UNION ALL SELECT N'img_publica${t}' + CAST(ArchivoId AS nvarchar(20)) FROM (SELECT TOP 3 ArchivoId FROM dbo.NoticiasArchivos WHERE NoticiaId IN (SELECT IdNoticia FROM dbo.Noticias WHERE Estado = N'publicado') ORDER BY NoticiaId DESC) y
UNION ALL SELECT N'img_borrador${t}' + CAST(ArchivoId AS nvarchar(20)) FROM (
  SELECT TOP 2 a.ArchivoId FROM dbo.ArchivosDeRegistro a JOIN dbo.Festivales f ON CAST(f.IdFestival AS nvarchar(120)) = a.RegistroId
  WHERE a.ModuloId = N'festivales' AND a.ArchivoId IS NOT NULL AND f.EstadoRegistro = N'borrador' AND NOT EXISTS (SELECT 1 FROM dbo.ArchivosDeRegistro b JOIN dbo.Festivales g ON CAST(g.IdFestival AS nvarchar(120)) = b.RegistroId WHERE b.ArchivoId = a.ArchivoId AND b.ModuloId = N'festivales' AND g.EstadoRegistro = N'publicado') ORDER BY a.ArchivoId) z
"; then
    fallo "no pude consultar la base $SQL_DB_NAME (¿contenedor SQL arriba y SIMUS_LOCAL_DB_NAME correcto?)"
  fi
  if [[ ! -s "$entradas" ]]; then
    fallo "dbo.DatosDeDemostracion no tiene filas o no existe en $SQL_DB_NAME (¿se corrió siembra-integral.sh completa --si?)"
  fi
  local dbcc; dbcc="$(sql_consulta "DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, NO_INFOMSGS" 2>&1 | tr -d '[:space:]')"
  if [[ -z "$dbcc" ]]; then ok "DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS: sin restricciones rotas"; else fallo "DBCC CHECKCONSTRAINTS encontró restricciones rotas (correrlo a mano para el detalle)"; fi

  resultado="$(SIMUS_ENTRADAS="$entradas" SIMUS_CATALOGOS="$RAIZ/siembra/generador/catalogos-instantanea.json" python3 -I - <<'PY'
import os, json, collections
conteo = collections.defaultdict(dict); proc = collections.defaultdict(dict); total = {}; cat = {}
for l in open(os.environ["SIMUS_ENTRADAS"], encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if p[0] == "conteo": conteo[int(p[1])][p[2]] = int(p[3])
    elif p[0] == "procedencia": proc[int(p[1])][p[2]] = int(p[3])
    elif p[0] == "total": total[p[1]] = int(p[2])
    elif p[0] == "catalogo": cat[p[1]] = int(p[2])
# Mínimos por nivel y tabla: ~90 % de lo que deja la siembra integral (semilla 20261121); si la siembra crece, se suben aquí.
MIN = {
  0: {"Usuarios": 6, "Entidades": 5, "Festivales": 9, "Mercados": 6, "Talleres": 9, "Espacios": 9, "Redes": 6, "EdicionesFestival": 12, "EdicionesMercado": 6,
      "EventosAgenda": 6, "PropuestasDeCambio": 5, "ReclamacionesAdministracion": 7, "InvitacionesDeOrganizacion": 4, "Notificaciones": 12},
  1: {"Usuarios": 17, "Entidades": 23, "PerfilesPublicos": 17, "Festivales": 19, "EdicionesFestival": 90, "Mercados": 7, "EdicionesMercado": 16,
      "EventosAgenda": 38, "Noticias": 29, "PublicacionesEditoriales": 8, "ProyectosTransversales": 4, "AutorizacionesDatos": 50},
  2: {"Usuarios": 80, "Entidades": 48, "PerfilesPublicos": 80, "Festivales": 38, "EdicionesFestival": 120, "Mercados": 8, "EdicionesMercado": 18,
      "Talleres": 10, "Espacios": 10, "Redes": 7, "EventosAgenda": 65},
  3: {"Usuarios": 180, "Entidades": 108, "PerfilesPublicos": 170, "Festivales": 120, "EdicionesFestival": 150, "Mercados": 17, "Talleres": 27,
      "Espacios": 30, "Redes": 22, "EventosAgenda": 65, "Archivos": 440},
}
NOMBRES = {0: "cuentas de validación (nivel 0)", 1: "audiovisual (nivel 1)", 2: "exploración (nivel 2)", 3: "cobertura (nivel 3)"}
for nivel, mins in MIN.items():
    falta = [f"{t} {conteo[nivel].get(t, 0)} < {m}" for t, m in mins.items() if conteo[nivel].get(t, 0) < m]
    resumen = ", ".join(f"{t} {conteo[nivel].get(t, 0)}" for t in ("Festivales", "Mercados", "Entidades", "EventosAgenda") if t in mins)
    print(("fallo|" if falta else "ok|") + f"conteos mínimos de {NOMBRES[nivel]}: " + ("faltan " + "; ".join(falta) if falta else f"{len(mins)} tablas en regla ({resumen})"))
procedencias = sorted({p for n in proc.values() for p in n})
bien = proc[1].get("publico", 0) > 0 and proc[1].get("sintetico", 0) > 0 and proc[0].get("sintetico", 0) > 0 and proc[2].get("sintetico", 0) > 0 and proc[3].get("publico", 0) > 0
print(("ok|" if bien else "fallo|") + f"procedencia registrada en cada nivel: público y sintético en el 1, sintético en 0 y 2, público en el 3 ({', '.join(procedencias)})")
print(("ok|" if total.get("FilasFueraDeNivel", 1) == 0 else "fallo|") + "todas las filas de DatosDeDemostracion están en un nivel de 0 a 3")
print(("ok|" if total.get("Archivos", 0) >= 450 else "fallo|") + f"banco de archivos con imágenes sembradas (450 o más; hay {total.get('Archivos', 0)})")
print(("ok|" if total.get("FestivalesPublicados", 0) >= 130 and total.get("NoticiasPublicadas", 0) >= 25 and total.get("EventosPublicados", 0) >= 140 else "fallo|")
      + f"publicado: {total.get('FestivalesPublicados', 0)} festivales (130+), {total.get('NoticiasPublicadas', 0)} noticias (25+), {total.get('EventosPublicados', 0)} eventos (140+)")
snap = json.load(open(os.environ["SIMUS_CATALOGOS"], encoding="utf-8"))
falta = [f"{k} {cat.get(k, 0)} < {len(v)}" for k, v in snap.items() if cat.get(k, 0) < len(v)]
print(("fallo|" if falta else "ok|") + "catálogos intactos frente a la instantánea del kit: " + ("faltan " + "; ".join(falta) if falta else f"{len(snap)} catálogos completos (DIVIPOLA {cat.get('divipola')}, categorías {cat.get('categorias')})"))
print(("ok|" if cat.get("roles", 0) >= 3 and cat.get("permisos", 0) >= 10 and cat.get("publicaciones_editoriales", 0) >= 100 else "fallo|")
      + f"roles ({cat.get('roles')}), permisos ({cat.get('permisos')}) y Catálogo Editorial ({cat.get('publicaciones_editoriales')} publicaciones) conservados")
print(("ok|" if total.get("ArranquePnmc", 0) >= 5 and total.get("EntidadInstitucional", 0) >= 1 and total.get("UsuarioSistema", 0) == 1 else "fallo|")
      + f"cuentas de arranque y del sistema ({total.get('ArranquePnmc')}), entidad institucional y usuario del sistema conservados")
PY
)"; volcar_resultados <<<"$resultado"

  seccion "Festivales y mercados N1, ediciones y listas públicas"
  resultado="$(SIMUS_ENTRADAS="$entradas" SIMUS_API="$A" python3 -I - <<'PY'
import os, json, urllib.request, urllib.error
A = os.environ["SIMUS_API"]
def get(u):
    try:
        r = urllib.request.urlopen(A + u, timeout=60); return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, b""
    except Exception: return 0, b""
fest, merc, rock, ed = {}, {}, None, 0
for l in open(os.environ["SIMUS_ENTRADAS"], encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if p[0] == "festival_n1": fest[p[1]] = (p[2], p[3])
    elif p[0] == "mercado_n1": merc[p[1]] = (p[2], p[3])
    elif p[0] == "rock": rock = p[1]
    elif p[0] == "edicion_n1": ed = int(p[2])
def revisar(nombre, procesos, ruta, publicados_min, estados_min):
    publicados = {k: i for k, (i, e) in procesos.items() if e == "publicado"}
    estados = {e for _, e in procesos.values()}
    malos = [k for k, i in publicados.items() if get(f"/publico/{ruta}/{i}")[0] != 200]
    no_publicos = [k for k, (i, e) in procesos.items() if e != "publicado" and get(f"/publico/{ruta}/{i}")[0] == 200]
    print(("ok|" if len(publicados) >= publicados_min and not malos else "fallo|") + f"{nombre} N1 publicados: {len(publicados)} de {len(procesos)} ({publicados_min} o más) y cada ficha pública responde 200" + (f"; fallan {malos[:3]}" if malos else ""))
    print(("ok|" if len(estados) >= estados_min and not no_publicos else "fallo|") + f"{nombre} N1 en {len(estados)} estados administrativos ({estados_min} o más: {', '.join(sorted(estados))}); los no publicados no son públicos" + (f"; públicos sin estar publicados: {no_publicos[:3]}" if no_publicos else ""))
revisar("festivales", fest, "festivales", 11, 4)
revisar("mercados", merc, "mercados", 5, 3)
n = 0
if rock:
    c, cuerpo = get(f"/publico/festivales/{rock}/ediciones")
    d = json.loads(cuerpo) if c == 200 else []
    n = len(d if isinstance(d, list) else d.get("items", d.get("ediciones", [])))
print(("ok|" if n >= 20 else "fallo|") + f"Rock al Parque trae su historia: {n} ediciones públicas (20 o más)")
print(("ok|" if ed >= 110 else "fallo|") + f"ediciones de los procesos N1 sembradas: {ed} (110 o más)")
PY
)"; volcar_resultados <<<"$resultado"
  for par in "festivales:130" "mercados:25" "talleres:20" "espacios:20" "redes:18"; do
    IFS=: read -r tipo minimo <<<"$par"
    evaluar "$tipo públicos: $minimo o más y todos con sede" \
      "d['total'] >= $minimo and all((x.get('sede') or x.get('territorioPrincipal')) for x in d['items'])" "" "$A/publico/$tipo?limit=500"
  done
  evaluar "festivales históricos reales (administrados por la entidad institucional) conviven con los sintéticos: 40 o más históricos" \
    "sum(1 for x in d['items'] if x.get('esRegistroHistorico')) >= 40" "" "$A/publico/festivales?limit=500"

  seccion "Contenidos, organizaciones, directorio y mapa"
  evaluar "noticias publicadas (25 o más), sin «demostración» en título, resumen, cuerpo, autoría ni etiquetas" \
    "d['total'] >= 25 and not any('demostraci' in json.dumps([x['titulo'], x['resumen'], x['cuerpo'], x['autoriaNombre'], x['etiquetas']], ensure_ascii=False).lower() for x in d['items'])" \
    "" "$A/publico/noticias?tamano=100"
  evaluar "agenda cultural completa (140 o más eventos entre próximos y pasados)" "d['total'] >= 140" "" "$A/publico/agenda?cuando=todos&tamano=5"
  evaluar "agenda con eventos próximos (25 o más) y títulos casi todos distintos" \
    "d['total'] >= 25 and len({e['titulo'] for e in d['items']}) >= 0.9 * len(d['items'])" "" "$A/publico/agenda?cuando=proximos&tamano=50"
  evaluar "festivales sin el rótulo «demostración» ni «ficticio» en nombre ni descripción" \
    "not any(w in ((x['nombre'] or '') + (x['descripcion'] or '')).lower() for x in d['items'] for w in ('demostraci', 'ficticio'))" "" "$A/publico/festivales?limit=500"
  evaluar "directorio público de personas: 200 o más, con municipio y con foto en buena parte" \
    "len(d) >= 200 and sum(1 for p in d if p.get('municipio')) >= 0.9 * len(d) and sum(1 for p in d if p.get('fotoUrl')) >= 0.3 * len(d)" "" "$A/publico/personas"
  evaluar "taxonomía de perfiles intacta (servicios, instrumentos y roles en árbol)" \
    "len(d['servicios']) >= 8 and len(d['instrumentos']) >= 1 and len(d['rolesPorCategoria']) >= 4" "" "$A/publico/taxonomia-de-perfiles"
  evaluar "Catálogo Editorial (100 o más fichas)" "d['total'] >= 100" "" "$A/publico/catalogo-editorial"
  evaluar "cartografía de departamentos del mapa" "d.get('type') == 'Topology'" "" "$A/mapa/cartografia/departamentos"
  evaluar "perfiles públicos en la consola (moderación): 100 o más" "len(d) >= 100" webmaster@simus.test "$A/admin/perfiles-publicos"

  seccion "Reclamaciones, coincidencias y propuestas"
  evaluar "la consola ve las reclamaciones de administración (7 o más, en 4 o más estados)" "len(d) >= 7 and len({r['estado'] for r in d}) >= 4" webmaster@simus.test "$A/institucional/reclamaciones-administracion"
  evaluar "la organización reclamante ve su reclamación con registro y estado" "len(d) >= 1 and all(r.get('registroNombre') and r.get('estado') for r in d)" reclamante@simus.test "$A/externo/organizaciones/16/reclamaciones-administracion"
  evaluar "coincidencias de festival por nombre (Salsa al Parque)" "any(x['nombre'] == 'Salsa al Parque' for x in d)" webmaster@simus.test "$A/admin/festivales/coincidencias?nombre=Salsa+al+Parque"
  evaluar "coincidencias de festival por nombre (Rock al Parque)" "len(d) >= 1" webmaster@simus.test "$A/admin/festivales/coincidencias?nombre=Rock+al+Parque"
  evaluar "propuestas de cambio de Festival en revisión (consola)" "len(d) >= 1" webmaster@simus.test "$A/institucional/propuestas-cambio-festival/en-revision"
  evaluar "solicitudes de vinculación en la consola" "len(d['items']) >= 1" webmaster@simus.test "$A/admin/solicitudes-de-vinculacion"

  seccion "Agenda de citas de mercados (organizar y participar)"
  for c in eliecer.rios@simus.test margarita.buelvas@simus.test olga.mejia@simus.test tatiana.cardozo@simus.test; do ingreso externo "$c"; done
  local org_citas ag_abierta ag_borrador ag_cerrada
  org_citas="$(json "$A/externo/auth/me" camila.restrepo@simus.test | python3 -I -c "
import sys, json
d = json.load(sys.stdin)
print(next((o['id'] for o in d['organizations'] if o['name'] == 'Corporación Sonora Andina'), ''))" 2>/dev/null)"
  ag_abierta="$(json "$A/publico/agendas-de-citas" | python3 -I -c "
import sys, json
print(next((a['agendaId'] for a in json.load(sys.stdin) if a['agendaNombre'] == 'Rueda de citas con programadores y sellos'), ''))" 2>/dev/null)"
  ag_borrador="$(json "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas" camila.restrepo@simus.test | python3 -I -c "
import sys, json
print(next((a['id'] for e in json.load(sys.stdin) for a in (e.get('agendas') or []) if a['estado'] == 'borrador'), ''))" 2>/dev/null)"
  ag_cerrada="$(json "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas" camila.restrepo@simus.test | python3 -I -c "
import sys, json
print(next((a['id'] for e in json.load(sys.stdin) for a in (e.get('agendas') or []) if a['estado'] == 'cerrada'), ''))" 2>/dev/null)"
  evaluar "API pública: la agenda abierta de la Rueda de citas está listada (cupo y artistas aprobados) y solo se listan agendas abiertas o en curso" \
    "any(a['estado'] == 'abierta' and a['cupoArtistas'] >= 4 and a['artistasAprobados'] >= 4 and a['aprobacionDeArtistas'] == 'aceptacion' for a in d) and all(a['estado'] in ('abierta', 'en_curso') for a in d)" "" "$A/publico/agendas-de-citas"
  evaluar "organizando: Camila ve en su organización las tres agendas (abierta, borrador y cerrada) de las ediciones del Mercado publicado" \
    "{a['estado'] for e in d for a in (e.get('agendas') or [])} >= {'abierta', 'borrador', 'cerrada'}" camila.restrepo@simus.test "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas"
  evaluar "organizando: la agenda abierta trae 20 o más franjas, 4 o más artistas aprobados (y uno pendiente, dos en lista de espera y uno rechazado), 4 compradores con mesa y citas en 5 estados" \
    "len(d['franjas']) >= 20 and sum(1 for p in d['participantes'] if p['rol'] == 'artista' and p['estado'] == 'aprobado') >= 4 and {p['estado'] for p in d['participantes']} >= {'aprobado', 'pendiente', 'lista_de_espera', 'rechazado'} and sum(1 for p in d['participantes'] if p['rol'] == 'comprador' and p.get('espacio')) >= 4 and {c['estado'] for c in d['citas']} >= {'solicitada', 'confirmada', 'rechazada', 'cancelada', 'vencida'}" \
    camila.restrepo@simus.test "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas/${ag_abierta:-0}"
  evaluar "organizando: la agenda en borrador está recién creada (configurada, sin franjas ni participantes) para organizar desde cero" \
    "d['agenda']['estado'] == 'borrador' and len(d['franjas']) == 0 and len(d['participantes']) == 0 and len(d['citas']) == 0" \
    camila.restrepo@simus.test "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas/${ag_borrador:-0}"
  evaluar "organizando: la agenda cerrada conserva sus franjas, participantes y citas ya ocurridas" \
    "d['agenda']['estado'] == 'cerrada' and len(d['franjas']) >= 16 and len(d['citas']) >= 12 and 'confirmada' in {c['estado'] for c in d['citas']}" \
    camila.restrepo@simus.test "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas/${ag_cerrada:-0}"
  evaluar "organizando: la editora de la organización ve también la agenda abierta" "len(d['participantes']) >= 10" editor@simus.test "$A/externo/organizaciones/${org_citas:-0}/agendas-de-citas/${ag_abierta:-0}"
  evaluar "artista (Eliécer): aprobado en la abierta y en la cerrada" \
    "sum(1 for a in d if a['miRol'] == 'artista' and a['miEstado'] == 'aprobado') >= 2" eliecer.rios@simus.test "$A/externo/agendas-de-citas"
  evaluar "artista (Eliécer): ve citas confirmadas y solicitudes por responder en la agenda abierta" \
    "d['miParticipacion']['rol'] == 'artista' and {c['estado'] for c in d['citas']} >= {'solicitada', 'confirmada', 'rechazada'}" eliecer.rios@simus.test "$A/externo/agendas-de-citas/${ag_abierta:-0}"
  evaluar "compradora (Margarita): aprobada con Mesa 1 en la agenda abierta" \
    "d['miParticipacion']['rol'] == 'comprador' and d['miParticipacion']['estado'] == 'aprobado' and d['miParticipacion']['espacio'] == 'Mesa 1' and d['puedoPedirCitas']" margarita.buelvas@simus.test "$A/externo/agendas-de-citas/${ag_abierta:-0}"
  evaluar "artista en lista de espera (Olga): lugar 1 en la agenda abierta" \
    "d['miParticipacion']['estado'] == 'lista_de_espera' and d['posicionEnLaLista'] == 1" olga.mejia@simus.test "$A/externo/agendas-de-citas/${ag_abierta:-0}"
  evaluar "artista con inscripción pendiente (Tatiana): espera la decisión de la organización" \
    "d['miParticipacion']['estado'] == 'pendiente'" tatiana.cardozo@simus.test "$A/externo/agendas-de-citas/${ag_abierta:-0}"
  evaluar "persona nueva: no participa en ninguna agenda y puede inscribirse en la abierta" \
    "d['miParticipacion'] is None and d['puedoInscribirme']" nuevo@simus.test "$A/externo/agendas-de-citas/${ag_abierta:-0}"
  evaluar "la consola ve las tres agendas de citas" "len(d) >= 3" webmaster@simus.test "$A/institucional/agendas-de-citas"
  local filas_citas; filas_citas="$(sql_consulta "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.DatosDeDemostracion WHERE Lote = N'n1-agenda-de-citas' AND Nivel = 1 AND Procedencia = N'sintetico'" 2>/dev/null | tr -dc '0-9')"
  if [[ "${filas_citas:-0}" -ge 120 ]]; then ok "agenda de citas registrada como demostración (lote n1-agenda-de-citas, nivel 1, sintético): $filas_citas filas"; else fallo "agenda de citas registrada como demostración: ${filas_citas:-0} filas (120 o más)"; fi

  seccion "Archivos e imágenes públicas"
  resultado="$(SIMUS_ENTRADAS="$entradas" SIMUS_API="$A" python3 -I - <<'PY'
import os, hashlib, urllib.request, urllib.error
A = os.environ["SIMUS_API"]
def get(u):
    try:
        r = urllib.request.urlopen(A + u, timeout=60); return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e: return e.code, b"", dict(e.headers)
    except Exception: return 0, b"", {}
pub, bor = [], []
for l in open(os.environ["SIMUS_ENTRADAS"], encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if p[0] == "img_publica": pub.append(p[1])
    elif p[0] == "img_borrador": bor.append(p[1])
pub = sorted(set(pub), key=int)
malas, sin_etag = [], []
for i in pub:
    c, cuerpo, h = get(f"/publico/archivos/{i}")
    etag = (h.get("ETag") or h.get("Etag") or "").strip('"')
    if c != 200 or not cuerpo: malas.append(f"{i}:{c}")
    elif etag != hashlib.sha256(cuerpo).hexdigest(): sin_etag.append(i)
print(("ok|" if len(pub) >= 8 and not malas else "fallo|") + f"imágenes públicas (festivales, persona, organización, noticias): {len(pub)} probadas (8 o más), todas responden 200 con cuerpo" + (f"; fallan {malas[:4]}" if malas else ""))
print(("ok|" if pub and not sin_etag else "fallo|") + "ETag de cada imagen pública igual a la huella SHA-256 de su cuerpo" + (f"; difieren {sin_etag[:4]}" if sin_etag else ""))
noes = [i for i in bor if get(f"/publico/archivos/{i}")[0] != 404]
print(("ok|" if bor and not noes else "fallo|") + f"archivos de fichas sin publicar no son públicos (404): {len(bor)} probados" + (f"; responden distinto de 404: {noes}" if noes else ""))
PY
)"; volcar_resultados <<<"$resultado"

  seccion "Celebra la música: ediciones publicadas 2025 y 2026 (API pública)"
  resultado="$(SIMUS_API="$A" python3 -I - <<'PY'
import os, json, urllib.request, urllib.error
A = os.environ["SIMUS_API"]
def get(u):
    try:
        r = urllib.request.urlopen(A + u, timeout=60); return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e: return e.code, b"", {}
    except Exception: return 0, b"", {}
def js(u):
    c, cuerpo, _ = get(u)
    return json.loads(cuerpo) if c == 200 and cuerpo else None
def imagen_ok(url):
    c, cuerpo, h = get(url.replace("/api/v1", "", 1) if url.startswith("/api/v1") else url)
    return c == 200 and bool(cuerpo) and (h.get("Content-Type", "").startswith("image/"))
def norm(t): return t.strip().lower()
lista = js("/publico/celebra-la-musica/ediciones")
items = (lista or {}).get("items", [])
por_anio = {x["anio"]: x for x in items}
print(("ok|" if {2025, 2026} <= set(por_anio) and all(x["publicada"] for x in items) and sum(1 for x in items if x["actual"]) == 1 and por_anio.get(2026, {}).get("actual") else "fallo|")
      + f"la API pública lista las ediciones publicadas 2025 y 2026 (selector de ediciones), con la 2026 como vigente: {sorted(por_anio)}")
print(("ok|" if get("/publico/celebra-la-musica/ediciones/2030")[0] == 404 else "fallo|") + "una edición que no existe responde 404 (la página muestra «Esta edición no está disponible» solo en ese caso)")
mins = {2025: (10, 2), 2026: (12, 2)}
for anio in (2025, 2026):
    e = js(f"/publico/celebra-la-musica/ediciones/{anio}")
    if not e:
        print(f"fallo|edición {anio}: la API pública no la sirve"); continue
    colores = all(len(e.get(k) or "") == 7 for k in ("colorPrincipal", "colorSecundario")) and e["colorPrincipal"] != e["colorSecundario"]
    textos = len(e.get("resumen") or "") >= 80 and len(e.get("presentacion") or "") >= 400 and e.get("fechaInicio") and e.get("fechaFin")
    cifras = sum(1 for k in ("actividades", "municipios", "departamentos", "organizaciones", "musicos") if e.get(k) is not None)
    print(("ok|" if colores and textos and cifras >= 3 and imagen_ok(e.get("imagenPortadaUrl") or "") else "fallo|")
          + f"edición {anio}: colores, fechas, resumen, presentación, {cifras} cifras y portada que se descarga como imagen")
    cats, preg, gal = e["categorias"], e["preguntas"], e["galeria"]
    malas = [g["url"] for g in gal if not imagen_ok(g["url"])]
    print(("ok|" if len(cats) >= 3 and len(preg) >= 2 and len(gal) >= 6 and not malas and all(g["textoAlternativo"] and g["credito"] for g in gal) else "fallo|")
          + f"edición {anio}: {len(cats)} categorías, {len(preg)} preguntas y {len(gal)} imágenes de galería con alternativa y crédito, todas descargables" + (f"; fallan {malas[:2]}" if malas else ""))
    logos = [r for r in e["recursos"] if norm(r["grupo"]) == "aliados"]
    nombres = [n.strip() for n in e["aliados"].replace(" y ", ",").split(",") if n.strip() and not n.strip()[0].isdigit()]
    con_logo = [n for n in nombres if any(norm(l["titulo"]) == norm(n) and l.get("url") and imagen_ok(l["url"]) for l in logos)]
    print(("ok|" if len(nombres) >= 3 and len(con_logo) == len(nombres) else "fallo|") + f"edición {anio}: los {len(nombres)} aliados del texto tienen logotipo descargable ({len(con_logo)}); sin «consultado el…» en ningún texto"
          if "consultado" not in json.dumps(e, ensure_ascii=False).lower() else "fallo|edición %d: algún texto trae «consultado el…»" % anio)
    caja = [r for r in e["recursos"] if norm(r["grupo"]) not in ("aliados", "logos de aliados", "logos de los aliados")]
    grupos = {r["grupo"] for r in caja}
    descargables = [r for r in caja if r.get("archivoId") and imagen_ok(r["url"])]
    print(("ok|" if len(caja) >= 3 and len(grupos) >= 2 and descargables else "fallo|") + f"edición {anio}: caja de herramientas con {len(caja)} recursos en {len(grupos)} grupos ({len(descargables)} descargables del Banco con vista previa)")
    mev, mno = mins[anio]
    ev = js(f"/publico/agenda?proyecto={e['proyectoCodigo']}&cuando=todos&tamano=50")
    no = js(f"/publico/noticias?proyecto={e['proyectoCodigo']}&tamano=50")
    print(("ok|" if ev and ev["total"] >= mev and no and no["total"] >= mno else "fallo|")
          + f"edición {anio}: eventos destacados y noticias de la agenda sembrada con su proyecto «{e['proyectoCodigo']}» ({ev and ev['total']} eventos, mínimo {mev}; {no and no['total']} noticias, mínimo {mno})")
PY
)"; volcar_resultados <<<"$resultado"

  seccion "Motor de siembra (verificadores del kit, sin tocar la base)"
  local datos=() dir_datos="${SIMUS_SIEMBRA_DATOS:-$RAIZ/tmp/siembra/datos}"
  [[ -f "$dir_datos/festivales.json" ]] && datos=(--datos "$dir_datos")
  local salida
  if salida="$(python3 -I "$RAIZ/siembra/libro/masivo/verificador.py" ${datos[@]+"${datos[@]}"} 2>&1)"; then
    ok "verificador del motor masivo: $(printf '%s' "$salida" | tail -1 | cut -c1-110)"
  else
    fallo "verificador del motor masivo (python3 siembra/libro/masivo/verificador.py): $(printf '%s' "$salida" | tail -2 | tr '\n' ' ' | cut -c1-160)"
  fi
  if salida="$(python3 "$RAIZ/siembra/multimedia/construir.py" verificar --plan 2>&1)"; then
    ok "verificación de multimedia del kit (pool, manifiesto y plan): $(printf '%s' "$salida" | tail -1 | cut -c1-110)"
  else
    fallo "verificación de multimedia (python3 siembra/multimedia/construir.py verificar --plan): $(printf '%s' "$salida" | tail -2 | tr '\n' ' ' | cut -c1-160)"
  fi
}

MODO="${SIMUS_VERIFICAR_MODO:-}"
if [[ -z "$MODO" ]]; then
  if [[ "${SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL:-0}" == "1" ]]; then MODO="clasica"; else MODO="integral"; fi
fi
case "$MODO" in
  integral) verificar_integral ;;
  clasica) verificar_clasica ;;
  *) echo "[verificar] SIMUS_VERIFICAR_MODO debe ser integral o clasica (es «${MODO}»)." >&2; exit 2 ;;
esac

# Solo si la demo se levantó con Mailpit (lo activa reiniciar-demo.sh); si no, no es un faltante.
if [[ "${SIMUS_VERIFICAR_MAILPIT:-0}" == "1" ]]; then
  seccion "Bandeja de correo local (Mailpit)"
  if curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:${SIMUS_LOCAL_MAILPIT_WEB_PORT:-8025}/api/v1/info" 2>/dev/null; then
    ok "Mailpit responde en http://127.0.0.1:${SIMUS_LOCAL_MAILPIT_WEB_PORT:-8025}"
  else
    fallo "Mailpit no responde en el puerto ${SIMUS_LOCAL_MAILPIT_WEB_PORT:-8025} (./scripts/local/mailpit-local.sh up)"
  fi
fi

printf '\nResultado (%s): %s comprobaciones en orden, %s con faltantes, %s avisos (muestra) y %s omitidas (cuentas con cambio de clave pendiente).\n' "$MODO" "$OK" "$FALLOS" "$AVISOS" "$OMITIDAS"
if [[ "$FALLOS" -ne 0 ]]; then
  if [[ "$MODO" == "integral" ]]; then
    echo "[verificar] La demo NO está completa (siembra integral). Restaura la instantánea «sembrada» (./scripts/demo/demo-instantanea.sh listar) o rehaz todo con ./scripts/demo/reiniciar-demo.sh --si." >&2
  else
    echo "[verificar] La demo NO está completa. Rehaz la siembra: ./scripts/demo/sembrar-demo.sh (o ./scripts/demo/reiniciar-demo.sh --si)." >&2
  fi
  exit 1
fi
echo "[verificar] Demo completa."
