import { describe, expect, it } from 'vitest'
import * as s from '../src/modules/attempts/attempts.services'

describe('string helpers', () => {
  it('cleanSpaces collapses whitespace', () => expect(s.cleanSpaces('  hello   world ')).toBe('hello world'))
  it('cleanPunctuation strips edges only', () => expect(s.cleanPunctuation('.,"hello world!?')).toBe('hello world'))
  it('expandParentheses keeps the prefix (quirk)', () =>
    expect(s.expandParentheses('the (main) reason').sort()).toEqual(['the main reason', 'the reason']))
  it('expandSlashes builds the cartesian product', () =>
    expect(s.expandSlashes('cat/dog runs').sort()).toEqual(['cat runs', 'dog runs']))
  it('getCorrectAnswersList includes variants', () => {
    const v = s.getCorrectAnswersList('color / colour')
    expect(v).toContain('color')
    expect(v).toContain('colour')
  })
})

describe('checkUserAnswer', () => {
  it.each([
    ['colour', 'color / colour', true],
    ['color', 'color / colour', true],
    ['COLOR', 'color / colour', true],
    ['the reason', 'the (main) reason', true],
    ['main reason', 'the (main) reason', false],
    ['dog', 'cat/dog', true],
    ['twenty', 'twenty-five', true],
    ['twenty-five', 'twenty-five', true],
    ['north', 'north-west', true],
    ['hello world', '  hello   world ', true],
    ['b', 'B', true],
    ['anything', '', false],
    ['115', '(£)115 / a/one hundred (and) fifteen', true],
    ['£115', '(£)115 / a/one hundred (and) fifteen', true],
    ['a hundred fifteen', '(£)115 / a/one hundred (and) fifteen', true],
    ['one hundred and fifteen', '(£)115 / a/one hundred (and) fifteen', true],
    ['hundred and fifteen', '(£)115 / a/one hundred (and) fifteen', false],
    ['£ 115', '(£)115 / a/one hundred (and) fifteen', false],
  ])('%s vs %s -> %s', (user, correct, expected) => {
    expect(s.checkUserAnswer(user, correct)).toBe(expected)
  })
})

describe('getCorrectAnswerForQuestion', () => {
  it('supports plain, object and range keys', () => {
    const correct = { '1': 'apple', '14-26': { answer: 'B' }, '27': { answer: 'C' } }
    expect(s.getCorrectAnswerForQuestion(1, correct)).toBe('apple')
    expect(s.getCorrectAnswerForQuestion(20, correct)).toBe('B')
    expect(s.getCorrectAnswerForQuestion(27, correct)).toBe('C')
    expect(s.getCorrectAnswerForQuestion(99, correct)).toBe('')
  })
})
