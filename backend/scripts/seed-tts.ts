import { spawn } from 'node:child_process'
import ffmpeg from '@ffmpeg-installer/ffmpeg'
import { Api, InputFile } from 'grammy'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { COLLECTIONS, getDb } from '../src/shared/database'
import { getVocab } from '../src/modules/vocabulary/vocabulary.services'
import { FLASHCARD_TTS_VOICE } from '../src/modules/telegram/telegram.services'
import { saveFlashcardFileId } from '../src/modules/telegram/telegram.repositories'

const option = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function synthMp3(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS()
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = tts.toStream(text)
    const chunks: Buffer[] = []
    for await (const chunk of audioStream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  } finally {
    tts.close()
  }
}

function mp3ToOggOpus(mp3: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg.path, [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '48000', '-f', 'ogg', 'pipe:1',
    ])
    const out: Buffer[] = []
    const err: Buffer[] = []
    proc.stdout.on('data', d => out.push(d))
    proc.stderr.on('data', d => err.push(d))
    proc.on('error', reject)
    proc.on('close', code => {
      const data = Buffer.concat(out)
      if (code !== 0 || !data.length) reject(new Error(`ffmpeg failed (code ${code}): ${Buffer.concat(err).toString().slice(0, 400)}`))
      else resolve(data)
    })
    proc.stdin.end(mp3)
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const chatId = Number((process.env.SEED_CHAT_ID ?? '').trim())
  if (!chatId) throw new Error('SEED_CHAT_ID is not set (your telegram numeric id)')
  const limit = Number(option('limit') ?? 0)
  const delayMs = Number(option('delay') ?? 1) * 1000
  const voice = FLASHCARD_TTS_VOICE()
  const botId = Number(token.split(':')[0])

  const db = await getDb()
  if (!db) throw new Error('MongoDB is not available (check MONGODB_URI / DB_PASSWORD / DB_NAME).')
  const coll = db.collection(COLLECTIONS.flashcardAudio)
  await coll.createIndex({ bot_id: 1, vocab: 1, voice: 1 }, { unique: true })

  const words = (await getVocab()).list.map(w => w.vocab.trim()).filter(Boolean)
  const already = new Set((await coll.find({ bot_id: botId, voice }, { projection: { vocab: 1 } }).toArray()).map(d => d.vocab as string))
  let todo = words.filter(w => !already.has(w.toLowerCase()))
  if (limit > 0) todo = todo.slice(0, limit)

  console.log(`Bot id       : ${botId}\nVoice        : ${voice}\nSeed chat_id : ${chatId}`)
  console.log(`Total words  : ${words.length} | already cached: ${already.size} | to seed: ${todo.length}`)
  if (!todo.length) return console.log('Nothing to seed. Done.')

  const api = new Api(token)
  const me = await api.getMe()
  console.log(`Authenticated as @${me.username} (id=${me.id})\n`)

  let ok = 0
  let failed = 0
  for (const [i, word] of todo.entries()) {
    try {
      const ogg = await mp3ToOggOpus(await synthMp3(word, voice))
      const msg = await api.sendVoice(chatId, new InputFile(ogg, `${word}.ogg`))
      await saveFlashcardFileId(botId, word, voice, msg.voice.file_id)
      ok++
      console.log(`[${i + 1}/${todo.length}] OK  ${word}  -> ${msg.voice.file_id.slice(0, 24)}...`)
    } catch (err) {
      failed++
      console.log(`[${i + 1}/${todo.length}] ERR ${word}: ${(err as Error).message}`)
    }
    await sleep(delayMs)
  }
  console.log(`\nDone. Seeded: ${ok}, failed: ${failed}.`)
}

main().then(() => process.exit(0), err => {
  console.error(`ERROR: ${(err as Error).message}`)
  process.exit(1)
})
