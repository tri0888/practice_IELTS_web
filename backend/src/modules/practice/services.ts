import { PDFDocument } from 'pdf-lib'
import { COLLECTIONS, getCollection } from '../../db'
import { httpError } from '../../http'
import { fileResponse, getFileBytesCached, isR2Enabled, objectExists, putBytes, sliceCacheKey } from '../../r2'
import { findBookPdfPath, getEtsPdfPath } from '../tests/services'
import ieltsLayoutsJson from '../../data/ielts_layouts.json'
import toeicLayoutsJson from '../../data/toeic_layouts.json'

export type Layout = {
  listening?: { section: number; pages: number[] }[]
  reading?: { passage: number; passage_pages: number[]; groups?: { range?: string; page: number }[] }[]
  writing?: { task: number; pages: number[]; model_answer_pages?: number[] }[]
  speaking?: { pages: number[] }[]
  [key: string]: unknown
}

/** Single source of the exam-type rule: TOEIC "books" are their exam year (2024, 2026). */
export const isToeic = (book: number) => book >= 2000

const range = (pair: [number, number]) => Array.from({ length: pair[1] - pair[0] + 1 }, (_, i) => pair[0] + i)

type EtsLayoutItem = { test: number; part1: [number, number]; part2: [number, number]; part3: [number, number]; part4: [number, number]; part5: [number, number]; part6: [number, number]; part7: [number, number] }

/** Bundled fallback used when MongoDB has no layout (same data `npm run seed` imports). */
function bundledLayout(book: number, test: number): Layout | null {
  if (isToeic(book)) {
    const year = (toeicLayoutsJson as unknown as Record<string, { lc: EtsLayoutItem[]; rc: EtsLayoutItem[] }>)[`ETS ${book}`]
    const lc = year?.lc.find(i => i.test === test)
    const rc = year?.rc.find(i => i.test === test)
    if (!lc || !rc) return null
    return {
      listening: [1, 2, 3, 4].map(n => ({ section: n, pages: range(lc[`part${n}` as 'part1']) })),
      reading: [5, 6, 7].map(n => ({ passage: n, passage_pages: range(rc[`part${n}` as 'part5']) })),
    }
  }
  return ((ieltsLayoutsJson as unknown as Record<string, Record<string, Layout>>)[String(book)]?.[String(test)]) ?? null
}

export async function getPracticeLayout(book: number, test: number): Promise<Layout | null> {
  const coll = await getCollection(isToeic(book) ? COLLECTIONS.toeicLayouts : COLLECTIONS.ieltsLayouts)
  if (coll) {
    const doc = await coll.findOne({ book, test }, { projection: { _id: 0 } })
    if (doc?.layout) return doc.layout as Layout
  }
  return bundledLayout(book, test)
}

export async function getTestAnswers(book: number, test: number, skill?: string): Promise<Record<string, unknown>> {
  const coll = await getCollection(isToeic(book) ? COLLECTIONS.toeicAnswers : COLLECTIONS.ieltsAnswers)
  if (!coll) return {}
  const doc = await coll.findOne({ book, test }, { projection: { _id: 0 } })
  if (!doc) return {}
  if (skill && skill in doc) return doc[skill] as Record<string, unknown>
  if ('answers' in doc) return doc.answers as Record<string, unknown>
  return {}
}

const partNumber = (key: string, index: number) => {
  const raw = key.split('_')[index]
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null
}

/**
 * Map a practice `part_key` (listening_2, reading_1, reading_all, reading_q_1,
 * writing_1, speaking) to the ordered PDF page numbers of that part.
 */
export function resolvePartPages(layout: Layout | null, partKey: string): number[] {
  if (!layout) return []

  if (partKey.startsWith('listening_')) {
    const n = partNumber(partKey, 1)
    if (n !== null) return layout.listening?.find(x => x.section === n)?.pages ?? []
    return partKey === 'listening_all' ? (layout.listening ?? []).flatMap(x => x.pages ?? []) : []
  }
  if (partKey.startsWith('reading_q_')) {
    const item = layout.reading?.find(x => x.passage === partNumber(partKey, 2))
    if (!item?.groups?.length) return []
    return [...new Set(item.groups.map(g => g.page))].sort((a, b) => a - b)
  }
  if (partKey.startsWith('reading_')) {
    const n = partNumber(partKey, 1)
    if (n !== null) return layout.reading?.find(x => x.passage === n)?.passage_pages ?? []
    return partKey === 'reading_all' ? (layout.reading ?? []).flatMap(x => x.passage_pages ?? []) : []
  }
  if (partKey.startsWith('writing_')) {
    return layout.writing?.find(x => x.task === partNumber(partKey, 1))?.pages ?? []
  }
  if (partKey === 'speaking') return layout.speaking?.[0]?.pages ?? []
  return []
}

const sourcePdfKey = (book: number, pdfType: string, test: number) =>
  isToeic(book) ? getEtsPdfPath(pdfType, test, String(book)) : findBookPdfPath(book, pdfType)

/** New PDF containing `pages` (1-based, clamped to the document) in order. */
export async function slicePdf(pdfBytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  try {
    const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false })
    const out = await PDFDocument.create()
    const total = src.getPageCount()
    const indices = pages.map(p => Math.min(Math.max(1, p), total) - 1)
    for (const page of await out.copyPages(src, indices)) out.addPage(page)
    return await out.save()
  } catch (err) {
    throw httpError(500, `Failed to slice PDF: ${(err as Error).message}`)
  }
}

/**
 * Serve a sub-PDF. The slice is generated once, stored in R2 under the cache
 * prefix and served via presigned redirect (keeps responses under Vercel's limit).
 */
async function pdfSliceResponse(book: number, pdfType: string, test: number, pages: number[], filename: string) {
  const pdfKey = sourcePdfKey(book, pdfType, test)
  if (!isR2Enabled()) throw httpError(404, `PDF not found: ${pdfKey}`)
  const cacheKey = sliceCacheKey(pdfKey, pages)
  if (!(await objectExists(cacheKey))) {
    await putBytes(cacheKey, await slicePdf(await getFileBytesCached(pdfKey), pages), 'application/pdf')
  }
  return fileResponse(cacheKey, 'application/pdf', filename)
}

export async function getPdfPartResponse(book: number, pdfType: string, test: number, partKey: string) {
  const pages = resolvePartPages(await getPracticeLayout(book, test), partKey)
  if (!pages.length) throw httpError(404, `Part ${partKey} not mapped or found for Book ${book} Test ${test}`)
  return pdfSliceResponse(book, pdfType, test, pages, `${partKey}.pdf`)
}

export const getPdfPageResponse = (book: number, pageNumber: number, pdfType = 'academic', test = 1) =>
  pdfSliceResponse(book, pdfType, test, [pageNumber], `page_${pageNumber}.pdf`)
