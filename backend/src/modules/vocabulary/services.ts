import { COLLECTIONS, getCollection } from '../../db'
import { httpError, nowIso } from '../../http'
import vocabularyJson from '../../data/vocabulary.json'

export type Word = { vocab: string; pronunciation: string; POS: string; definition: string; [k: string]: unknown }
type Progress = { user_id: string; vocab: string; status?: string; correct_count?: number; wrong_count?: number; updated_at?: string }
export type Status = 'unlearned' | 'learning' | 'mastered'
const STATUSES: Status[] = ['learning', 'mastered', 'unlearned']

type VocabCache = { list: Word[]; byWord: Map<string, Word>; uniquePos: string[] }
const g = globalThis as typeof globalThis & { __practiceHubVocab?: Promise<VocabCache> }

/** Words from MongoDB, or the bundled vocabulary.json when the DB has none. Cached per instance. */
async function loadVocab(): Promise<VocabCache> {
  const list: Word[] = []
  const byWord = new Map<string, Word>()

  try {
    const coll = await getCollection<Word>(COLLECTIONS.vocabulary)
    for (const doc of coll ? await coll.find({}, { projection: { _id: 0 } }).toArray() : []) {
      const word = String(doc.vocab ?? '').trim()
      if (!word) continue
      list.push(doc)
      byWord.set(word.toLowerCase(), doc)
    }
  } catch (err) {
    console.error('Error loading vocabulary from MongoDB:', err)
  }

  if (!list.length) {
    for (const item of vocabularyJson as Partial<Word>[]) {
      const word = String(item.vocab ?? '').trim()
      const key = word.toLowerCase()
      if (!word || byWord.has(key)) continue
      const standardized: Word = {
        vocab: word,
        pronunciation: String(item.pronunciation ?? '').trim(),
        POS: String(item.POS ?? '').trim(),
        definition: String(item.definition ?? '').trim(),
      }
      list.push(standardized)
      byWord.set(key, standardized)
    }
  }

  const uniquePos = [...new Set(list.map(w => w.POS).filter(Boolean))].sort()
  return { list, byWord, uniquePos }
}

export function getVocab(): Promise<VocabCache> {
  g.__practiceHubVocab ??= loadVocab().catch(err => {
    g.__practiceHubVocab = undefined
    throw err
  })
  return g.__practiceHubVocab
}

async function progressCollection() {
  return getCollection<Progress>(COLLECTIONS.vocabularyProgress)
}

async function progressMap(userId: string): Promise<Map<string, Progress>> {
  const map = new Map<string, Progress>()
  const coll = await progressCollection()
  if (!coll || !userId) return map
  for (const r of await coll.find({ user_id: userId }).toArray()) map.set(String(r.vocab).toLowerCase(), r)
  return map
}

const withProgress = (item: Word, prog: Progress | undefined) => ({
  ...item,
  status: prog?.status ?? 'unlearned',
  correct_count: prog?.correct_count ?? 0,
  wrong_count: prog?.wrong_count ?? 0,
})

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

export async function getVocabularyList(
  userId: string,
  opts: { search?: string; pos?: string; status?: string; page: number; limit: number },
) {
  const { list } = await getVocab()
  let filtered = list
  if (opts.search) {
    const q = opts.search.toLowerCase().trim()
    filtered = filtered.filter(w => w.vocab.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q))
  }
  if (opts.pos) {
    const pos = opts.pos.toLowerCase().trim()
    filtered = filtered.filter(w => w.POS.toLowerCase() === pos)
  }

  const progress = await progressMap(userId)
  const wanted = opts.status?.toLowerCase().trim()
  const final = filtered
    .map(w => withProgress(w, progress.get(w.vocab.toLowerCase())))
    .filter(w => !wanted || !STATUSES.includes(wanted as Status) || w.status === wanted)

  const start = (opts.page - 1) * opts.limit
  return { total: final.length, page: opts.page, limit: opts.limit, items: final.slice(start, start + opts.limit) }
}

