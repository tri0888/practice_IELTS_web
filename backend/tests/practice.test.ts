/** Ported from Python `test_practice_helpers.py`, plus the bundled-layout fallback and PDF slicing. */
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { isToeic, resolvePartPages, slicePdf, type Layout } from '../src/modules/practice/services'

describe('isToeic', () => {
  it.each([[2026, true], [2000, true], [1999, false], [20, false], [11, false]])('%i -> %s', (book, expected) => {
    expect(isToeic(book)).toBe(expected)
  })
})

const LAYOUT: Layout = {
  listening: [{ section: 1, pages: [1, 2] }, { section: 2, pages: [3] }],
  reading: [
    { passage: 1, passage_pages: [10, 11], groups: [{ page: 10 }, { page: 11 }, { page: 10 }] },
    { passage: 2, passage_pages: [12] },
  ],
  writing: [{ task: 1, pages: [20] }],
  speaking: [{ pages: [30, 31] }],
}

describe('resolvePartPages', () => {
  it.each<[string, number[]]>([
    ['listening_2', [3]],
    ['listening_all', [1, 2, 3]],
    ['reading_1', [10, 11]],
    ['reading_all', [10, 11, 12]],
    ['reading_q_1', [10, 11]], // unique + sorted group pages
    ['writing_1', [20]],
    ['speaking', [30, 31]],
    ['unknown_9', []],
  ])('%s', (key, expected) => expect(resolvePartPages(LAYOUT, key)).toEqual(expected))

  it('handles an empty layout', () => expect(resolvePartPages({}, 'listening_1')).toEqual([]))
})

describe('slicePdf', () => {
  it('copies the requested pages in order and clamps out-of-range numbers', async () => {
    const src = await PDFDocument.create()
    for (const width of [100, 200, 300]) src.addPage([width, 100])
    const out = await PDFDocument.load(await slicePdf(await src.save(), [3, 1, 99]))
    expect(out.getPages().map(p => p.getWidth())).toEqual([300, 100, 300])
  })
})
