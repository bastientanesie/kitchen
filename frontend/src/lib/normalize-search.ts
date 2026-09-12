const ligatures: Record<string, string> = {
  œ: 'oe',
  Œ: 'oe',
  æ: 'ae',
  Æ: 'ae',
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g

export function normalizeForSearch(value: string): string {
  const withoutLigatures = value.replace(/[œŒæÆ]/g, (char) => ligatures[char])
  return withoutLigatures.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase().trim()
}