export async function getStats(userId: string) {
  const { list, byWord, uniquePos } = await getVocab()
  const stats = {
    total_words: list.length,
    mastered_count: 0,
    learning_count: 0,
    studied_count: 0,
    accuracy: 0,
    total_correct: 0,
    total_wrong: 0,
    unique_pos: uniquePos,
    studied_pos: [] as string[],
  }
  const coll = await progressCollection()
  if (!coll || !userId) return stats

  const studiedPos = new Set<string>()
  for (const doc of await coll.find({ user_id: userId }).toArray()) {
    if (doc.status === 'mastered') stats.mastered_count++
    else if (doc.status === 'learning') {
      stats.learning_count++
      stats.studied_count++
      const pos = byWord.get(String(doc.vocab ?? '').trim().toLowerCase())?.POS
      if (pos) studiedPos.add(pos)
    }
    stats.total_correct += doc.correct_count ?? 0
    stats.total_wrong += doc.wrong_count ?? 0
  }
  stats.studied_pos = [...studiedPos].sort()
  const attempts = stats.total_correct + stats.total_wrong
  if (attempts > 0) stats.accuracy = Math.round((stats.total_correct / attempts) * 100)
  return stats
}

export async function getPracticeWords(userId: string, mode = 'random', pos: string | undefined, limit = 15) {
  const { list } = await getVocab()
  const source = pos ? list.filter(w => w.POS.toLowerCase() === pos.toLowerCase().trim()) : list
  if (!source.length) return []

  const progress = await progressMap(userId)
  const statusOf = (w: Word) => progress.get(w.vocab.toLowerCase())?.status
  // Mastered words are excluded from all practice.
  const eligible = source.filter(w => statusOf(w) !== 'mastered')
  const selected = mode === 'studied'
    ? shuffle(eligible.filter(w => statusOf(w) === 'learning')).slice(0, limit)
    : shuffle([...eligible]).slice(0, limit)

  return shuffle(selected.map(w => withProgress(w, progress.get(w.vocab.toLowerCase()))))
}

export async function updateProgress(userId: string, vocab: string, status?: string | null, isCorrect?: boolean | null) {
  const { byWord } = await getVocab()
  const key = vocab.toLowerCase().trim()
  const word = byWord.get(key)
  if (!word) throw httpError(404, `Word '${vocab}' not found in vocabulary directory`)

  const coll = await progressCollection()
  if (!coll) throw httpError(503, 'Database not available')

  const set: Partial<Progress> = { updated_at: nowIso() }
  if (status !== undefined && status !== null) {
    const value = status.trim().toLowerCase()
    if (!STATUSES.includes(value as Status)) {
      throw httpError(400, "Invalid status value. Must be 'learning', 'mastered' or 'unlearned'")
    }
    set.status = value
  }

  const inc: Partial<Record<'correct_count' | 'wrong_count', number>> = {}
  if (isCorrect !== undefined && isCorrect !== null) {
    // Answering a quiz moves an unlearned word into "learning".
    const existing = await coll.findOne({ user_id: userId, vocab: key })
    if ((existing?.status ?? 'unlearned') === 'unlearned') set.status = 'learning'
    inc[isCorrect ? 'correct_count' : 'wrong_count'] = 1
  }

  await coll.updateOne(
    { user_id: userId, vocab: key },
    Object.keys(inc).length ? { $set: set, $inc: inc } : { $set: set },
    { upsert: true },
  )
  const updated = await coll.findOne({ user_id: userId, vocab: key }, { projection: { _id: 0 } })
  return withProgress(word, updated ?? undefined)
}

export async function bulkUpdateProgress(userId: string, vocabs: string[], status: string) {
  const coll = await progressCollection()
  if (!coll) throw httpError(503, 'Database not available')
  const value = status.trim().toLowerCase()
  if (!STATUSES.includes(value as Status)) throw httpError(400, 'Invalid status value')

  const keys = vocabs.filter(Boolean).map(v => v.toLowerCase().trim())
  if (!keys.length) return { updated: 0 }
  const res = await coll.updateMany(
    { user_id: userId, vocab: { $in: keys } },
    { $set: { status: value, updated_at: nowIso() } },
  )
  return { updated: res.modifiedCount }
}
