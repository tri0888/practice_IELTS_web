import { PDFDocument } from 'pdf-lib'
import { httpError } from '../../shared/http'
import { fileResponse, getFileBytesCached, isR2Enabled, objectExists, putBytes, sliceCacheKey } from '../../shared/storage'
import { findBookPdfPath, getEtsPdfPath } from '../tests/tests.services'
import * as repo from './practice.repositories'
import type { Layout } from './practice.repositories'

export type { Layout } from './practice.repositories'

export const isToeic = (book: number) => book >= 2000

const examOf = (book: number) => (isToeic(book) ? 'toeic' : 'ielts') as repo.Exam
const range = ([from, to]: [number, number]) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

function bundledLayout(book: number, test: number): Layout | null {
  if (!isToeic(book)) return repo.bundledIeltsLayout(book, test)
  const ets = repo.bundledToeicLayout(book, test)
  if (!ets) return null
  return {
    listening: ([1, 2, 3, 4] as const).map(n => ({ section: n, pages: range(ets.lc[`part${n}`]) })),
    reading: ([5, 6, 7] as const).map(n => ({ passage: n, passage_pages: range(ets.rc[`part${n}`]) })),
  }
}

export async function getPracticeLayout(book: number, test: number): Promise<Layout | null> {
  return (await repo.findLayout(examOf(book), book, test)) ?? bundledLayout(book, test)
}

export async function getTestAnswers(book: number, test: number, skill?: string): Promise<Record<string, unknown>> {
  const doc = await repo.findAnswers(examOf(book), book, test)
  if (!doc) return {}
  if (skill && skill in doc) return doc[skill] as Record<string, unknown>
  if ('answers' in doc) return doc.answers as Record<string, unknown>
  return {}
}

const partNumber = (key: string, index: number) => {
  const raw = key.split('_')[index]
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null
}

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

async function pdfSliceResponse(book: number, pdfType: string, test: number, pages: number[], filename: string) {
  const pdfKey = sourcePdfKey(book, pdfType, test)
  if (!isR2Enabled()) throw httpError(404, `PDF not found: ${pdfKey}`)
  const cacheKey = sliceCacheKey(pdfKey, pages)
  if (!(await objectExists(cacheKey))) {
    await putBytes(cacheKey, await slicePdf(await getFileBytesCached(pdfKey), pages), 'application/pdf')
  }
  return fileResponse(cacheKey, 'application/pdf', filename)
}

export async function getPdfPart(book: number, pdfType: string, test: number, partKey: string) {
  const pages = resolvePartPages(await getPracticeLayout(book, test), partKey)
  if (!pages.length) throw httpError(404, `Part ${partKey} not mapped or found for Book ${book} Test ${test}`)
  return pdfSliceResponse(book, pdfType, test, pages, `${partKey}.pdf`)
}

export const getPdfPage = (book: number, pageNumber: number, pdfType = 'academic', test = 1) =>
  pdfSliceResponse(book, pdfType, test, [pageNumber], `page_${pageNumber}.pdf`)
