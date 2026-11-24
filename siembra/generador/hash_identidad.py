"""Hash de contraseña compatible con `PasswordHasher<T>` de ASP.NET Identity (formato V3, .NET 7+).

Formato: 0x01 | PRF (4 bytes BE: 2 = HMAC-SHA512) | iteraciones (4 BE: 100000) | longitud de sal (4 BE: 16) | sal | subclave (32 bytes), en base64.
La sal sale de un resumen del correo, de modo que el mismo plan produce siempre el mismo hash (idempotencia, instantáneas comparables).
Comprobado contra el verificador real de .NET 10 (ver `pruebas_generador.py`).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import struct

ITERACIONES = 100_000


def hash_identidad(clave: str, sal_de: str) -> str:
    sal = hashlib.sha256(("simus-demo:" + sal_de).encode("utf-8")).digest()[:16]
    sub = hashlib.pbkdf2_hmac("sha512", clave.encode("utf-8"), sal, ITERACIONES, 32)
    return base64.b64encode(b"\x01" + struct.pack(">III", 2, ITERACIONES, 16) + sal + sub).decode("ascii")


def verificar(hash_b64: str, clave: str) -> bool:
    b = base64.b64decode(hash_b64)
    if b[0] != 1:
        return False
    prf, it, ls = struct.unpack(">III", b[1:13])
    if prf != 2:
        return False
    sal, esperado = b[13:13 + ls], b[13 + ls:]
    return hmac.compare_digest(hashlib.pbkdf2_hmac("sha512", clave.encode("utf-8"), sal, it, len(esperado)), esperado)
