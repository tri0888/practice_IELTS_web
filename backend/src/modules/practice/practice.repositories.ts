import { COLLECTIONS, getCollection } from '../../shared/database'
import ieltsLayoutsJson from '../../data/ielts_layouts.json'
import toeicLayoutsJson from '../../data/toeic_layouts.json'

export type Exam = 'ielts' | 'toeic'

export type Layout = {
  listening?: { section: number; pages: number[] }[]
  reading?: { passage: number; passage_pages: number[]; groups?: { range?: string; page: number }[] }[]
  writing?: { task: number; pages: number[]; model_answer_pages?: number[] }[]
  speaking?: { pages: number[] }[]
  [key: string]: unknown
}

export type EtsLayoutItem = { test: number } & Record<'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7', [number, number]>

export async function findLayout(exam: Exam, book: number, test: number): Promise<Layout | null> {
  const coll = await getCollection(exam === 'toeic' ? COLLECTIONS.toeicLayouts : COLLECTIONS.ieltsLayouts)
  if (!coll) return null
  const doc = await coll.findOne({ book, test }, { projection: { _id: 0 } })
  return (doc?.layout as Layout) ?? null
}

export async function findAnswers(exam: Exam, book: number, test: number) {
  const coll = await getCollection(exam === 'toeic' ? COLLECTIONS.toeicAnswers : COLLECTIONS.ieltsAnswers)
  if (!coll) return null
  return coll.findOne({ book, test }, { projection: { _id: 0 } })
}

export function bundledIeltsLayout(book: number, test: number): Layout | null {
  return (ieltsLayoutsJson as unknown as Record<string, Record<string, Layout>>)[String(book)]?.[String(test)] ?? null
}

export function bundledToeicLayout(year: number, test: number): { lc: EtsLayoutItem; rc: EtsLayoutItem } | null {
  const data = (toeicLayoutsJson as unknown as Record<string, { lc: EtsLayoutItem[]; rc: EtsLayoutItem[] }>)[`ETS ${year}`]
  const lc = data?.lc.find(i => i.test === test)
  const rc = data?.rc.find(i => i.test === test)
  return lc && rc ? { lc, rc } : null
}
