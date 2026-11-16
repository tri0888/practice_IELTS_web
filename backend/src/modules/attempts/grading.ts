/**
 * Pure answer-grading primitives for IELTS/TOEIC — a faithful port of the
 * former Python `attempts/grading.py`. Behavior (quirks included) is locked by
 * `tests/grading.test.ts`, ported from the Python characterization tests.
 */

/** Python `re.sub(r'\s+', ' ', s).strip()` */
export const cleanSpaces = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Python `s.strip(".,;:!?\"' ")` — only these characters, only at the edges. */
export const cleanPunctuation = (s: string) => s.replace(/^[.,;:!?"' ]+|[.,;:!?"' ]+$/g, '')

export function expandParentheses(s: string): string[] {
  const match = /\(([^)]*)\)/.exec(s)
  if (!match) return [cleanSpaces(s)]
  const prefix = s.slice(0, match.index)
  const suffix = s.slice(match.index + match[0].length)
  return [...new Set([...expandParentheses(prefix + suffix), ...expandParentheses(prefix + match[1] + suffix)])]
}

export function expandSlashes(s: string): string[] {
  const tokens = s.split(/\s+/).filter(Boolean) // Python str.split()
  if (!tokens.length) return ['']
  const variations = tokens.map(token => {
    if (!token.includes('/')) return [token]
    const parts = token.split('/').filter(Boolean)
    return parts.length ? parts : [token]
  })
  return variations
    .reduce<string[][]>((combos, options) => combos.flatMap(combo => options.map(o => [...combo, o])), [[]])
    .map(combo => combo.join(' '))
}

export function getCorrectAnswersList(correct: string): string[] {
  if (!correct) return []
  const all: string[] = []
  for (const option of correct.split(/\s+\/\s+/)) {
    for (const p of expandParentheses(option)) {
      for (const v of expandSlashes(p)) all.push(cleanPunctuation(v.toLowerCase()))
    }
  }
  all.push(cleanPunctuation(correct.toLowerCase()))
  return [...new Set(all)]
}

export function checkUserAnswer(userAns: string, correct: string): boolean {
  const cleanedUser = cleanPunctuation(cleanSpaces(userAns).toLowerCase())
  if (!cleanedUser) return false
  if (getCorrectAnswersList(correct).includes(cleanedUser)) return true
  const parts = correct.split(/\s*[-–—]\s*/)
  return parts.length > 1 && cleanedUser === cleanPunctuation(cleanSpaces(parts[0]).toLowerCase())
}

const answerOf = (val: unknown) =>
  val && typeof val === 'object' ? String((val as { answer?: unknown }).answer ?? '') : String(val)

const PY_INT = /^\s*[+-]?\d+\s*$/

/** Answer for question `q`, supporting range keys like "14-26". */
export function getCorrectAnswerForQuestion(q: number, correct: Record<string, unknown>): string {
  if (String(q) in correct) return answerOf(correct[String(q)])
  for (const [key, val] of Object.entries(correct)) {
    const parts = key.replace(/[–—]/g, '-').split('-')
    if (parts.length === 2 && PY_INT.test(parts[0]) && PY_INT.test(parts[1])) {
      if (Number(parts[0]) <= q && q <= Number(parts[1])) return answerOf(val)
    }
  }
  return ''
}
