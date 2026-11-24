// Los colores de `color` DEBEN coincidir con `LAYER_ACCENTS` del componente del
// geovisor, que es lo que pinta los marcadores del mapa. Cuando discrepaban, la
// leyenda y la lista de capas afirmaban un color que el mapa no usaba: los
// festivales salian verdes en la lista y morados sobre el mapa.
// SOLO LAS CAPAS CON DATOS: los cinco procesos (festivales, mercados, lutería, espacios y redes y
// documentación) y la vista general. La de Escuelas de Música se retiró, porque ese proceso queda fuera
// por ahora; si se suma un proceso, se declara en `CATEGORIAS_ECOSISTEMA` y se añade aquí su capa.
export const MAP_LAYERS_CONFIG = [
  {
    id: 'general',
    layerKey: 'General',
    label: 'Vista general',
    // DICE LO QUE INTEGRA DE VERDAD: los cinco procesos con capa y la Agenda (que no es una capa).
    description: 'Integra los Festivales, los Mercados, las Redes y documentación, la Lutería, los Espacios para música en vivo y la Agenda de eventos en una lectura territorial única.',
    color: '#6d4a7b',
    defaultVisible: true,
    iconKey: 'layout-grid',
  },
  {
    id: 'festivales',
    layerKey: 'Festivales',
    label: 'Festivales',
    description: 'Procesos y eventos tipo festival registrados en el ecosistema.',
    color: '#7a2f97',
    defaultVisible: true,
    iconKey: 'party',
  },
  {
    id: 'agenda',
    layerKey: 'Agenda',
    label: 'Agenda',
    description: 'Eventos publicados de la Agenda, situados por el territorio que declaran.',
    // EL MISMO VERDE CON EL QUE EL PORTAL YA NOMBRA LA AGENDA en su navegación. Dos códigos de
    // color para lo mismo obligarían a aprendérselos los dos.
    color: '#00A849',
    defaultVisible: true,
    iconKey: 'calendar',
  },
  {
    id: 'mercados',
    layerKey: 'Mercados Musicales',
    label: 'Mercados',
    description: 'Mercados musicales y espacios de circulación/comercialización.',
    color: '#c88011',
    defaultVisible: true,
    iconKey: 'building',
  },
  {
    id: 'lutieres',
    layerKey: 'Lutieres',
    label: 'Lutería',
    description: 'Talleres de lutería: dónde se construyen, reparan y enseñan a hacer instrumentos.',
    // EL MISMO COLOR QUE `LAYER_ACCENTS` DEL GEOVISOR, que es el que pinta el mapa.
    color: '#109db5',
    defaultVisible: true,
    iconKey: 'wrench',
  },
  {
    id: 'espacios',
    layerKey: 'Espacios',
    label: 'Espacios',
    description: 'Espacios para música en vivo: bares, salas, teatros, casas de cultura y escenarios donde se presenta música.',
    // EL MISMO COLOR QUE `LAYER_ACCENTS` DEL GEOVISOR, que es el que pinta el mapa.
    color: '#5e5ceb',
    defaultVisible: true,
    iconKey: 'building',
  },
  {
    id: 'redes-de-documentacion',
    layerKey: 'Redes de Documentación',
    label: 'Redes doc.',
    description: 'Redes, archivos y centros de documentación musical: dónde están y cómo se consultan.',
    // EL MISMO COLOR QUE `LAYER_ACCENTS` DEL GEOVISOR, que es el que pinta el mapa.
    color: '#d33068',
    defaultVisible: true,
    iconKey: 'book',
  },
];

export const MAP_PANEL_IDS = {
  layers: 'layers',
  territory: 'territory',
  filters: 'filters',
  insights: 'insights',
  tutorial: 'tutorial',
  export: 'export',
  registration: 'registration',
};
