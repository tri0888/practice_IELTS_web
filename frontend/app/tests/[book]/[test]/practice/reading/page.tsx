"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer/PDFViewer'
import ResultModal from '@/components/ResultModal/ResultModal'
import './page.css'

const BACKEND = '/api'
const DURATION_SECONDS = 60 * 60 // 60 minutes

type Passage = {
  passage_number: number
  title: string
  passage_text: string
  question_range: string
  questions_text: string
}

type ContentData = {
  reading: {
    total_questions: number
    duration_minutes: number
    passages: Passage[]
  }
}

interface QuestionGroup {
  range: string
  start: number
  end: number
  text: string
}

function parseQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []
  const regex = /^Questions\s+(\d+)-(\d+)/gim
  const groups: QuestionGroup[] = []
  let match
  
  const matches: { index: number; range: string; start: number; end: number }[] = []
  while ((match = regex.exec(text)) !== null) {
    const startNum = parseInt(match[1], 10)
    const endNum = parseInt(match[2], 10)
    matches.push({
      index: match.index,
      range: `${startNum}-${endNum}`,
      start: startNum,
      end: endNum
    })
  }
  
  if (matches.length === 0) {
    return [{
      range: 'all',
      start: 1,
      end: 40,
      text: text
    }]
  }
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length
    const groupText = text.substring(current.index, nextIndex).trim()
    groups.push({
      range: current.range,
      start: current.start,
      end: current.end,
      text: groupText
    })
  }
  
  return groups
}

function estimateBand(correct: number, total: number): string {
  const score = correct
  if (score >= 39) return '9.0'
  if (score >= 37) return '8.5'
  if (score >= 35) return '8.0'
  if (score >= 33) return '7.5'
  if (score >= 30) return '7.0'
  if (score >= 27) return '6.5'
  if (score >= 23) return '6.0'
  if (score >= 19) return '5.5'
  if (score >= 15) return '5.0'
  if (score >= 13) return '4.5'
  if (score >= 10) return '4.0'
  if (score >= 8) return '3.5'
  if (score >= 6) return '3.0'
  if (score >= 4) return '2.5'
  return '2.0'
}

