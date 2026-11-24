#!/usr/bin/env python3
"""Verificador automático de calidad del motor masivo (N2/N3).

    python3 -I siembra/libro/masivo/verificador.py                 # escala 1.0, informe legible
    python3 -I siembra/libro/masivo/verificador.py --escala 0.3 --json
    python3 -I siembra/libro/masivo/verificador.py --datos DIR      # además compara los nombres con los datos públicos completos (132 entidades reales)

Mide, sobre el plan ya construido (no sobre las especificaciones internas): textos duplicados o casi duplicados (similitud de trigramas de
palabras), distribución de longitudes por campo y nivel, cobertura por departamento y por práctica, grafo de relaciones (huérfanos indebidos,
componentes, grados, simetría de las menciones entre fichas), estados válidos, fechas coherentes e integridad referencial (reusa `validar`),
y nombres/correos (colisiones con entidades reales, músicos reconocibles, `.test`). Sale con código 1 si falla un criterio bloqueante.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[2]
sys.path.insert(0, str(RAIZ / "siembra" / "generador"))
sys.path.insert(0, str(RAIZ / "siembra" / "libro"))

from masivo import lexico as L  # noqa: E402
from masivo import texto as T  # noqa: E402
from masivo.generador import FAMOSOS, _norm  # noqa: E402
from nucleo import Cat, Ref  # noqa: E402

NODOS = {"Usuarios": "persona", "Entidades": "organizacion", "Festivales": "festival", "EdicionesFestival": "edicion", "Mercados": "mercado", "EdicionesMercado": "edicion-mercado",
         "Redes": "red", "Talleres": "taller", "Espacios": "espacio", "EventosAgenda": "evento"}
PRINCIPALES = ("Usuarios", "Entidades", "Festivales", "Mercados", "Redes", "Talleres", "Espacios", "EventosAgenda")
RELACIONALES = {"UsuariosEntidades", "EntidadesAliadasDeRegistro"}
AUDITORIA = {"IdUsuarioCreador", "IdUsuarioModera", "IdUsuarioRevisionConsola", "IdUsuarioResponsable"}
CAMPOS_TEXTO = [("Usuarios", None), ("PerfilesPublicos", "BiografiaCorta"), ("PerfilesPublicos", "BiografiaLarga"), ("Entidades", "Descripcion"), ("Festivales", "Descripcion"), ("EdicionesFestival", "Descripcion"),
                ("Mercados", "Descripcion"), ("EdicionesMercado", "Descripcion"), ("Redes", "Descripcion"), ("Talleres", "Descripcion"), ("Espacios", "Descripcion"), ("EventosAgenda", "Titulo"),
                ("EventosAgenda", "Descripcion"), ("EventosAgenda", "DescripcionLarga")]
CAMPOS_TEXTO = [x for x in CAMPOS_TEXTO if x[1]]
UMBRAL_CASI = 0.5      # trigramas compartidos / unión: «casi duplicado»
UMBRAL_DUP = 0.8


def es_masivo(f) -> bool:
    return "-masivo-" in f.lote


def depto_de(f):
    v = f.valores
    for k in ("CodigoDepartamento", "SedeCodigoDepartamento", "CodigoDepartamentoSede", "ResidenciaCodigoDepartamento"):
        if v.get(k):
            return v[k]
    for k in ("CodigoMunicipio", "SedeCodigoMunicipio", "CodigoMunicipioSede", "ResidenciaCodigoMunicipio"):
        if v.get(k):
            return v[k][:2]
    return None


def percentiles(xs):
    xs = sorted(xs)
    if not xs:
        return {}
    q = lambda p: xs[min(len(xs) - 1, int(p * (len(xs) - 1) + 0.5))]
    return {"n": len(xs), "min": xs[0], "p10": q(.1), "mediana": q(.5), "p90": q(.9), "max": xs[-1], "media": round(statistics.mean(xs))}


def gini(vals):
    v = sorted(vals)
    n, s = len(v), sum(v)
    return 0.0 if not s else round(sum((2 * (i + 1) - n - 1) * x for i, x in enumerate(v)) / (n * s), 3)


def verificar(plan, esquema, catalogos, territorio, datos_reales: list | None = None) -> dict:
    from validaciones import validar
    filas = [f for f in plan.filas if es_masivo(f)]
    out: dict = {"fallas": [], "avisos": []}
    falla, aviso = out["fallas"].append, out["avisos"].append

    # ---------------- 1. conteos
    cuenta = Counter()
    for f in filas:
        if f.alias and f.tabla in PRINCIPALES:
            cuenta[(f.nivel, f.tabla)] += 1
    por_nivel = {n: sum(v for (nv, _), v in cuenta.items() if nv == n) for n in (2, 3)}
    out["conteo"] = {"registros_por_nivel": por_nivel, "por_nivel_y_tipo": {f"n{n}.{t}": v for (n, t), v in sorted(cuenta.items())}, "filas_totales_masivo": len(filas),
                     "ediciones": {n: sum(1 for f in filas if f.tabla in ("EdicionesFestival", "EdicionesMercado") and f.nivel == n) for n in (2, 3)}}

    # ---------------- 2. validación estructural (esquema, CHECK, referencias, fechas, historiales) reutilizando el validador del kit
    errores, avisos_v = validar(plan, esquema, catalogos, territorio)
    mios = [e for e in errores if ".n2." in e or ".n3." in e or "masivo" in e or "evento.n" in e]
    out["validacion"] = {"errores_totales": len(errores), "errores_del_motor": len(mios), "avisos": len(avisos_v)}
    if errores:
        falla(f"el validador del kit reporta {len(errores)} errores (primeros: {errores[:3]})")

    # ---------------- 3. textos: duplicados y casi duplicados
    textos = {}
    for tabla, col in CAMPOS_TEXTO:
        items = [(f.alias, f.valores[col], f.nivel) for f in filas if f.tabla == tabla and f.alias and isinstance(f.valores.get(col), str) and f.valores[col]]
        textos[(tabla, col)] = items
    dup = {}
    for (tabla, col), items in textos.items():
        if len(items) < 2:
            continue
        tg = [T._trigramas(t) for _, t, _ in items]
        exactos = len(items) - len({_norm(t) for _, t, _ in items})
        casi, dup80, vec_max = 0, 0, []
        peor = (0.0, None, None)
        for i in range(len(items)):
            m = 0.0
            for j in range(len(items)):
                if i != j:
                    s = T.similitud(tg[i], tg[j])
                    if s > m:
                        m = s
                    if j > i and s > peor[0]:
                        peor = (s, items[i][0], items[j][0])
            vec_max.append(m)
            if m >= UMBRAL_CASI:
                casi += 1
            if m >= UMBRAL_DUP:
                dup80 += 1
        oraciones = Counter(o.strip() for _, t, _ in items for o in re.split(r"(?<=[.!?])\s+", t) if len(o.strip()) > 25)
        total_o = sum(oraciones.values())
        rep = sum(v for v in oraciones.values() if v > 3)
        dup[f"{tabla}.{col}"] = {"textos": len(items), "exactos_repetidos": exactos, "casi_duplicados(>=0.5)": casi, "duplicados(>=0.8)": dup80, "similitud_vecino_media": round(statistics.mean(vec_max), 3),
                                 "similitud_vecino_max": round(max(vec_max), 3), "par_mas_parecido": peor[1:] if peor[1] else None, "oraciones_distintas_pct": round(100 * len(oraciones) / max(total_o, 1), 1),
                                 "oraciones_en_>3_textos_pct": round(100 * rep / max(total_o, 1), 1)}
        if exactos:
            falla(f"{tabla}.{col}: {exactos} textos exactamente repetidos")
        if dup80:
            falla(f"{tabla}.{col}: {dup80} textos casi idénticos (similitud >= {UMBRAL_DUP})")
        if casi > 0.03 * len(items):
            aviso(f"{tabla}.{col}: {casi} textos parecidos (>= {UMBRAL_CASI}) de {len(items)}")
    out["textos"] = dup

    # ---------------- 4. longitudes por campo y nivel
    lon = {}
    for (tabla, col), items in textos.items():
        for n in (2, 3):
            xs = [len(t) for _, t, nv in items if nv == n]
            if xs:
                lon[f"{tabla}.{col}.n{n}"] = percentiles(xs)
    out["longitudes"] = lon
    for clave in ("Entidades.Descripcion", "Festivales.Descripcion", "PerfilesPublicos.BiografiaLarga", "EdicionesFestival.Descripcion"):
        a, b = lon.get(f"{clave}.n2"), lon.get(f"{clave}.n3")
        if a and b and a["media"] < b["media"]:
            falla(f"{clave}: los N2 deben ser más completos que los N3 (media {a['media']} < {b['media']})")
    for (tabla, col), items in textos.items():
        cortos = [a for a, t, _ in items if len(t) < 40]
        if cortos and col not in ("Titulo",):
            falla(f"{tabla}.{col}: {len(cortos)} textos de menos de 40 caracteres")

    # ---------------- 5. cobertura territorial y por práctica
    por_dep = defaultdict(Counter)
    for f in filas:
        if f.alias and f.tabla in PRINCIPALES:
            d = depto_de(f)
            if d:
                por_dep[d][NODOS[f.tabla]] += 1
    todos = set(territorio.codigos_dep)
    cubiertos = {d for d in por_dep}
    tot_dep = {d: sum(c.values()) for d, c in por_dep.items()}
    top5 = sorted(tot_dep.values(), reverse=True)[:5]
    por_nivel_dep = {n: len({depto_de(f) for f in filas if f.alias and f.tabla in PRINCIPALES and f.nivel == n and depto_de(f)}) for n in (2, 3)}
    bog = tot_dep.get("11", 0)
    out["territorio"] = {"departamentos_cubiertos": f"{len(cubiertos)}/{len(todos)}", "cubiertos_por_nivel": por_nivel_dep, "gini_registros_por_departamento": gini([tot_dep.get(d, 0) for d in todos]),
                         "participacion_top5": round(sum(top5) / max(sum(tot_dep.values()), 1), 3), "minimo": min(tot_dep.get(d, 0) for d in todos), "maximo": max(tot_dep.values()),
                         "por_departamento": {d: dict(c) for d, c in sorted(por_dep.items())},
                         "municipios_distintos": len({(f.valores.get("CodigoMunicipio") or f.valores.get("SedeCodigoMunicipio") or f.valores.get("CodigoMunicipioSede") or f.valores.get("ResidenciaCodigoMunicipio")) for f in filas if f.alias and f.tabla in PRINCIPALES} - {None})}
    if todos - cubiertos:
        falla(f"departamentos sin ningún registro: {sorted(todos - cubiertos)}")
    if out["territorio"]["gini_registros_por_departamento"] < 0.2:
        aviso("la distribución territorial es casi uniforme (Gini < 0.2)")
    if bog and bog < max(tot_dep.values()) * 0.99:
        aviso("Bogotá no es el departamento con más registros")
    fam_por_slug = {v["slug"]: k for k, v in L.FAMILIAS.items()}
    practicas = Counter()
    for f in filas:
        if f.tabla.endswith("PracticasMusicales") or f.tabla in ("PracticasMusicalesDeRegistro", "PerfilesPublicosPracticas"):
            for v in f.valores.values():
                if isinstance(v, Cat) and v.tabla == "PracticasMusicales":
                    practicas[fam_por_slug.get(v.clave, v.clave)] += 1
    out["practicas"] = {"familias_presentes": f"{len(practicas)}/{len(L.FAMILIAS)}", "conteo": dict(practicas.most_common()), "participacion_mayor": round(max(practicas.values()) / max(sum(practicas.values()), 1), 3) if practicas else 0}
    if len(practicas) < len(L.FAMILIAS):
        falla(f"prácticas sin cobertura: {sorted(set(L.FAMILIAS) - set(practicas))}")
    if practicas and max(practicas.values()) / sum(practicas.values()) > 0.3:
        aviso("una sola práctica concentra más del 30% de las asociaciones")

    # ---------------- 6. grafo de relaciones
    alias_a_fila = {f.alias: f for f in plan.filas if f.alias}
    nodo = {f.alias: NODOS[f.tabla] for f in filas if f.alias and f.tabla in NODOS}
    aristas, vistas = [], set()
    def arista(a, b, tipo):
        if a == b or a not in nodo or b not in nodo:
            return
        k = (min(a, b), max(a, b), tipo)
        if k not in vistas:
            vistas.add(k)
            aristas.append(k)
    for f in filas:
        refs = [(k, v) for k, v in f.valores.items() if isinstance(v, Ref) and k not in AUDITORIA]
        if f.alias is None and f.tabla in RELACIONALES:
            ids = [v.alias for _, v in refs if v.alias in nodo]
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    arista(ids[i], ids[j], f.tabla)
        elif f.alias in nodo:
            for k, v in refs:
                arista(f.alias, v.alias, k)
    grado = Counter()
    padre = {a: a for a in nodo}
    def raiz(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a
    for a, b, _ in aristas:
        grado[a] += 1
        grado[b] += 1
        padre[raiz(a)] = raiz(b)
    comps = Counter(raiz(a) for a in nodo)
    huerfanos = defaultdict(list)
    for a, t in nodo.items():
        if grado[a] == 0:
            huerfanos[t].append(a)
    por_tipo_grado = {}
    for t in set(nodo.values()):
        gs = [grado[a] for a, tt in nodo.items() if tt == t]
        por_tipo_grado[t] = {"nodos": len(gs), "grado_min": min(gs), "grado_mediano": statistics.median(gs), "grado_max": max(gs), "sin_aristas": sum(1 for g in gs if g == 0)}
    hubs = [(a, grado[a], nodo[a]) for a, _ in grado.most_common(6)]
    out["grafo"] = {"nodos": len(nodo), "aristas": len(aristas), "componentes": len(comps), "mayor_componente_pct": round(100 * max(comps.values()) / max(len(nodo), 1), 1), "por_tipo": por_tipo_grado, "mayores_hubs": hubs,
                    "tipos_de_arista": dict(Counter(t for _, _, t in aristas).most_common())}
    indebidos = {t: v for t, v in huerfanos.items() if t not in ("persona", "evento")}
    out["grafo"]["huerfanos_indebidos"] = {t: len(v) for t, v in indebidos.items()}
    out["grafo"]["personas_sin_vinculos_pct"] = round(100 * len(huerfanos.get("persona", [])) / max(sum(1 for t in nodo.values() if t == "persona"), 1), 1)
    out["grafo"]["eventos_independientes_pct"] = round(100 * len(huerfanos.get("evento", [])) / max(sum(1 for t in nodo.values() if t == "evento"), 1), 1)
    if indebidos:
        falla(f"nodos huérfanos indebidos: { {t: v[:3] for t, v in indebidos.items()} }")
    if out["grafo"]["mayor_componente_pct"] < 50:
        aviso("el mayor componente conexo contiene menos de la mitad de los nodos")
    densidad = [grado[a] for a, t in nodo.items() if t == "organizacion"]
    if densidad and max(densidad) < 3 * (statistics.median(densidad) or 1):
        aviso("la densidad de relaciones de las organizaciones es casi uniforme")
    # organizaciones activas con administrador, ediciones con festival (reglas de integridad que el grafo debe cumplir)
    admins = {f.valores["IdEntidad"].alias for f in filas if f.tabla == "UsuariosEntidades" and f.valores["RolEntidad"] == "administrador"}
    sin_admin = [f.alias for f in filas if f.tabla == "Entidades" and f.valores["EstadoRegistro"] == "activa" and f.alias not in admins]
    if sin_admin:
        falla(f"{len(sin_admin)} organizaciones activas sin administrador")

    # simetría de menciones: si A figura en B, B figura en A
    nombres = {}
    for f in filas:
        for col in ("Nombre", "NombreFestival", "NombreMercado", "NombreRed", "NombreTaller", "NombreEspacio"):
            if f.alias and col in f.valores and f.tabla in NODOS:
                nombres[f.valores[col]] = f
    def menciones(texto):
        return re.findall(r"«([^»]+)»", texto or "")
    asimetricas, revisadas, falsas = 0, 0, 0
    for f in filas:
        if f.tabla == "Entidades":
            for nm in menciones(f.valores.get("Descripcion")):
                g = nombres.get(nm)
                if g is None:
                    continue
                revisadas += 1
                if g.tabla == "Festivales":
                    # agrupación que «se ha presentado en» un festival: el festival debe nombrar a la agrupación; o la organización lo organiza
                    if f"«{f.valores['Nombre']}»" not in (g.valores.get("Descripcion") or "") and g.valores["OrganizacionPrincipalId"].alias != f.alias:
                        asimetricas += 1
                elif g.tabla in ("Mercados", "Redes", "Talleres", "Espacios"):
                    due = g.valores.get("OrganizacionPrincipalId")
                    if due is None or due.alias != f.alias:
                        falsas += 1
                elif g.tabla == "Entidades":
                    pass
        if f.tabla == "Festivales":
            for nm in menciones(f.valores.get("Descripcion")):
                g = nombres.get(nm)
                if g is None or g.tabla != "Entidades":
                    continue
                revisadas += 1
                aliada = any(r.tabla == "EntidadesAliadasDeRegistro" and r.valores["EntidadId"].alias == g.alias and r.valores["RegistroId"].alias == f.alias for r in filas if r.tabla == "EntidadesAliadasDeRegistro") if False else None
                if f.valores["OrganizacionPrincipalId"].alias == g.alias:
                    continue
                if f"«{f.valores['NombreFestival']}»" in (g.valores.get("Descripcion") or ""):
                    continue
                aliadas = {r.valores["EntidadId"].alias for r in filas if r.tabla == "EntidadesAliadasDeRegistro" and r.valores["RegistroId"].alias == f.alias}
                if g.alias not in aliadas:
                    asimetricas += 1
    out["grafo"]["menciones_revisadas"] = revisadas
    out["grafo"]["menciones_sin_arista_ni_reciproco"] = asimetricas
    out["grafo"]["menciones_falsas_de_proceso"] = falsas
    if asimetricas or falsas:
        falla(f"menciones inconsistentes entre fichas: {asimetricas} sin reciprocidad y {falsas} falsas")

    # ---------------- 7. estados
    estados = defaultdict(Counter)
    campos_estado = {"Festivales": "EstadoRegistro", "Mercados": "EstadoRegistro", "Redes": "EstadoRegistro", "Talleres": "EstadoRegistro", "Espacios": "EstadoRegistro", "Entidades": "EstadoRegistro",
                     "EventosAgenda": "Estado", "EdicionesFestival": "Estado", "EdicionesMercado": "Estado"}
    for f in filas:
        if f.tabla in campos_estado and f.alias:
            estados[f.tabla][f.valores[campos_estado[f.tabla]]] += 1
    out["estados"] = {t: dict(c.most_common()) for t, c in estados.items()}
    if any("aprobado" in c for c in estados.values()):
        falla("se sembró el estado «aprobado», que ningún camino del API escribe")
    faltan = [t for t in ("Festivales", "Mercados", "Redes", "Talleres", "Espacios") if len(estados.get(t, {})) < 4]
    if faltan:
        aviso(f"poca variedad de estados en: {faltan}")
    huecos = Counter(f.valores["ModuloId"] for f in filas if f.tabla == "RegistrosRevisionHistorial")
    out["estados"]["historiales_por_modulo"] = dict(huecos)

    # ---------------- 8. fechas
    anios = defaultdict(Counter)
    for f in filas:
        if f.tabla in ("EdicionesFestival", "EdicionesMercado"):
            anios["ediciones"][f.valores["Anio"]] += 1
            ini = f.valores.get("FechaInicio")
            if ini and ini.year != f.valores["Anio"]:
                falla(f"{f.alias}: el año de la edición no coincide con su fecha de inicio")
        if f.tabla == "EventosAgenda":
            anios["eventos"][f.valores["FechaInicio"].year] += 1
        if f.tabla in ("Usuarios", "Entidades", "Festivales") and f.alias:
            anios["altas_" + NODOS[f.tabla]][f.valores["FechaCreacion"].year] += 1
    fut = lambda f: f.valores["FechaInicio"] > plan.hoy
    ev = [f for f in filas if f.tabla == "EventosAgenda"]
    out["fechas"] = {"por_anio": {k: dict(sorted(v.items())) for k, v in anios.items()},
                     "eventos_pasados/futuros": [sum(1 for f in ev if not fut(f)), sum(1 for f in ev if fut(f))], "rango_ediciones": [min(anios["ediciones"]), max(anios["ediciones"])] if anios["ediciones"] else None}
    if anios["ediciones"] and (min(anios["ediciones"]) > 2019 or max(anios["ediciones"]) < plan.hoy.year + 1):
        falla("las ediciones no cubren de 2018-2019 a un año futuro")
    if not ev or not any(fut(f) for f in ev) or not any(not fut(f) for f in ev):
        falla("los eventos no tienen pasado y futuro")
    if anios["ediciones"]:
        serie = [anios["ediciones"].get(a, 0) for a in range(2018, plan.hoy.year + 2)]
        if sum(1 for s in serie if s > 0) < len(serie) - 1:
            aviso(f"series de ediciones con años vacíos: {dict(zip(range(2018, plan.hoy.year + 2), serie))}")

    # ---------------- 9. nombres y contactos
    nom = [(f.alias, f.valores.get(c)) for f in filas for c in ("Nombre", "NombreFestival", "NombreMercado", "NombreRed", "NombreTaller", "NombreEspacio") if f.alias and f.tabla in NODOS and c in f.valores and f.valores.get(c)]
    cnt = Counter(_norm(n) for _, n in nom if n)
    repetidos = [n for n, c in cnt.items() if c > 1]
    reales = [_norm(x) for x in (datos_reales or [])] + FAMOSOS
    choques = [n for _, n in nom if any(r and (r == _norm(n) or (len(r) > 8 and r in _norm(n))) for r in reales)]
    personas = [f for f in filas if f.tabla == "Usuarios"]
    vetados = {(_norm(a), _norm(b)) for a, b in L.VETADOS}
    musicos = [f.alias for f in personas if (_norm(f.valores["PrimerNombre"]), _norm(f.valores["PrimerApellido"])) in vetados]
    correos = [f.valores["CorreoElectronico"] for f in personas]
    malos = [c for c in correos if not c.endswith("@simus.test")]
    contactos = [v for f in filas if f.alias and f.tabla in NODOS for k, v in f.valores.items() if k.startswith("Correo") and isinstance(v, str) and k != "CorreoElectronico"]
    contactos_mal = [c for c in contactos if not c.endswith(".test")]
    out["nombres"] = {"entidades": len(nom), "repetidos": len(repetidos), "colisiones_con_reales": len(choques), "personas_vetadas": len(musicos), "correos_personas": len(correos), "correos_unicos": len(set(correos)),
                      "correos_fuera_de_simus_test": len(malos), "correos_de_contacto_no_test": len(contactos_mal)}
    if repetidos:
        falla(f"nombres de entidades repetidos: {repetidos[:3]}")
    if choques:
        falla(f"nombres que colisionan con entidades reales: {choques[:3]}")
    if musicos or malos or contactos_mal or len(set(correos)) != len(correos):
        falla("personas vetadas, correos repetidos o fuera de .test")
    documentos = [f.valores["Identificacion"] for f in personas]
    if any(not d.startswith("DEMO-") for d in documentos) or len(set(documentos)) != len(documentos):
        falla("documentos de identidad no ficticios o repetidos")
    out["ok"] = not out["fallas"]
    return out


def imprimir(r: dict):
    c = r["conteo"]
    print("== VERIFICADOR DEL MOTOR MASIVO (N2/N3) ==")
    print(f"Registros principales: N2 {c['registros_por_nivel'][2]}, N3 {c['registros_por_nivel'][3]} · ediciones N2 {c['ediciones'][2]}, N3 {c['ediciones'][3]} · filas del motor {c['filas_totales_masivo']}")
    print("  por tipo:", c["por_nivel_y_tipo"])
    v = r["validacion"]
    print(f"Validación del kit: {v['errores_totales']} errores ({v['errores_del_motor']} del motor), {v['avisos']} avisos")
    print("Textos (similitud de trigramas de palabras; casi duplicado >= 0.5, duplicado >= 0.8):")
    for k, d in r["textos"].items():
        print(f"  {k:38s} n={d['textos']:4d}  exactos={d['exactos_repetidos']}  casi={d['casi_duplicados(>=0.5)']}  dup={d['duplicados(>=0.8)']}  vecino media/max={d['similitud_vecino_media']}/{d['similitud_vecino_max']}  oraciones distintas={d['oraciones_distintas_pct']}%  repetidas(>3)={d['oraciones_en_>3_textos_pct']}%")
    print("Longitudes (caracteres):")
    for k, d in r["longitudes"].items():
        print(f"  {k:42s} n={d['n']:4d} min={d['min']:5d} p10={d['p10']:5d} med={d['mediana']:5d} p90={d['p90']:5d} max={d['max']:5d}")
    t = r["territorio"]
    print(f"Territorio: {t['departamentos_cubiertos']} departamentos (N2 {t['cubiertos_por_nivel'][2]}, N3 {t['cubiertos_por_nivel'][3]}), {t['municipios_distintos']} municipios distintos, Gini {t['gini_registros_por_departamento']}, top-5 {t['participacion_top5']}, mín {t['minimo']} / máx {t['maximo']}")
    p = r["practicas"]
    print(f"Prácticas: {p['familias_presentes']} familias; mayor participación {p['participacion_mayor']}; {p['conteo']}")
    g = r["grafo"]
    print(f"Grafo: {g['nodos']} nodos, {g['aristas']} aristas, {g['componentes']} componentes (mayor {g['mayor_componente_pct']}%); huérfanos indebidos {g['huerfanos_indebidos'] or 0}; personas sin vínculos {g['personas_sin_vinculos_pct']}%, eventos independientes {g['eventos_independientes_pct']}%")
    print("  grado por tipo:", {k: (d['grado_min'], d['grado_mediano'], d['grado_max']) for k, d in g["por_tipo"].items()}, "| hubs:", g["mayores_hubs"][:3])
    print(f"  menciones revisadas {g['menciones_revisadas']}, asimétricas {g['menciones_sin_arista_ni_reciproco']}, falsas {g['menciones_falsas_de_proceso']}")
    print("Estados:", {k: v for k, v in r["estados"].items() if k != "historiales_por_modulo"})
    f = r["fechas"]
    print(f"Fechas: ediciones por año {f['por_anio'].get('ediciones')}, eventos pasados/futuros {f['eventos_pasados/futuros']}")
    print("Nombres:", r["nombres"])
    for a in r["avisos"]:
        print("[aviso]", a)
    for a in r["fallas"]:
        print("[FALLA]", a)
    print("RESULTADO:", "CORRECTO" if r["ok"] else "CON FALLAS")


def main(argv=None) -> int:
    import siembra
    import datos_publicos as dp
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--escala", type=float, default=1.0)
    ap.add_argument("--semilla", type=int, default=20261121)
    ap.add_argument("--hoy", default="2026-11-21")
    ap.add_argument("--datos")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    cat = json.loads((RAIZ / "siembra" / "generador" / "catalogos-instantanea.json").read_text(encoding="utf-8"))
    esq = json.loads((RAIZ / "siembra" / "generador" / "esquema-instantanea.json").read_text(encoding="utf-8"))
    datos = dp.cargar(dp.carpeta_de_datos(None))                  # el plan base usa la muestra versionada (o $SIMUS_SIEMBRA_DATOS)
    plan = siembra.construir_plan(a.semilla, dt.date.fromisoformat(a.hoy), datos, cat, masivo=a.escala)
    completos = dp.cargar(Path(a.datos)) if a.datos else datos     # --datos solo amplía la lista de nombres reales a evitar
    reales = [d.get("nombre", "") for t in ("festivales", "mercados", "organizaciones") for d in completos.get(t, [])]
    r = verificar(plan, esq, cat, dp.Territorio(cat["divipola"]), reales)
    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=1, default=str))
    else:
        imprimir(r)
    return 0 if r["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
