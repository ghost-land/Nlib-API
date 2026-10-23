/**
 * Normalize 3DS region labels to 3dsdb ISO / market codes.
 * Canonical output: uppercase (JP, US, EU, FR, DE, GB, FREE, …).
 */

const REGION_ALIASES = new Map([
  // Japan
  ['japan', 'JP'], ['jp', 'JP'],
  // Americas
  ['north america', 'US'], ['usa', 'US'], ['united states', 'US'],
  ['us', 'US'], ['na', 'US'], ['canada', 'CA'], ['ca', 'CA'],
  ['brazil', 'BR'], ['br', 'BR'],
  // Europe / UK
  ['europe', 'EU'], ['eu', 'EU'], ['eur', 'EU'],
  ['france', 'FR'], ['fr', 'FR'],
  ['germany', 'DE'], ['de', 'DE'], ['deutschland', 'DE'],
  ['united kingdom', 'GB'], ['the united kingdom', 'GB'],
  ['uk', 'GB'], ['gb', 'GB'], ['great britain', 'GB'],
  ['italy', 'IT'], ['it', 'IT'],
  ['spain', 'ES'], ['es', 'ES'],
  ['the netherlands', 'NL'], ['netherlands', 'NL'], ['nl', 'NL'], ['holland', 'NL'],
  ['portugal', 'PT'], ['pt', 'PT'],
  ['russia', 'RU'], ['ru', 'RU'],
  // Asia-Pacific
  ['australia', 'AU'], ['au', 'AU'],
  ['china', 'CN'], ['cn', 'CN'],
  ['korea', 'KR'], ['south korea', 'KR'], ['kr', 'KR'],
  ['taiwan', 'TW'], ['tw', 'TW'],
  ['hong kong', 'HK'], ['hk', 'HK'],
  // Special
  ['region free', 'FREE'], ['region-free', 'FREE'], ['world', 'FREE'],
  ['rf', 'FREE'], ['free', 'FREE'],
  ['unknown', 'UNKNOWN'], ['unknownother', 'UNKNOWN'],
  ['unknown-other', 'UNKNOWN'], ['other', 'UNKNOWN']
])

/**
 * @param {string|null|undefined} region
 * @returns {string|null}
 */
export function normalizeCtrRegion(region) {
  if (region == null) return null
  const trimmed = String(region).trim()
  if (!trimmed) return null

  const alias = REGION_ALIASES.get(trimmed.toLowerCase())
  if (alias) return alias

  return trimmed.toUpperCase()
}
