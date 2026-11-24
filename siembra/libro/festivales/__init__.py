"""Libro de nivel 1 de FESTIVALES Y MERCADOS (ver LEEME.md). Lo consume `siembra/generador/constructor_festivales.py`."""
from . import f01_baudo, f02_cienaga, f03_paramo, f04_ariari, f05_cravo, f06_caqueta, f07_f10, f09_guanentina, mercados as _mercados, reales, historicos
from .organizaciones import ORGANIZACIONES, PERSONAS

FESTIVALES = [f01_baudo.FESTIVAL, f02_cienaga.FESTIVAL, f03_paramo.FESTIVAL, f04_ariari.FESTIVAL, f05_cravo.FESTIVAL, f06_caqueta.FESTIVAL,
              f07_f10.F07, f07_f10.F08, f09_guanentina.FESTIVAL, f07_f10.F10]
MERCADOS = _mercados.MERCADOS
HISTORICOS = historicos.HISTORICOS
REALES_FESTIVALES = reales.FESTIVALES
REALES_MERCADOS = reales.MERCADOS