export default function ReadingPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  const [content, setContent] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePassage, setActivePassage] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answerKey, setAnswerKey] = useState<Record<string, { answer: string; explanation: string }> | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [practiceLayout, setPracticeLayout] = useState<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const passagePanelRef = useRef<HTMLDivElement>(null)

  // Load content
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const defaultContent: ContentData = {
          reading: {
            total_questions: 40,
            duration_minutes: 60,
            passages: [
              { passage_number: 1, title: 'Passage 1', passage_text: '', question_range: '1-13', questions_text: '' },
              { passage_number: 2, title: 'Passage 2', passage_text: '', question_range: '14-26', questions_text: '' },
              { passage_number: 3, title: 'Passage 3', passage_text: '', question_range: '27-40', questions_text: '' },
            ]
          }
        }
        if (!cancelled) {
          setContent(defaultContent)
          const init: Record<number, string> = {}
          for (let i = 1; i <= 40; i++) init[i] = ''
          setAnswers(init)
        }
        // Load practice layout
        try {
          const practiceResp = await fetch(`${BACKEND}/tests/${book}/${test}/practice`)
          if (practiceResp.ok) {
            const practiceData = await practiceResp.json()
            if (!cancelled) setPracticeLayout(practiceData)
          }
        } catch (e) {
          console.error("Failed to load practice layout:", e)
        }

        // Create attempt
        const attemptResp = await fetch(`${BACKEND}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: Number(book), test: Number(test), skill: 'reading' }),
        })
        const attemptData = await attemptResp.json()
        if (!cancelled) setAttemptId(attemptData.id)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [book, test])

  // Timer
  useEffect(() => {
    if (isSubmitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isSubmitted])

  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted) handleSubmit()
  }, [timeLeft, isSubmitted])

  // Scroll passage to top when switching passages
  useEffect(() => {
    if (passagePanelRef.current) {
      passagePanelRef.current.scrollTop = 0
    }
  }, [activePassage])

  const groups = useMemo(() => {
    if (!content || !content.reading || !content.reading.passages) return []
    const passagesList = content.reading.passages
    const currentPassageData = passagesList[activePassage]
    if (!currentPassageData) return []

    // Try to get groups from practiceLayout first to ensure we have all groups (even with OCR errors)
    if (practiceLayout && practiceLayout.reading) {
      const layout = practiceLayout.reading.find((p: any) => p.passage === activePassage + 1)
      if (layout && layout.groups) {
        return layout.groups.map((g: any) => {
          const parts = g.range.split('-')
          const start = Number(parts[0])
          const end = parts[1] ? Number(parts[1]) : start
          return {
            range: g.range,
            start,
            end,
            title: g.title,
            page: g.page
          }
        })
      }
    }

    return parseQuestionGroups(currentPassageData.questions_text)
  }, [content, activePassage, practiceLayout])

  // Safeguard: Reset activeGroupIndex if it is out of bounds for the current passage's groups
  useEffect(() => {
    if (groups.length > 0 && activeGroupIndex >= groups.length) {
      setActiveGroupIndex(0)
    }
  }, [groups, activeGroupIndex])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const timerClass = timeLeft <= 120 ? 'timer timer--danger' : timeLeft <= 600 ? 'timer timer--warning' : 'timer'

  const answeredCount = useMemo(() =>
    Object.values(answers).filter(a => a.trim() !== '').length
  , [answers])

  const passagePages = useMemo(() => {
    if (!practiceLayout || !practiceLayout.reading) {
      const pNum = activePassage + 1
      const map: Record<number, number[]> = {
        1: [18, 19],
        2: [21, 22],
        3: [25, 26]
      }
      return map[pNum] || []
    }
    const layout = practiceLayout.reading.find((p: any) => p.passage === activePassage + 1)
    return layout?.passage_pages || []
  }, [activePassage, practiceLayout])

  const activeQuestionPage = useMemo(() => {
    if (!practiceLayout || !practiceLayout.reading) {
      const pNum = activePassage + 1
      const map: Record<number, number[]> = {
        1: [20, 20],
        2: [23, 23],
        3: [27, 28, 28]
      }
      const pages = map[pNum]
      if (pages && pages[activeGroupIndex] !== undefined) {
        return pages[activeGroupIndex]
      }
      const defaultMap: Record<number, number> = { 1: 20, 2: 23, 3: 27 }
      return defaultMap[pNum] || 20
    }

    const layout = practiceLayout.reading.find((p: any) => p.passage === activePassage + 1)
    if (layout && layout.groups && layout.groups[activeGroupIndex]) {
      return layout.groups[activeGroupIndex].page
    }
    return 20
  }, [activePassage, activeGroupIndex, practiceLayout])

  const handleSubmit = async () => {
    if (!attemptId) return
    setIsSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const responses = Object.entries(answers).map(([q, a]) => ({
      question_number: Number(q),
      answer: a,
    }))

    try {
      const [submitResp, answerResp] = await Promise.all([
        fetch(`${BACKEND}/attempts/${attemptId}/submit`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses }),
        }),
        fetch(`${BACKEND}/tests/${book}/${test}/answers?skill=reading`),
      ])
      const submitData = await submitResp.json()
      setResult(submitData.result)
      setShowResult(true)
      if (answerResp.ok) {
        const answerData = await answerResp.json()
        setAnswerKey(answerData.answers)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getQuestionRange = (range: string): number[] => {
    if (!range) return []
    const parts = range.split('-')
    const start = Number(parts[0])
    const end = parts[1] ? Number(parts[1]) : start
    if (isNaN(start) || isNaN(end)) return []
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  const getPassageForQuestion = (q: number): number => {
    if (!content) return 0
    return content.reading.passages.findIndex(p => {
      const [start, end] = p.question_range.split('-').map(Number)
      return q >= start && q <= end
    })
  }

  const checkAnswer = (q: number) => {
    const ak = getCorrectAnswerForQuestion(q, answerKey)
    if (!ak) return false
    const userAns = answers[q] ?? ''
    const correctAns = ak.answer ?? ''
    return checkUserAnswer(userAns, correctAns)
  }

  const getDisplayAnswer = (q: number) => {
    const ak = getCorrectAnswerForQuestion(q, answerKey)
    if (!ak) return ''
    const ans = ak.answer
    const parts = ans.split(/\s*[-–—]\s*/)
    if (parts.length > 1 && parts[0].length < 10) {
      return parts[0].trim()
    }
    return ans
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>📖</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Reading Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Preparing reading passages and questions...</div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p>❌ Unable to load test content.</p>
          <Link href={`/tests/${book}/${test}`}>
            <button className="btn btn-primary" style={{ marginTop: 16 }}>Back</button>
          </Link>
        </div>
      </div>
    )
  }

  const passages = content.reading.passages
  const currentPassage = passages[activePassage]
  const activeGroup = groups[activeGroupIndex] || groups[0] || { range: '1-40', start: 1, end: 40, text: '' }

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge">Reading</span>
          <span>Cambridge IELTS {book} — Test {test}</span>
          <span className="reading-answered-badge">
            {answeredCount}/40 answered
          </span>
        </div>
        <div className="reading-timer-wrapper">
          <div className={timerClass}>
            ⏱️ {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <button className="btn btn-submit btn-sm" onClick={handleSubmit}>
              Submit
            </button>
          )}
        </div>
      </div>

      {/* Passage Tabs */}
      <div className="reading-tabs-container">
        <div className="section-tabs" style={{ marginBottom: 0 }}>
          {passages.map((passage, idx) => (
            <button
              key={passage.passage_number}
              className={`section-tab ${activePassage === idx ? 'section-tab--active' : ''}`}
              onClick={() => {
                setActivePassage(idx)
                setActiveGroupIndex(0)
              }}
            >
              Passage {passage.passage_number}
            </button>
          ))}
        </div>
        {/* Mini question palette */}
        <div className="reading-palette-mini">
          {Array.from({ length: 40 }, (_, i) => i + 1).map(q => {
            const isAnswered = (answers[q] ?? '').trim() !== ''
            const pIdx = getPassageForQuestion(q)
            const isActive = pIdx === activePassage
            return (
              <div
                key={q}
                onClick={() => {
                  if (pIdx >= 0) {
                    setActivePassage(pIdx)
                    const targetPassage = passages[pIdx]
                    if (targetPassage) {
                      let targetGroups: any[] = []
                      if (practiceLayout && practiceLayout.reading) {
                        const layout = practiceLayout.reading.find((p: any) => p.passage === pIdx + 1)
                        if (layout && layout.groups) {
                          targetGroups = layout.groups.map((g: any) => {
                            const parts = g.range.split('-')
                            const start = Number(parts[0])
                            const end = parts[1] ? Number(parts[1]) : start
                            return { range: g.range, start, end }
                          })
                        }
                      }
                      if (targetGroups.length === 0) {
                        targetGroups = parseQuestionGroups(targetPassage.questions_text)
                      }
                      const groupIdx = targetGroups.findIndex(g => q >= g.start && q <= g.end)
                      if (groupIdx >= 0) {
                        setActiveGroupIndex(groupIdx)
                      }
                    }
                  }
                }}
                className="reading-palette-mini-item"
                style={{
                  background: isAnswered ? 'var(--accent-blue)' : isActive ? 'var(--bg-primary)' : 'transparent',
                  color: isAnswered ? 'white' : 'var(--text-muted)',
                  border: isActive && !isAnswered ? '1px solid var(--ielts-red)' : '1px solid transparent',
                }}
                title={`Question ${q}`}
              >
                {q}
              </div>
            )
          })}
        </div>
      </div>

      {/* Split View */}
      <div className="split-view-3">
        {/* Left: Passage PDF */}
        <PDFViewer book={book} test={parseInt(test, 10)} partKey={`reading_${activePassage + 1}`} pages={passagePages} containerRef={passagePanelRef} />

        {/* Divider */}
        <div className="split-view-3__divider" />

        {/* Middle: Questions PDF */}
        <div className="split-view-3__panel reading-middle-panel">
          <div className="reading-middle-wrapper">
            {/* Group Tabs */}
            <div className="section-tabs" style={{ marginBottom: 16, flexShrink: 0 }}>
              {groups.map((group, idx) => (
                <button
                  key={group.range}
                  className={`section-tab ${activeGroupIndex === idx ? 'section-tab--active' : ''}`}
                  onClick={() => setActiveGroupIndex(idx)}
                >
                  {group.range === 'all' ? 'All' : `Qs ${group.range}`}
                </button>
              ))}
            </div>

            {/* Questions PDF page */}
            <PDFViewer book={book} test={parseInt(test, 10)} pages={[activeQuestionPage]} style={{ padding: 0, background: 'transparent', flexGrow: 1 }} />
          </div>
        </div>

        {/* Divider */}
        <div className="split-view-3__divider" />

        {/* Right: Answer Inputs */}
        <div className="split-view-3__panel reading-right-panel">
          <div className="reading-right-wrapper">
            {/* Answer Inputs */}
            <div className="card reading-answer-section">
              <h3 className="reading-answer-title">
                Enter answers — Group {activeGroup?.range === 'all' ? 'All' : activeGroup?.range}
              </h3>
              <div className="reading-answer-grid">
                {getQuestionRange(activeGroup?.range ?? currentPassage.question_range).map(q => {
                  const isCorrect = checkAnswer(q)
                  const dispAnswer = getDisplayAnswer(q)
                  const ak = getCorrectAnswerForQuestion(q, answerKey)
                  return (
                    <div key={q} className="reading-q-row">
                      <span className="question-block__number">{q}</span>
                      <input
                        type="text"
                        className="input-answer"
                        value={answers[q] ?? ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                        placeholder="Your answer"
                        disabled={isSubmitted}
                        style={{
                          flex: 1,
                          ...(isSubmitted && ak ? {
                            borderColor: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)',
                            background: isCorrect ? '#f0fdf4' : '#fef2f2',
                          } : {})
                        }}
                      />
                      {isSubmitted && ak && (
                        <div className="reading-q-feedback" style={{ color: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)' }}>
                          {isCorrect ? '✓' : '✗'} <span style={{ color: 'var(--status-correct)' }}>{dispAnswer}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Explanations (after submit, filtered by active group) */}
            {isSubmitted && answerKey && (
              <div className="card reading-explanations-section">
                <h4 className="reading-explanations-title">
                  📝 Answer Explanations
                </h4>
                <div className="reading-explanations-grid">
                  {getQuestionRange(activeGroup?.range ?? currentPassage.question_range).map(q => {
                    const ak = getCorrectAnswerForQuestion(q, answerKey)
                    if (!ak || !ak.explanation) return null
                    const isCorrect = checkAnswer(q)
                    const dispAnswer = getDisplayAnswer(q)
                    return (
                      <div key={q} className="reading-explanation-card" style={{
                        borderLeft: `3px solid ${isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)'}`,
                      }}>
                        <strong style={{ color: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)' }}>Question {q}:</strong>{' '}
                        <span style={{ color: 'var(--status-correct)', fontWeight: 600 }}>{dispAnswer}</span>
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>{ak.explanation}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <ResultModal
        isOpen={showResult && !!result}
        emoji="📖"
        title="Reading Result"
        testNumber={test}
        correctCount={result?.correct ?? 0}
        totalCount={result?.total ?? 40}
        bandScore={estimateBand(result?.correct ?? 0, result?.total ?? 40)}
        onClose={() => setShowResult(false)}
        backUrl={`/tests/${book}/${test}`}
      />
    </div>
  )
}

function cleanSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function cleanPunctuation(s: string): string {
  return s.replace(/^[.,;:!?"'\s]+|[.,;:!?"'\s]+$/g, '');
}

function expandParentheses(s: string): string[] {
  const match = s.match(/\(([^)]*)\)/);
  if (!match) {
    return [cleanSpaces(s)];
  }
  const index = match.index!;
  const length = match[0].length;
  const prefix = s.slice(0, index);
  const inner = match[1];
  const suffix = s.slice(index + length);

  const opt1 = prefix + suffix;
  const opt2 = prefix + inner + suffix;

  const res1 = expandParentheses(opt1);
  const res2 = expandParentheses(opt2);

  return Array.from(new Set([...res1, ...res2]));
}

function expandSlashes(s: string): string[] {
  const tokens = s.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return [""];

  const tokenVariations = tokens.map(token => {
    if (token.includes('/')) {
      const parts = token.split('/').filter(p => p.length > 0);
      return parts.length > 0 ? parts : [token];
    }
    return [token];
  });

  const cartesian = (r: string[][], a: string[]) => r.flatMap(d => a.map(e => [...d, e]));
  const combinations = tokenVariations.reduce(cartesian, [[]]);

  return combinations.map(combo => combo.join(' '));
}

function getCorrectAnswersList(correctAnsStr: string): string[] {
  if (!correctAnsStr) return [];
  const mainOptions = correctAnsStr.split(/\s+\/\s+/);
  const allCorrect: string[] = [];

  for (const option of mainOptions) {
    const parentheticalExpanded = expandParentheses(option);
    for (const pExpanded of parentheticalExpanded) {
      const slashExpanded = expandSlashes(pExpanded);
      for (const sExpanded of slashExpanded) {
        allCorrect.push(cleanPunctuation(sExpanded.toLowerCase()));
      }
    }
  }

  allCorrect.push(cleanPunctuation(correctAnsStr.toLowerCase()));
  return Array.from(new Set(allCorrect));
}

function checkUserAnswer(userAnsStr: string, correctAnsStr: string): boolean {
  const cleanedUser = cleanPunctuation(cleanSpaces(userAnsStr).toLowerCase());
  if (!cleanedUser) return false;

  const correctAnswersList = getCorrectAnswersList(correctAnsStr);
  if (correctAnswersList.includes(cleanedUser)) {
    return true;
  }

  const parts = correctAnsStr.split(/\s*[-–—]\s*/);
  if (parts.length > 1) {
    const firstWordCleaned = cleanPunctuation(cleanSpaces(parts[0]).toLowerCase());
    if (cleanedUser === firstWordCleaned) {
      return true;
    }
  }

  return false;
}

function getCorrectAnswerForQuestion(q: number, answerKey: any): { answer: string; explanation: string } | null {
  if (!answerKey) return null;
  if (answerKey[String(q)]) {
    return answerKey[String(q)];
  }
  for (const key of Object.keys(answerKey)) {
    const cleanedKey = key.replace(/–|—/g, '-');
    if (cleanedKey.includes('-')) {
      const parts = cleanedKey.split('-');
      if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end) && q >= start && q <= end) {
          return answerKey[key];
        }
      }
    }
  }
  return null;
}
