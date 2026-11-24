/*
    SIMUS · Idiomas: ampliacion desde el minuto uno y activacion de las lenguas por verificar

    QUE HACE (decision del usuario, 7-oct-2026: «que quede lo mas amplio posible desde el minuto uno» y «todos
    estos elementos que estan por verificar yo creo que los implementaria»).

      1. ACTIVA las nueve lenguas con codigo candidato sin confirmar (`Verificacion = por_verificar`). Siguen
         marcadas como por verificar —la columna dice con claridad que su codigo no esta confirmado— pero
         ya se pueden elegir.
      2. AMPLIA el catalogo con TODOS los idiomas que tienen codigo ISO 639-1 (dos letras) y todavia no
         estaban: 174 idiomas mas, para un total de 266. Asi cualquier publicacion, agente o
         contenido en un idioma de uso general se puede registrar sin pedir una carga nueva.

    DE DONDE SALE CADA DATO (consultado el 7-oct-2026)
      - Codigo ISO 639-3, nombre de referencia (`NombreSil`), equivalencia ISO 639-1, codigo MARC (ISO 639-2/B)
        y alcance (individual o macrolengua): tabla oficial de SIL Global `iso-639-3.tab`.
      - Nombre en espanol (`NombreIdioma`): Unicode CLDR 48 (`cldr-localenames-full`, locale `es`), con la
        primera letra en mayuscula. Los 174 idiomas tienen nombre en CLDR y ninguno choca con otro.
      - Etiqueta BCP 47: la de dos letras (todos tienen).
      - `Ambito = extranjero`: son los idiomas que no son el espanol ni lenguas de Colombia. Algunos son
        macrolenguas (por ejemplo arabe, chino, quechua): `AlcanceIso = M`.

    NOTA SOBRE NOMBRES ALTERNOS. Se evaluo una tabla de alias (por ejemplo «guajiro» para wayuu). El indice de
    nombres de SIL trae alternos solo para 43 idiomas (62 nombres) y ninguno para las lenguas colombianas, asi
    que no se crea: la busqueda usa los tres nombres que ya guarda el catalogo (`NombreIdioma`, `NombreSil`
    y `NombreOficialColombia`) y el codigo.

    Idempotente. No cambia estructura.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Las lenguas por verificar se pueden elegir; siguen marcadas como por verificar.
UPDATE dbo.Idiomas SET Activo = 1 WHERE Verificacion = N'por_verificar' AND Activo = 0;
GO

-- 2. Todos los idiomas con codigo ISO 639-1.
INSERT INTO dbo.Idiomas (CodigoIdioma, CodigoIso6391, CodigoMarc, CodigoMarcGrupo, EtiquetaBcp47, NombreIdioma, NombreSil,
                         NombreOficialColombia, AlcanceIso, Ambito, Verificacion, Descripcion, OrdenVisualizacion, Activo, OrigenCodigo)
SELECT v.CodigoIdioma, v.CodigoIso6391, v.CodigoMarc, NULL, v.EtiquetaBcp47, v.NombreIdioma, v.NombreSil,
       NULL, v.AlcanceIso, N'extranjero', N'verificado', NULL, v.OrdenVisualizacion, 1, N'iso639_3'
FROM (VALUES
    (N'abk', N'ab', N'abk', N'ab', N'Abjasio', N'Abkhazian', N'I', 93),
    (N'aar', N'aa', N'aar', N'aa', N'Afar', N'Afar', N'I', 94),
    (N'afr', N'af', N'afr', N'af', N'Afrikáans', N'Afrikaans', N'I', 95),
    (N'aym', N'ay', N'aym', N'ay', N'Aimara', N'Aymara', N'M', 96),
    (N'aka', N'ak', N'aka', N'ak', N'Akan', N'Akan', N'M', 97),
    (N'sqi', N'sq', N'alb', N'sq', N'Albanés', N'Albanian', N'M', 98),
    (N'amh', N'am', N'amh', N'am', N'Amárico', N'Amharic', N'I', 99),
    (N'ara', N'ar', N'ara', N'ar', N'Árabe', N'Arabic', N'M', 100),
    (N'arg', N'an', N'arg', N'an', N'Aragonés', N'Aragonese', N'I', 101),
    (N'hye', N'hy', N'arm', N'hy', N'Armenio', N'Armenian', N'I', 102),
    (N'asm', N'as', N'asm', N'as', N'Asamés', N'Assamese', N'I', 103),
    (N'ava', N'av', N'ava', N'av', N'Avar', N'Avaric', N'I', 104),
    (N'ave', N'ae', N'ave', N'ae', N'Avéstico', N'Avestan', N'I', 105),
    (N'aze', N'az', N'aze', N'az', N'Azerbaiyano', N'Azerbaijani', N'M', 106),
    (N'bam', N'bm', N'bam', N'bm', N'Bambara', N'Bambara', N'I', 107),
    (N'bak', N'ba', N'bak', N'ba', N'Baskir', N'Bashkir', N'I', 108),
    (N'ben', N'bn', N'ben', N'bn', N'Bengalí', N'Bengali', N'I', 109),
    (N'bel', N'be', N'bel', N'be', N'Bielorruso', N'Belarusian', N'I', 110),
    (N'mya', N'my', N'bur', N'my', N'Birmano', N'Burmese', N'I', 111),
    (N'bis', N'bi', N'bis', N'bi', N'Bislama', N'Bislama', N'I', 112),
    (N'bos', N'bs', N'bos', N'bs', N'Bosnio', N'Bosnian', N'I', 113),
    (N'bre', N'br', N'bre', N'br', N'Bretón', N'Breton', N'I', 114),
    (N'bul', N'bg', N'bul', N'bg', N'Búlgaro', N'Bulgarian', N'I', 115),
    (N'kas', N'ks', N'kas', N'ks', N'Cachemir', N'Kashmiri', N'I', 116),
    (N'kan', N'kn', N'kan', N'kn', N'Canarés', N'Kannada', N'I', 117),
    (N'cha', N'ch', N'cha', N'ch', N'Chamorro', N'Chamorro', N'I', 118),
    (N'che', N'ce', N'che', N'ce', N'Checheno', N'Chechen', N'I', 119),
    (N'ces', N'cs', N'cze', N'cs', N'Checo', N'Czech', N'I', 120),
    (N'zho', N'zh', N'chi', N'zh', N'Chino', N'Chinese', N'M', 121),
    (N'chv', N'cv', N'chv', N'cv', N'Chuvasio', N'Chuvash', N'I', 122),
    (N'sin', N'si', N'sin', N'si', N'Cingalés', N'Sinhala', N'I', 123),
    (N'kor', N'ko', N'kor', N'ko', N'Coreano', N'Korean', N'I', 124),
    (N'cor', N'kw', N'cor', N'kw', N'Córnico', N'Cornish', N'I', 125),
    (N'cos', N'co', N'cos', N'co', N'Corso', N'Corsican', N'I', 126),
    (N'cre', N'cr', N'cre', N'cr', N'Cree', N'Cree', N'M', 127),
    (N'hat', N'ht', N'hat', N'ht', N'Criollo haitiano', N'Haitian', N'I', 128),
    (N'hrv', N'hr', N'hrv', N'hr', N'Croata', N'Croatian', N'I', 129),
    (N'dan', N'da', N'dan', N'da', N'Danés', N'Danish', N'I', 130),
    (N'div', N'dv', N'div', N'dv', N'Divehi', N'Dhivehi', N'I', 131),
    (N'dzo', N'dz', N'dzo', N'dz', N'Dzongkha', N'Dzongkha', N'I', 132),
    (N'chu', N'cu', N'chu', N'cu', N'Eslavo eclesiástico', N'Church Slavic', N'I', 133),
    (N'slk', N'sk', N'slo', N'sk', N'Eslovaco', N'Slovak', N'I', 134),
    (N'slv', N'sl', N'slv', N'sl', N'Esloveno', N'Slovenian', N'I', 135),
    (N'epo', N'eo', N'epo', N'eo', N'Esperanto', N'Esperanto', N'I', 136),
    (N'est', N'et', N'est', N'et', N'Estonio', N'Estonian', N'M', 137),
    (N'eus', N'eu', N'baq', N'eu', N'Euskera', N'Basque', N'I', 138),
    (N'ewe', N'ee', N'ewe', N'ee', N'Ewé', N'Ewe', N'I', 139),
    (N'fao', N'fo', N'fao', N'fo', N'Feroés', N'Faroese', N'I', 140),
    (N'fin', N'fi', N'fin', N'fi', N'Finés', N'Finnish', N'I', 141),
    (N'fij', N'fj', N'fij', N'fj', N'Fiyiano', N'Fijian', N'I', 142),
    (N'fry', N'fy', N'fry', N'fy', N'Frisón occidental', N'Western Frisian', N'I', 143),
    (N'ful', N'ff', N'ful', N'ff', N'Fula', N'Fulah', N'M', 144),
    (N'gla', N'gd', N'gla', N'gd', N'Gaélico escocés', N'Scottish Gaelic', N'I', 145),
    (N'cym', N'cy', N'wel', N'cy', N'Galés', N'Welsh', N'I', 146),
    (N'glg', N'gl', N'glg', N'gl', N'Gallego', N'Galician', N'I', 147),
    (N'lug', N'lg', N'lug', N'lg', N'Ganda', N'Ganda', N'I', 148),
    (N'kat', N'ka', N'geo', N'ka', N'Georgiano', N'Georgian', N'I', 149),
    (N'ell', N'el', N'gre', N'el', N'Griego', N'Modern Greek (1453-)', N'I', 150),
    (N'kal', N'kl', N'kal', N'kl', N'Groenlandés', N'Kalaallisut', N'I', 151),
    (N'grn', N'gn', N'grn', N'gn', N'Guaraní', N'Guarani', N'M', 152),
    (N'guj', N'gu', N'guj', N'gu', N'Guyaratí', N'Gujarati', N'I', 153),
    (N'hau', N'ha', N'hau', N'ha', N'Hausa', N'Hausa', N'I', 154),
    (N'heb', N'he', N'heb', N'he', N'Hebreo', N'Hebrew', N'I', 155),
    (N'her', N'hz', N'her', N'hz', N'Herero', N'Herero', N'I', 156),
    (N'hin', N'hi', N'hin', N'hi', N'Hindi', N'Hindi', N'I', 157),
    (N'hmo', N'ho', N'hmo', N'ho', N'Hiri motu', N'Hiri Motu', N'I', 158),
    (N'hun', N'hu', N'hun', N'hu', N'Húngaro', N'Hungarian', N'I', 159),
    (N'ido', N'io', N'ido', N'io', N'Ido', N'Ido', N'I', 160),
    (N'ibo', N'ig', N'ibo', N'ig', N'Igbo', N'Igbo', N'I', 161),
    (N'ind', N'id', N'ind', N'id', N'Indonesio', N'Indonesian', N'I', 162),
    (N'ina', N'ia', N'ina', N'ia', N'Interlingua', N'Interlingua (IALA)', N'I', 163),
    (N'ile', N'ie', N'ile', N'ie', N'Interlingue', N'Interlingue', N'I', 164),
    (N'iku', N'iu', N'iku', N'iu', N'Inuktitut', N'Inuktitut', N'M', 165),
    (N'ipk', N'ik', N'ipk', N'ik', N'Inupiaq', N'Inupiaq', N'M', 166),
    (N'gle', N'ga', N'gle', N'ga', N'Irlandés', N'Irish', N'I', 167),
    (N'isl', N'is', N'ice', N'is', N'Islandés', N'Icelandic', N'I', 168),
    (N'jpn', N'ja', N'jpn', N'ja', N'Japonés', N'Japanese', N'I', 169),
    (N'jav', N'jv', N'jav', N'jv', N'Javanés', N'Javanese', N'I', 170),
    (N'khm', N'km', N'khm', N'km', N'Jemer', N'Khmer', N'I', 171),
    (N'kau', N'kr', N'kau', N'kr', N'Kanuri', N'Kanuri', N'M', 172),
    (N'kaz', N'kk', N'kaz', N'kk', N'Kazajo', N'Kazakh', N'I', 173),
    (N'kik', N'ki', N'kik', N'ki', N'Kikuyu', N'Kikuyu', N'I', 174),
    (N'kin', N'rw', N'kin', N'rw', N'Kinyarwanda', N'Kinyarwanda', N'I', 175),
    (N'kir', N'ky', N'kir', N'ky', N'Kirguís', N'Kirghiz', N'I', 176),
    (N'run', N'rn', N'run', N'rn', N'Kirundi', N'Rundi', N'I', 177),
    (N'kom', N'kv', N'kom', N'kv', N'Komi', N'Komi', N'M', 178),
    (N'kon', N'kg', N'kon', N'kg', N'Kongo', N'Kongo', N'M', 179),
    (N'kua', N'kj', N'kua', N'kj', N'Kuanyama', N'Kuanyama', N'I', 180),
    (N'kur', N'ku', N'kur', N'ku', N'Kurdo', N'Kurdish', N'M', 181),
    (N'lao', N'lo', N'lao', N'lo', N'Lao', N'Lao', N'I', 182),
    (N'lav', N'lv', N'lav', N'lv', N'Letón', N'Latvian', N'M', 183),
    (N'lim', N'li', N'lim', N'li', N'Limburgués', N'Limburgan', N'I', 184),
    (N'lin', N'ln', N'lin', N'ln', N'Lingala', N'Lingala', N'I', 185),
    (N'lit', N'lt', N'lit', N'lt', N'Lituano', N'Lithuanian', N'I', 186),
    (N'lub', N'lu', N'lub', N'lu', N'Luba-katanga', N'Luba-Katanga', N'I', 187),
    (N'ltz', N'lb', N'ltz', N'lb', N'Luxemburgués', N'Luxembourgish', N'I', 188),
    (N'mkd', N'mk', N'mac', N'mk', N'Macedonio', N'Macedonian', N'I', 189),
    (N'mal', N'ml', N'mal', N'ml', N'Malayálam', N'Malayalam', N'I', 190),
    (N'msa', N'ms', N'may', N'ms', N'Malayo', N'Malay (macrolanguage)', N'M', 191),
    (N'mlg', N'mg', N'mlg', N'mg', N'Malgache', N'Malagasy', N'M', 192),
    (N'mlt', N'mt', N'mlt', N'mt', N'Maltés', N'Maltese', N'I', 193),
    (N'glv', N'gv', N'glv', N'gv', N'Manés', N'Manx', N'I', 194),
    (N'mri', N'mi', N'mao', N'mi', N'Maorí', N'Maori', N'I', 195),
    (N'mar', N'mr', N'mar', N'mr', N'Maratí', N'Marathi', N'I', 196),
    (N'mah', N'mh', N'mah', N'mh', N'Marshalés', N'Marshallese', N'I', 197),
    (N'mon', N'mn', N'mon', N'mn', N'Mongol', N'Mongolian', N'M', 198),
    (N'nau', N'na', N'nau', N'na', N'Nauruano', N'Nauru', N'I', 199),
    (N'nav', N'nv', N'nav', N'nv', N'Navajo', N'Navajo', N'I', 200),
    (N'nbl', N'nr', N'nbl', N'nr', N'Ndebele meridional', N'South Ndebele', N'I', 201),
    (N'nde', N'nd', N'nde', N'nd', N'Ndebele septentrional', N'North Ndebele', N'I', 202),
    (N'ndo', N'ng', N'ndo', N'ng', N'Ndonga', N'Ndonga', N'I', 203),
    (N'nep', N'ne', N'nep', N'ne', N'Nepalí', N'Nepali (macrolanguage)', N'M', 204),
    (N'nor', N'no', N'nor', N'no', N'Noruego', N'Norwegian', N'M', 205),
    (N'nob', N'nb', N'nob', N'nb', N'Noruego bokmal', N'Norwegian Bokmål', N'I', 206),
    (N'nno', N'nn', N'nno', N'nn', N'Noruego nynorsk', N'Norwegian Nynorsk', N'I', 207),
    (N'nya', N'ny', N'nya', N'ny', N'Nyanja', N'Chichewa', N'I', 208),
    (N'oci', N'oc', N'oci', N'oc', N'Occitano', N'Occitan (post 1500)', N'I', 209),
    (N'oji', N'oj', N'oji', N'oj', N'Ojibwa', N'Ojibwa', N'M', 210),
    (N'ori', N'or', N'ori', N'or', N'Oriya', N'Oriya (macrolanguage)', N'M', 211),
    (N'orm', N'om', N'orm', N'om', N'Oromo', N'Oromo', N'M', 212),
    (N'oss', N'os', N'oss', N'os', N'Osético', N'Iron Ossetic', N'I', 213),
    (N'pli', N'pi', N'pli', N'pi', N'Pali', N'Pali', N'I', 214),
    (N'pus', N'ps', N'pus', N'ps', N'Pastún', N'Pushto', N'M', 215),
    (N'fas', N'fa', N'per', N'fa', N'Persa', N'Persian', N'M', 216),
    (N'pol', N'pl', N'pol', N'pl', N'Polaco', N'Polish', N'I', 217),
    (N'pan', N'pa', N'pan', N'pa', N'Punyabí', N'Panjabi', N'I', 218),
    (N'que', N'qu', N'que', N'qu', N'Quechua', N'Quechua', N'M', 219),
    (N'roh', N'rm', N'roh', N'rm', N'Romanche', N'Romansh', N'I', 220),
    (N'ron', N'ro', N'rum', N'ro', N'Rumano', N'Romanian', N'I', 221),
    (N'sme', N'se', N'sme', N'se', N'Sami septentrional', N'Northern Sami', N'I', 222),
    (N'smo', N'sm', N'smo', N'sm', N'Samoano', N'Samoan', N'I', 223),
    (N'sag', N'sg', N'sag', N'sg', N'Sango', N'Sango', N'I', 224),
    (N'san', N'sa', N'san', N'sa', N'Sánscrito', N'Sanskrit', N'M', 225),
    (N'srd', N'sc', N'srd', N'sc', N'Sardo', N'Sardinian', N'M', 226),
    (N'srp', N'sr', N'srp', N'sr', N'Serbio', N'Serbian', N'I', 227),
    (N'hbs', N'sh', NULL, N'sh', N'Serbocroata', N'Serbo-Croatian', N'M', 228),
    (N'tsn', N'tn', N'tsn', N'tn', N'Setsuana', N'Tswana', N'I', 229),
    (N'sna', N'sn', N'sna', N'sn', N'Shona', N'Shona', N'I', 230),
    (N'snd', N'sd', N'snd', N'sd', N'Sindi', N'Sindhi', N'I', 231),
    (N'som', N'so', N'som', N'so', N'Somalí', N'Somali', N'I', 232),
    (N'sot', N'st', N'sot', N'st', N'Sotho meridional', N'Southern Sotho', N'I', 233),
    (N'swa', N'sw', N'swa', N'sw', N'Suajili', N'Swahili (macrolanguage)', N'M', 234),
    (N'ssw', N'ss', N'ssw', N'ss', N'Suazi', N'Swati', N'I', 235),
    (N'swe', N'sv', N'swe', N'sv', N'Sueco', N'Swedish', N'I', 236),
    (N'sun', N'su', N'sun', N'su', N'Sundanés', N'Sundanese', N'I', 237),
    (N'tgl', N'tl', N'tgl', N'tl', N'Tagalo', N'Tagalog', N'I', 238),
    (N'tah', N'ty', N'tah', N'ty', N'Tahitiano', N'Tahitian', N'I', 239),
    (N'tha', N'th', N'tha', N'th', N'Tailandés', N'Thai', N'I', 240),
    (N'tam', N'ta', N'tam', N'ta', N'Tamil', N'Tamil', N'I', 241),
    (N'tat', N'tt', N'tat', N'tt', N'Tártaro', N'Tatar', N'I', 242),
    (N'tgk', N'tg', N'tgk', N'tg', N'Tayiko', N'Tajik', N'I', 243),
    (N'tel', N'te', N'tel', N'te', N'Telugu', N'Telugu', N'I', 244),
    (N'bod', N'bo', N'tib', N'bo', N'Tibetano', N'Tibetan', N'I', 245),
    (N'tir', N'ti', N'tir', N'ti', N'Tigriña', N'Tigrinya', N'I', 246),
    (N'ton', N'to', N'ton', N'to', N'Tongano', N'Tonga (Tonga Islands)', N'I', 247),
    (N'tso', N'ts', N'tso', N'ts', N'Tsonga', N'Tsonga', N'I', 248),
    (N'tur', N'tr', N'tur', N'tr', N'Turco', N'Turkish', N'I', 249),
    (N'tuk', N'tk', N'tuk', N'tk', N'Turcomano', N'Turkmen', N'I', 250),
    (N'twi', N'tw', N'twi', N'tw', N'Twi', N'Twi', N'I', 251),
    (N'ukr', N'uk', N'ukr', N'uk', N'Ucraniano', N'Ukrainian', N'I', 252),
    (N'uig', N'ug', N'uig', N'ug', N'Uigur', N'Uighur', N'I', 253),
    (N'urd', N'ur', N'urd', N'ur', N'Urdu', N'Urdu', N'I', 254),
    (N'uzb', N'uz', N'uzb', N'uz', N'Uzbeko', N'Uzbek', N'M', 255),
    (N'wln', N'wa', N'wln', N'wa', N'Valón', N'Walloon', N'I', 256),
    (N'ven', N've', N'ven', N've', N'Venda', N'Venda', N'I', 257),
    (N'vie', N'vi', N'vie', N'vi', N'Vietnamita', N'Vietnamese', N'I', 258),
    (N'vol', N'vo', N'vol', N'vo', N'Volapük', N'Volapük', N'I', 259),
    (N'wol', N'wo', N'wol', N'wo', N'Wólof', N'Wolof', N'I', 260),
    (N'xho', N'xh', N'xho', N'xh', N'Xhosa', N'Xhosa', N'I', 261),
    (N'iii', N'ii', N'iii', N'ii', N'Yi de Sichuán', N'Sichuan Yi', N'I', 262),
    (N'yid', N'yi', N'yid', N'yi', N'Yidis', N'Yiddish', N'M', 263),
    (N'yor', N'yo', N'yor', N'yo', N'Yoruba', N'Yoruba', N'I', 264),
    (N'zha', N'za', N'zha', N'za', N'Zhuang', N'Zhuang', N'M', 265),
    (N'zul', N'zu', N'zul', N'zu', N'Zulú', N'Zulu', N'I', 266)
) AS v (CodigoIdioma, CodigoIso6391, CodigoMarc, EtiquetaBcp47, NombreIdioma, NombreSil, AlcanceIso, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Idiomas t WHERE t.CodigoIdioma = v.CodigoIdioma);
GO
