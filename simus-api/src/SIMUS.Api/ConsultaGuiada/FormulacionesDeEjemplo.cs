namespace SIMUS.Api.ConsultaGuiada;

/// <summary>Dónde se responde una pregunta del catálogo. Lo fija el ENDPOINT, nunca el texto de quien pregunta.</summary>
public static class AmbitoDelCatalogo
{
    /// <summary>El portal: solo registros publicados, sin sesión.</summary>
    public const string Publico = "publico";
}

/// <summary>
/// Las formulaciones de ejemplo de cada pregunta del banco público, para precalcular sus vectores en la capa semántica
/// (fase 2 de <c>plan-consulta-guiada-semantica.md</c>). Sirven SOLO para emparejar una frase con una plantilla verificada;
/// el modelo nunca redacta cifras. Cada pregunta lleva entre 3 y 6, con sinónimos reales («lutería», «luthier», «redes»).
/// El texto canónico de la pregunta es su <c>Rotulo</c>.
/// </summary>
public static class FormulacionesDeEjemplo
{
    private static readonly Dictionary<string, string[]> Fijas = new()
    {
        ["publica_procesos_por_tipo"] = ["cuántos procesos hay publicados", "cuántos festivales, mercados y talleres hay", "total de procesos del portal", "resumen del ecosistema por tipo"],
        ["publica_festivales_por_departamento"] = ["en qué departamentos hay festivales", "festivales por departamento", "cuántos festivales hay por región", "dónde hay más festivales"],
        ["publica_festivales_por_municipio"] = ["en qué municipios hay más festivales", "ciudades con más festivales", "festivales por municipio", "municipios con festivales"],
        ["publica_festivales_por_practica"] = ["qué prácticas musicales tienen los festivales", "festivales por práctica musical", "qué músicas se tocan en los festivales", "cuántos festivales por género"],
        ["publica_festivales_por_territorio_sonoro"] = ["qué territorios sonoros recogen los festivales", "festivales por territorio sonoro", "territorios sonoros con más festivales"],
        ["publica_festivales_por_periodicidad"] = ["cada cuánto se hacen los festivales", "festivales anuales", "periodicidad de los festivales", "con qué frecuencia se realizan"],
        ["publica_mercados_por_departamento"] = ["en qué departamentos hay mercados musicales", "mercados por departamento", "cuántos mercados hay por región", "dónde hay mercados de música"],
        ["publica_agenda_proxima"] = ["qué hay en la agenda", "próximos eventos", "qué eventos vienen", "qué pasa pronto", "agenda de conciertos"],
        ["publica_agenda_por_departamento"] = ["en qué departamentos hay eventos próximos", "eventos próximos por departamento", "dónde habrá eventos", "agenda por región"],
        ["publica_noticias_recientes"] = ["cuáles son las noticias más recientes", "últimas noticias", "novedades del portal", "qué hay de nuevo"],
        ["publica_practicas_musicales"] = ["qué prácticas musicales reconoce el portal", "lista de prácticas musicales", "géneros y prácticas registrados", "catálogo de prácticas"],
        ["publica_procesos_por_departamento"] = ["cuántos procesos hay por departamento", "procesos publicados por departamento y tipo", "qué departamentos tienen más procesos", "cobertura del ecosistema por región"],
        ["publica_agenda_por_mes"] = ["cuántos eventos hay cada mes", "eventos por mes", "en qué meses hay más eventos", "calendario de eventos del año"],
        ["publica_organizaciones_con_mas_procesos"] = ["qué organizaciones tienen más procesos", "organizaciones más activas", "quién tiene más festivales o mercados", "ranking de organizaciones"],
        ["publica_completitud_del_dato"] = ["qué tan completo está el dato", "qué tan completa es la información", "cuántos procesos declaran su municipio", "calidad de los datos publicados"],
        ["publica_procesos_en_departamento"] = ["qué hay publicado en Nariño", "procesos de un departamento", "qué hay en mi departamento", "cuántos procesos hay en Antioquia"],
        ["publica_procesos_en_municipio"] = ["qué hay publicado en Pasto", "procesos de un municipio", "qué hay en mi ciudad", "cuántos procesos hay en Medellín"],
        ["publica_festivales_con_practica"] = ["festivales con marimba", "qué festivales tienen chirimía", "festivales de una práctica musical", "dónde hay festivales de música llanera"],
        ["publica_festivales_con_territorio"] = ["festivales del territorio sonoro Pacífico", "qué festivales recogen un territorio sonoro", "festivales del Caribe sonoro"],
        ["publica_practicas_en_departamento"] = ["qué prácticas musicales hay en Nariño", "prácticas declaradas en un departamento", "qué músicas se practican en el Cauca"],
        ["publica_agenda_filtrada"] = ["eventos en Cali en diciembre", "qué eventos hay en Nariño", "eventos de mercados en Bogotá", "agenda de marzo de 2027", "próximos eventos de festivales en Antioquia"],
        ["publica_procesos_de_organizacion"] = ["qué procesos tiene una organización", "festivales y mercados de una corporación", "qué hace esta organización"],
    };

    private static readonly Dictionary<string, string> Sinonimos = new()
    {
        ["festivales"] = "festivales|encuentros de música|festivales musicales",
        ["mercados"] = "mercados musicales|mercados de música|ferias musicales",
        ["talleres"] = "talleres de lutería|talleres de luthier|lutieres",
        ["espacios"] = "espacios para música en vivo|lugares de música en vivo|bares con música en vivo",
        ["redes"] = "redes y centros de documentación|centros de documentación|archivos musicales",
    };

    /// <summary>Las formulaciones de una pregunta; vacío si el id no es del banco.</summary>
    public static IReadOnlyList<string> De(string id)
    {
        if (Fijas.TryGetValue(id, out var fijas)) return fijas;
        foreach (var (tipo, palabras) in Sinonimos)
        {
            var nombres = palabras.Split('|');
            if (id == $"publica_{tipo}_en_departamento")
                return [.. nombres.Take(3).Select(n => $"qué {n} hay en Nariño"), $"{nombres[0]} de un departamento", $"{nombres[0]} en Antioquia"];
            if (id == $"publica_{tipo}_en_municipio")
                return [.. nombres.Take(3).Select(n => $"qué {n} hay en Pasto"), $"{nombres[0]} de un municipio", $"{nombres[0]} en Medellín"];
            if (id == $"publica_{tipo}_por_departamento")
                return [.. nombres.Take(3).Select(n => $"cuántos {n} hay por departamento"), $"{nombres[0]} por región"];
        }

        return [];
    }
}
