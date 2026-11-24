"""Catálogo editorial: el acervo (171 publicaciones, 410 agentes, 864 créditos) ya viene de las migraciones/seed y NO se toca.

Aquí solo se MARCA como N1 (claves estables `n1.editorial.<codigo>`) un subconjunto de las fichas más completas —por créditos, identificadores y resumen—
para que los guiones de los videos puedan citarlas. No se inventa ninguna obra ni dato bibliográfico.
"""
EDITORIAL_FUENTE = "Acervo editorial del PNMC cargado por simus-database/seed/V20261009_06__catalogo_editorial_acervo_revisado.sql (fichas existentes; solo se marcan)"
EDITORIAL_N1 = [
    "PNMC-ED-008",  # Música vocal escolar, vol. 2 (11 créditos, ISBN)
    "PNMC-ED-010",  # Música colombiana para banda, coro y formato tradicional andino (40 créditos, 2 identificadores)
    "PNMC-ED-017",  # 8 arreglos para banda (23 créditos)
    "PNMC-ED-020",  # 8 arreglos para orquesta (19 créditos)
    "PNMC-ED-028",  # Guía de iniciación al clarinete (15 créditos)
    "PNMC-ED-029",  # Cuaderno de ejercicios para clarinete
    "PNMC-ED-120",  # This is Gozar. Herencia de Timbiquí (16 créditos)
    "PNMC-ED-144",  # Clásicos de la salsa (15 créditos)
]
