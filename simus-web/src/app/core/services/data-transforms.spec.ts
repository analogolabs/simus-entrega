import { agendaRecordHasTag, extractEditorialYears, normalizeAgendaTags } from './data-transforms';

describe('transformaciones de datos compartidas', () => {
  it('normaliza etiquetas de Agenda sin asumir la forma de entrada', () => {
    expect(normalizeAgendaTags(['Jazz, Tradición', ['Territorio']]))
      .toEqual(['Jazz', 'Tradición', 'Territorio']);
    expect(normalizeAgendaTags({ etiquetas: ['no se infiere'] })).toEqual([]);
    expect(agendaRecordHasTag({ fields: { Tags: 'Jazz|Tradición' } }, 'tradición')).toBeTrue();
    expect(agendaRecordHasTag(null, 'jazz')).toBeFalse();
  });

  it('extrae años editoriales desde entradas desconocidas sin propagar valores inválidos', () => {
    expect(extractEditorialYears('2023–2025, 2025')).toEqual([2023, 2024, 2025]);
    expect(extractEditorialYears(undefined)).toEqual([]);
    expect(extractEditorialYears({ año: 2026 })).toEqual([]);
  });
});
