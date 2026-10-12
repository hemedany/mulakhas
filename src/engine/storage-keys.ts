// Every localStorage key Mulakhas reads or writes, in one place.
//
// v2 keys carry an `m2.` prefix so they never collide with v1's. v1's keys are only ever
// read (by the migration), never written, so rolling back to v1 finds its data untouched.

export const V1_KEYS = {
  history: 'hist',
  uiLang: 'uiLang',
  theme: 'theme',
  geminiKey: 'gemKey',
  tutorialSeen: 'tutSeen',
} as const

export const KEYS = {
  uiLang: 'm2.uiLang',
  theme: 'm2.theme',
  wasV1User: 'm2.wasV1User',
  migratedFromV1: 'm2.migratedFromV1',
  groqKey: 'm2.groqKey',
  geminiKey: 'm2.geminiKey',
} as const
