#!/usr/bin/env python3
"""Reparte las clases de prueba de la API en N grupos equilibrados para correrlos en procesos paralelos.

Uso (lo invoca scripts/validacion/pruebas-api-en-paralelo.sh):
  repartir-pruebas-de-api.py repartir  <N> <lista.txt> <carpeta-salida> [--pesos pesos.txt]
      Lee la salida de `dotnet test --list-tests`, agrupa por clase, reparte por peso (más pesada primero,
      al grupo menos cargado) y escribe <carpeta>/grupo-1.filtro ... grupo-N.filtro (un --filter por grupo).
      Después VERIFICA que cada prueba listada cae en exactamente un grupo (ninguna sin correr, ninguna dos
      veces); si no, sale con 2.
  repartir-pruebas-de-api.py pesos <carpeta-con-trx> <salida.txt>
      Resume los .trx de una corrida en «Clase segundos» para afinar el reparto la próxima vez.

Peso de una clase: sus segundos medidos si figuran en el archivo de pesos; si no, su número de pruebas por el
promedio de segundos por prueba de las medidas (1 si no hay ninguna). Sin pesos, equivale a repartir por
número de pruebas.

Se excluye CarrilDeSqlServerNoSeOlvida, igual que el filtro de validar-local.sh.
"""
import glob
import re
import sys
import xml.etree.ElementTree as ET

EXCLUIDAS = ("CarrilDeSqlServerNoSeOlvida",)
ESCAPE = re.compile(r"([\\()&|=!~])")


def clase_de(nombre):
    """«Ns.Clase.Metodo(args)» -> «Ns.Clase» (los argumentos de las teorías pueden llevar puntos)."""
    base = nombre.split("(", 1)[0].strip()
    return base.rsplit(".", 1)[0] if "." in base else base


def leer_lista(ruta):
    """Las pruebas son las líneas con 4 espacios de sangría y un nombre calificado (la cabecera depende del idioma)."""
    patron = re.compile(r"^    [A-Za-z_][\w]*(\.[\w+]+)+")
    return [l.strip() for l in open(ruta, encoding="utf-8", errors="replace") if patron.match(l)]


def valor_de_filtro(clase):
    # Con el punto final «Foo.» no atrapa a «FooSqlServer.» (el filtro «~» es «contiene»).
    return "FullyQualifiedName~" + ESCAPE.sub(r"\\\1", clase) + "."


def repartir(n, pruebas, pesos):
    cuentas = {}
    for p in pruebas:
        c = clase_de(p)
        if any(x in c for x in EXCLUIDAS):
            continue
        cuentas[c] = cuentas.get(c, 0) + 1
    medidas = [(pesos[c], cuentas[c]) for c in cuentas if c in pesos]
    por_prueba = (sum(s for s, _ in medidas) / max(1, sum(k for _, k in medidas))) if medidas else 1.0
    peso = {c: pesos.get(c, cuentas[c] * por_prueba) for c in cuentas}
    grupos = [[] for _ in range(n)]
    carga = [0.0] * n
    for c in sorted(cuentas, key=lambda x: (-peso[x], x)):
        i = min(range(n), key=lambda j: (carga[j], j))
        grupos[i].append(c)
        carga[i] += peso[c]
    return grupos, carga, cuentas


def verificar(grupos, pruebas):
    """Devuelve la lista de problemas (vacía = cobertura exacta)."""
    filtros = [[valor_de_filtro(c).split("~", 1)[1].replace("\\", "") for c in g] for g in grupos]
    problemas = []
    for p in pruebas:
        fqn = p.split("(", 1)[0].strip()
        if any(x in fqn for x in EXCLUIDAS):
            continue
        aciertos = sum(1 for g in filtros for f in g if f in fqn)
        if aciertos != 1:
            problemas.append("%s: lo cubren %d filtros" % (fqn, aciertos))
    return problemas


def cmd_repartir(args):
    n, lista, salida = int(args[0]), args[1], args[2]
    pesos = {}
    if "--pesos" in args:
        for linea in open(args[args.index("--pesos") + 1], encoding="utf-8"):
            partes = linea.split()
            if len(partes) == 2 and not linea.startswith("#"):
                pesos[partes[0]] = float(partes[1])
    pruebas = leer_lista(lista)
    if not pruebas:
        print("repartir: la lista no contiene pruebas (¿salida de --list-tests?)", file=sys.stderr)
        return 2
    n = max(1, min(n, len(pruebas)))
    grupos, carga, cuentas = repartir(n, pruebas, pesos)
    problemas = verificar(grupos, pruebas)
    if problemas:
        print("repartir: el reparto no cubre exactamente las pruebas:", file=sys.stderr)
        for p in problemas[:20]:
            print("  " + p, file=sys.stderr)
        return 2
    for i, g in enumerate(grupos, 1):
        with open("%s/grupo-%d.filtro" % (salida, i), "w", encoding="utf-8") as f:
            f.write("|".join(valor_de_filtro(c) for c in sorted(g)) + "\n")
        print("grupo %d: %3d clases, %4d pruebas, peso %.0f" % (i, len(g), sum(cuentas[c] for c in g), carga[i - 1]))
    total = sum(cuentas.values())
    print("cobertura verificada: %d pruebas en %d clases, cada una en un solo grupo" % (total, len(cuentas)))
    return 0


def cmd_pesos(args):
    acum = {}
    for ruta in glob.glob(args[0].rstrip("/") + "/**/*.trx", recursive=True):
        raiz = ET.parse(ruta).getroot()
        ns = {"t": raiz.tag.split("}")[0].strip("{")}
        clase_por_id = {}
        for d in raiz.iterfind(".//t:UnitTest", ns):
            m = d.find("t:TestMethod", ns)
            if m is not None:
                clase_por_id[d.get("id")] = m.get("className")
        for r in raiz.iterfind(".//t:UnitTestResult", ns):
            h, mi, s = r.get("duration", "0:0:0").split(":")
            clase = clase_por_id.get(r.get("testId"))
            if clase:
                acum[clase] = acum.get(clase, 0.0) + int(h) * 3600 + int(mi) * 60 + float(s)
    with open(args[1], "w", encoding="utf-8") as f:
        f.write("# Clase segundos (suma de las duraciones de sus pruebas), de scripts/validacion/repartir-pruebas-de-api.py pesos\n")
        for c in sorted(acum):
            f.write("%s %.2f\n" % (c, acum[c]))
    print("pesos de %d clases en %s" % (len(acum), args[1]))
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("repartir", "pesos"):
        print(__doc__)
        sys.exit(2)
    sys.exit((cmd_repartir if sys.argv[1] == "repartir" else cmd_pesos)(sys.argv[2:]))
