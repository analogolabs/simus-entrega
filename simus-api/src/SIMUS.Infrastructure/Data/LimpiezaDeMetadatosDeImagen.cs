using System.Buffers.Binary;

namespace SIMUS.Infrastructure.Data;

/// <summary>
/// Quita de una imagen subida los metadatos que delatan a quien la hizo (S-03): EXIF con GPS, XMP,
/// IPTC, comentarios y fechas. Sin dependencias: recorre la estructura de contenedor y copia solo lo
/// que se queda. <b>No decodifica ni reencoda un píxel</b>, así que la imagen no pierde calidad y la
/// bomba de descompresión sigue sin dónde explotar.
/// <para>
/// Se conserva lo que cambia cómo se ve la imagen: el perfil de color ICC, el marcador Adobe (APP14)
/// del JPEG, y en PNG todos los chunks de imagen. Si no hay nada que quitar se devuelven los mismos
/// bytes (misma referencia), para que la huella de un archivo limpio no cambie.
/// </para>
/// </summary>
public static class LimpiezaDeMetadatosDeImagen
{
    /// <summary>
    /// Devuelve la imagen sin metadatos, o <c>null</c> si la estructura no se deja recorrer (se trata
    /// como imagen inválida: no se guarda lo que no se puede limpiar).
    /// </summary>
    public static byte[]? Limpiar(byte[] datos, string mime) => mime switch
    {
        "image/jpeg" => LimpiarJpeg(datos),
        "image/png" => LimpiarPng(datos),
        "image/webp" => LimpiarWebp(datos),
        _ => null,
    };

    private static byte[]? LimpiarJpeg(byte[] d)
    {
        if (d.Length < 4 || d[0] != 0xFF || d[1] != 0xD8)
        {
            return null;
        }

        var salida = new MemoryStream(d.Length);
        salida.Write(d, 0, 2);
        var quitado = false;
        var i = 2;
        while (i < d.Length)
        {
            if (d[i] != 0xFF)
            {
                return null;
            }

            if (i + 1 >= d.Length)
            {
                return null;
            }

            var m = d[i + 1];

            if (m == 0xFF)
            {
                i++; // relleno
                continue;
            }

            if (m == 0xD9)
            {
                salida.Write(d, i, d.Length - i);
                i = d.Length;
                break;
            }

            if (m == 0x01 || m is >= 0xD0 and <= 0xD8)
            {
                salida.Write(d, i, 2);
                i += 2;
                continue;
            }

            if (i + 4 > d.Length)
            {
                return null;
            }

            var longitud = BinaryPrimitives.ReadUInt16BigEndian(d.AsSpan(i + 2, 2));
            if (longitud < 2 || i + 2 + longitud > d.Length)
            {
                return null;
            }

            var fin = i + 2 + longitud;
            if (DebeQuitarseJpeg(m, d.AsSpan(i + 4, longitud - 2)))
            {
                quitado = true;
            }
            else
            {
                salida.Write(d, i, fin - i);
            }

            i = fin;
            if (m == 0xDA)
            {
                // Datos comprimidos: se copian hasta el siguiente marcador real.
                var inicio = i;
                while (i + 1 < d.Length && !(d[i] == 0xFF && d[i + 1] != 0x00 && d[i + 1] is not (>= 0xD0 and <= 0xD7) && d[i + 1] != 0xFF))
                {
                    i++;
                }

                if (i + 1 >= d.Length)
                {
                    return null;
                }

                salida.Write(d, inicio, i - inicio);
            }
        }

        return quitado ? salida.ToArray() : d;
    }

    private static bool DebeQuitarseJpeg(byte marcador, ReadOnlySpan<byte> carga)
    {
        if (marcador == 0xFE)
        {
            return true; // comentario
        }

        return marcador switch
        {
            0xE0 => false, // JFIF
            0xEE => false, // Adobe: transformación de color
            0xE2 => !carga.StartsWith("ICC_PROFILE\0"u8), // ICC sí; MPF y demás no
            >= 0xE1 and <= 0xEF => true, // EXIF/XMP (E1), IPTC/Photoshop (ED), fabricantes
            _ => false,
        };
    }

    private static readonly string[] ChunksPngAQuitar = ["eXIf", "tEXt", "iTXt", "zTXt", "tIME"];

    private static byte[]? LimpiarPng(byte[] d)
    {
        if (d.Length < 33)
        {
            return null;
        }

        var salida = new MemoryStream(d.Length);
        salida.Write(d, 0, 8);
        var quitado = false;
        var i = 8;
        var fin = false;
        while (i < d.Length)
        {
            if (i + 12 > d.Length)
            {
                return null;
            }

            var largo = BinaryPrimitives.ReadUInt32BigEndian(d.AsSpan(i, 4));
            if (largo > int.MaxValue || i + 12L + largo > d.Length)
            {
                return null;
            }

            var total = 12 + (int)largo;
            var tipo = System.Text.Encoding.ASCII.GetString(d, i + 4, 4);
            if (Array.IndexOf(ChunksPngAQuitar, tipo) >= 0)
            {
                quitado = true;
            }
            else
            {
                salida.Write(d, i, total);
            }

            i += total;
            if (tipo == "IEND")
            {
                fin = true;
                break;
            }
        }

        if (!fin)
        {
            return null;
        }

        return quitado ? salida.ToArray() : d;
    }

    private static byte[]? LimpiarWebp(byte[] d)
    {
        if (d.Length < 30)
        {
            return null;
        }

        var salida = new MemoryStream(d.Length);
        salida.Write(d, 0, 12);
        var quitado = false;
        var i = 12;
        while (i < d.Length)
        {
            if (i + 8 > d.Length)
            {
                return null;
            }

            var largo = BinaryPrimitives.ReadUInt32LittleEndian(d.AsSpan(i + 4, 4));
            var total = 8L + largo + (largo & 1);
            if (i + total > d.Length)
            {
                // El último chunk puede venir sin su byte de relleno.
                if (i + 8L + largo != d.Length)
                {
                    return null;
                }

                total = d.Length - i;
            }

            var tipo = System.Text.Encoding.ASCII.GetString(d, i, 4);
            if (tipo is "EXIF" or "XMP ")
            {
                quitado = true;
            }
            else
            {
                salida.Write(d, i, (int)total);
            }

            i += (int)total;
        }

        if (!quitado)
        {
            return d;
        }

        var r = salida.ToArray();
        BinaryPrimitives.WriteUInt32LittleEndian(r.AsSpan(4, 4), (uint)(r.Length - 8));
        // VP8X: se apagan las banderas de EXIF (0x08) y XMP (0x04) del primer chunk.
        if (r.Length > 20 && r[12] == (byte)'V' && r[13] == (byte)'P' && r[14] == (byte)'8' && r[15] == (byte)'X')
        {
            r[20] = (byte)(r[20] & ~0x0C);
        }

        return r;
    }
}
