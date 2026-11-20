import { randomUUID } from 'node:crypto'
import { COLLECTIONS, getDb } from '../src/shared/database'
import { nowIso } from '../src/shared/http'
import { hashPassword } from '../src/modules/auth/auth.services'
import ieltsLayouts from '../src/data/ielts_layouts.json'
import toeicLayouts from '../src/data/toeic_layouts.json'
import ieltsAnswers from '../src/data/ielts_answers.json'
import toeicAnswers from '../src/data/toeic_answers.json'
import ieltsAudio from '../src/data/ielts_audio_assets.json'
import toeicAudio from '../src/data/toeic_audio_assets.json'
import r2Keys from '../src/data/r2_keys.json'
import users from '../src/data/users.json'
import vocabulary from '../src/data/vocabulary.json'

const flag = (name: string) => process.argv.includes(`--${name}`)
const option = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function requireDb() {
  const db = await getDb()
  if (!db) {
    console.error('Error: MongoDB is not available (check MONGODB_URI / DB_PASSWORD / DB_NAME).')
    process.exit(1)
  }
  return db
}

type Db = Awaited<ReturnType<typeof requireDb>>
const range = ([a, b]: number[]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

async function deleteData(db: Db) {
  console.log('\n--- Deleting Database Collections ---')
  for (const name of [
    COLLECTIONS.ieltsAudio, COLLECTIONS.ieltsLayouts, COLLECTIONS.ieltsAnswers,
    COLLECTIONS.toeicAudio, COLLECTIONS.toeicLayouts, COLLECTIONS.toeicAnswers,
    COLLECTIONS.histories, COLLECTIONS.vocabulary, COLLECTIONS.users, COLLECTIONS.r2Keys,
  ]) {
    const res = await db.collection(name).deleteMany({})
    console.log(`Deleted ${res.deletedCount} documents from '${name}' collection.`)
  }
}

async function step(label: string, fn: () => Promise<string>) {
  console.log(`Seeding ${label}...`)
  try {
    console.log(`  ${await fn()}`)
  } catch (err) {
    console.log(`  Error seeding ${label}: ${(err as Error).message}`)
  }
}

async function importData(db: Db) {
  console.log('\n--- Importing Seed Data ---')

  await step('Cambridge Layouts', async () => {
    const ops = Object.entries(ieltsLayouts as Record<string, Record<string, unknown>>)
      .filter(([book]) => Number(book) !== 20)
      .flatMap(([book, tests]) => Object.entries(tests).map(([test, layout]) => ({
        updateOne: { filter: { book: Number(book), test: Number(test) }, update: { $set: { layout } }, upsert: true },
      })))
    if (ops.length) await db.collection(COLLECTIONS.ieltsLayouts).bulkWrite(ops)
    return `Successfully imported ${ops.length} layouts from layouts mapping.`
  })

  await step('ETS Layouts', async () => {
    type Item = Record<string, number[]> & { test: number }
    const data = toeicLayouts as unknown as Record<string, { lc: Item[]; rc: Item[] }>
    const ops = []
    for (const yearKey of ['ETS 2024', 'ETS 2026']) {
      const year = Number(yearKey.split(' ').pop())
      for (let test = 1; test <= 10; test++) {
        const lc = data[yearKey]?.lc.find(i => i.test === test)
        const rc = data[yearKey]?.rc.find(i => i.test === test)
        if (!lc || !rc) continue
        const layout = {
          listening: [1, 2, 3, 4].map(n => ({ section: n, pages: range(lc[`part${n}`]) })),
          reading: [5, 6, 7].map(n => ({ passage: n, passage_pages: range(rc[`part${n}`]) })),
        }
        ops.push({ updateOne: { filter: { book: year, test }, update: { $set: { layout } }, upsert: true } })
      }
    }
    if (ops.length) await db.collection(COLLECTIONS.toeicLayouts).bulkWrite(ops)
    return `Successfully imported ${ops.length} ETS layouts.`
  })

  await step('Cambridge Solutions', async () => {
    const ops = []
    for (const [book, bookData] of Object.entries(ieltsAnswers as unknown as Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>)) {
      if (Number(book) === 20) continue
      for (const [testKey, testData] of Object.entries(bookData).filter(([k]) => k.startsWith('test_'))) {
        const toDict = (skill: Record<string, Record<string, unknown>> = {}) => {
          const out: Record<string, { answer: string; explanation: string }> = {}
          for (const section of Object.values(skill)) {
            for (const [q, ans] of Object.entries(section)) out[q.replace('Q', '').trim()] = { answer: String(ans).trim(), explanation: '' }
          }
          return out
        }
        const listening = toDict(testData.listening)
        const reading = toDict(testData.reading)
        if (!Object.keys(listening).length && !Object.keys(reading).length) continue
        ops.push({ updateOne: {
          filter: { book: Number(book), test: Number(testKey.replace('test_', '')) },
          update: { $set: { listening, reading } },
          upsert: true,
        } })
      }
    }
    if (ops.length) await db.collection(COLLECTIONS.ieltsAnswers).bulkWrite(ops)
    return `Successfully imported answers for ${ops.length} Cambridge tests.`
  })

  await step('ETS Answers', async () => {
    const ops = []
    for (const [year, tests] of Object.entries(toeicAnswers as Record<string, Record<string, { lc?: Record<string, unknown>; rc?: Record<string, unknown> }>>)) {
      for (const [test, t] of Object.entries(tests)) {
        const toDict = (a: Record<string, unknown> = {}) =>
          Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { answer: String(v).trim().toUpperCase(), explanation: '' }]))
        ops.push({ updateOne: {
          filter: { book: Number(year), test: Number(test) },
          update: { $set: { listening: toDict(t.lc), reading: toDict(t.rc) } },
          upsert: true,
        } })
      }
    }
    if (ops.length) await db.collection(COLLECTIONS.toeicAnswers).bulkWrite(ops)
    return `Successfully imported answers for ${ops.length} ETS tests.`
  })

  for (const [label, name, data] of [
    ['IELTS Audio Assets', COLLECTIONS.ieltsAudio, ieltsAudio],
    ['TOEIC Audio Assets', COLLECTIONS.toeicAudio, toeicAudio],
  ] as const) {
    await step(label, async () => {
      const ops = (data as { book: number; test_number: number; file_name: string }[]).map(a => ({
        updateOne: { filter: { book: a.book, test_number: a.test_number, file_name: a.file_name }, update: { $set: a }, upsert: true },
      }))
      if (ops.length) await db.collection(name).bulkWrite(ops)
      return `Successfully seeded ${ops.length} ${label}.`
    })
  }

  await step('R2 Keys mapping', async () => {
    const ops = Object.entries(r2Keys as Record<string, string>).map(([target_key, matched_key]) => ({
      updateOne: { filter: { target_key }, update: { $set: { matched_key } }, upsert: true },
    }))
    if (ops.length) await db.collection(COLLECTIONS.r2Keys).bulkWrite(ops)
    return `Successfully seeded ${ops.length} R2 key mappings.`
  })

  await step('Users', async () => {
    const coll = db.collection(COLLECTIONS.users)
    let count = 0
    for (const u of users as { email?: string; password?: string; name?: string }[]) {
      const email = (u.email ?? '').trim().toLowerCase()
      if (!email) continue
      const now = nowIso()
      const password_hash = await hashPassword(u.password ?? '')
      const existing = await coll.findOne({ email })
      if (existing) {
        await coll.updateOne({ email }, { $set: { name: (u.name ?? '').trim() || existing.name || '', password_hash, updated_at: now } })
      } else {
        await coll.insertOne({ id: randomUUID(), email, name: (u.name ?? '').trim(), password_hash, created_at: now, updated_at: now })
      }
      count++
    }
    return `Successfully seeded/updated ${count} users.`
  })

  await step('Vocabulary', async () => {
    const seen = new Set<string>()
    const ops = []
    for (const item of vocabulary as Record<string, string>[]) {
      const vocab = (item.vocab ?? '').trim()
      if (!vocab || seen.has(vocab.toLowerCase())) continue
      seen.add(vocab.toLowerCase())
      const doc = { vocab, pronunciation: (item.pronunciation ?? '').trim(), POS: (item.POS ?? '').trim(), definition: (item.definition ?? '').trim() }
      ops.push({ updateOne: { filter: { vocab }, update: { $set: doc }, upsert: true } })
    }
    if (ops.length) await db.collection(COLLECTIONS.vocabulary).bulkWrite(ops)
    return `Successfully processed/seeded ${ops.length} vocabulary items.`
  })

  console.log('\nDatabase sync complete!')
}

async function claimHistories(db: Db, emailRaw: string) {
  const email = emailRaw.trim().toLowerCase()
  const user = await db.collection(COLLECTIONS.users).findOne({ email })
  if (!user) {
    console.error(`No user with email ${email}`)
    process.exit(1)
  }
  const res = await db.collection(COLLECTIONS.histories).updateMany(
    { $or: [{ user_id: null }, { user_id: { $exists: false } }] },
    { $set: { user_id: user.id } },
  )
  console.log(`Assigned ${res.modifiedCount} legacy attempts to ${email}.`)
}

async function main() {
  const db = await requireDb()
  const claim = option('claim-histories')
  if (claim) return claimHistories(db, claim)
  if (flag('delete') || flag('delete-only')) await deleteData(db)
  if (!flag('delete-only')) await importData(db)
}

main().then(() => process.exit(0), err => {
  console.error(err)
  process.exit(1)
})
