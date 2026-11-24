"""Ayudas de escritura del libro (no contiene datos)."""
from __future__ import annotations


def ed(anio, num, fechas, lema, sede, resumen, prog=(), formacion=None, convocatoria=None, cifras=None, estado="realizada", **extra):
    """Una edición. `fechas` = ((mes, día), (mes, día)) o None; `prog` = [(día_relativo, "HH:MM", título, categoría, lugar, texto)]."""
    return dict(anio=anio, num=num, fechas=fechas, lema=lema, sede=sede, resumen=resumen, prog=list(prog), formacion=formacion,
                convocatoria=convocatoria, cifras=cifras or {}, estado=estado, **extra)
