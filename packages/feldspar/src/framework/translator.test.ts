import { Translator } from './translator'
import { Translatable } from './types/elements'

describe('Translator.translate', () => {
  const labels: Translatable = { translations: { en: 'Role', de: 'Rolle', nl: 'Rol' } }

  it('uses the requested translation', () => {
    expect(Translator.translate(labels, 'en')).toBe('Role')
    expect(Translator.translate(labels, 'de')).toBe('Rolle')
    expect(Translator.translate(labels, 'nl')).toBe('Rol')
  })

  it('falls back to Dutch when the requested locale is missing', () => {
    expect(Translator.translate(labels, 'it')).toBe('Rol')
  })

  it('falls back to the first translation when requested and Dutch locales are missing', () => {
    expect(Translator.translate({ translations: { de: 'Rolle', en: 'Role' } }, 'it')).toBe('Rolle')
  })

  it('keeps plain strings and intentionally empty translations', () => {
    expect(Translator.translate('Role', 'it')).toBe('Role')
    expect(Translator.translate({ translations: { it: '', nl: 'Rol' } }, 'it')).toBe('')
    expect(Translator.translate({ translations: { nl: '', en: 'Role' } }, 'it')).toBe('')
  })

  it('returns the placeholder when there are no translations', () => {
    expect(Translator.translate({ translations: {} }, 'it')).toBe('?text?')
  })

})
