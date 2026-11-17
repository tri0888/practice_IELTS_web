import { describe, expect, it } from 'vitest'
import { formatMongoUri } from '../src/shared/database'
import { buildMatchTiles, checkTranslationAnswer, formatClue } from '../src/modules/telegram/telegram.services'

describe('formatMongoUri', () => {
  it('replaces password and database name', () => {
    expect(formatMongoUri('mongodb+srv://bob:old@cluster.x/olddb?retryWrites=true', 'pw', 'ielts'))
      .toBe('mongodb+srv://bob:pw@cluster.x/ielts?retryWrites=true')
    expect(formatMongoUri('mongodb://host:27017', undefined, 'db')).toBe('mongodb://host:27017/db')
    expect(formatMongoUri(undefined)).toBeNull()
  })
})

describe('telegram helpers', () => {
  it('accepts any synonym EN->VI and exact word VI->EN', () => {
    expect(checkTranslationAnswer(' Táo ', 'quả táo; táo', 'en')).toBe(true)
    expect(checkTranslationAnswer('apples', 'apple', 'vi')).toBe(false)
    expect(checkTranslationAnswer('APPLE', 'apple', 'vi')).toBe(true)
  })

  it('formats clues', () => {
    expect(formatClue({ vocab: 'apple', pronunciation: '/ˈæp.əl/', POS: 'n' }, 'vi'))
      .toBe('🔍 Hint: a____ (5 letters)\n📖 Pronunciation: /ˈæp.əl/\n🔤 Type: (n)')
  })

  it('builds one word tile and one definition tile per word', () => {
    const tiles = buildMatchTiles([{ vocab: 'apple', POS: 'n', definition: 'táo' }, { vocab: 'run', POS: 'v', definition: 'chạy' }])
    expect(tiles).toHaveLength(4)
    expect(tiles.filter(t => t.match_id === 0).map(t => t.type).sort()).toEqual(['def', 'word'])
    expect(tiles.every(t => !t.matched)).toBe(true)
  })
})
