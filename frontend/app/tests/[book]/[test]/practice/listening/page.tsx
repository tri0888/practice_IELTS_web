"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer/PDFViewer'
import ResultModal from '@/components/ResultModal/ResultModal'
import { getAuthUrl } from '@/components/AuthProvider/AuthProvider'
import './page.css'

const BACKEND = '/api'
const DURATION_SECONDS = 30 * 60 // 30 minutes

const STATIC_PRACTICE_LAYOUT = {
  listening: [
    { section: 1, pages: [11, 12] },
    { section: 2, pages: [13, 14] },
    { section: 3, pages: [15, 16] },
    { section: 4, pages: [17, 18] },
  ]
}

type Section = {
  section_number: number
  question_range: string
  instruction: string
  content_text: string
  audio_file: string
}

type ContentData = {
  listening: {
    total_questions: number
    duration_minutes: number
    sections: Section[]
  }
}

export default function ListeningPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  const [content, setContent] = useState<ContentData | null>(null)
  const [practiceLayout, setPracticeLayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answerKey, setAnswerKey] = useState<Record<string, { answer: string; explanation: string }> | null>(null)
  const [showResult, setShowResult] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load content
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const defaultContent: ContentData = {
          listening: {
            total_questions: 40,
            duration_minutes: 30,
            sections: [
              { section_number: 1, question_range: '1-10', instruction: '', content_text: '', audio_file: '' },
              { section_number: 2, question_range: '11-20', instruction: '', content_text: '', audio_file: '' },
              { section_number: 3, question_range: '21-30', instruction: '', content_text: '', audio_file: '' },
              { section_number: 4, question_range: '31-40', instruction: '', content_text: '', audio_file: '' },
            ]
          }
        }

        try {
          const audioResp = await fetch(`${BACKEND}/tests/${book}/${test}/audio`)
          if (audioResp.ok) {
            const audioData = await audioResp.json()
            if (audioData && audioData.length > 0) {
              defaultContent.listening.sections.forEach((sec, idx) => {
                 sec.audio_file = audioData[idx]?.file_name || audioData[0]?.file_name || ''
              })
            }
          }
        } catch (e) {
          console.error("Audio fetch failed", e)
        }

        if (!cancelled) {
          setContent(defaultContent)
          // Init answers for questions 1-40
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
          } else {
            if (!cancelled) setPracticeLayout(STATIC_PRACTICE_LAYOUT)
          }
        } catch (e) {
          console.error("Failed to load practice layout, using fallback:", e)
          if (!cancelled) setPracticeLayout(STATIC_PRACTICE_LAYOUT)
        }

        // Create attempt
        const attemptResp = await fetch(`${BACKEND}/histories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: Number(book), test: Number(test), skill: 'listening' }),
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

  // Auto-submit on time up
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted) handleSubmit()
  }, [timeLeft, isSubmitted])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const timerClass = timeLeft <= 60 ? 'timer timer--danger' : timeLeft <= 300 ? 'timer timer--warning' : 'timer'

  const answeredCount = useMemo(() =>
    Object.values(answers).filter(a => a.trim() !== '').length
  , [answers])

  const activeSectionPages = useMemo(() => {
    if (!content || !content.listening || !content.listening.sections) return []
    const secList = content.listening.sections
    const secNum = secList[activeSection]?.section_number
    if (!secNum) return []
    const layout = practiceLayout?.listening?.find((s: any) => s.section === secNum)
    if (layout && layout.pages) {
      return layout.pages
    }
    const basePage = 10 + (secNum - 1) * 2
    return [basePage, basePage + 1]
  }, [content, activeSection, practiceLayout])

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
        fetch(`${BACKEND}/histories/${attemptId}/submit`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses }),
        }),
        fetch(`${BACKEND}/tests/${book}/${test}/answers?skill=listening`),
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
    const [start, end] = range.split('-').map(Number)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
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

  const estimateListeningBand = (correct: number): string => {
    if (correct >= 39) return '9.0'
    if (correct >= 37) return '8.5'
    if (correct >= 35) return '8.0'
    if (correct >= 32) return '7.5'
    if (correct >= 30) return '7.0'
    if (correct >= 26) return '6.5'
    if (correct >= 23) return '6.0'
    if (correct >= 20) return '5.5'
    if (correct >= 16) return '5.0'
    if (correct >= 13) return '4.5'
    if (correct >= 10) return '4.0'
    if (correct >= 8) return '3.5'
    if (correct >= 6) return '3.0'
    if (correct >= 4) return '2.5'
    return '2.0'
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>🎧</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Listening Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Preparing listening section audio and materials</div>
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

  const sections = content.listening.sections

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge">Listening</span>
          <span>Cambridge IELTS {book} — Test {test}</span>
          <span className="listening-answered-badge">
            {answeredCount}/40 answered
          </span>
        </div>
        <div className="listening-timer-wrapper">
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

      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1fr' }}>
        {/* Left: PDF Questions */}
        <PDFViewer book={book} test={parseInt(test, 10)} partKey={`listening_${activeSection + 1}`} pages={activeSectionPages} />

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right: Answers & Controls */}
        <div className="split-view__panel listening-split-panel">
          {/* Section Tabs */}
          <div className="section-tabs listening-tabs-wrapper">
            {sections.map((section, idx) => (
              <button
                key={section.section_number}
                className={`section-tab ${activeSection === idx ? 'section-tab--active' : ''}`}
                onClick={() => setActiveSection(idx)}
              >
                Section {section.section_number}
              </button>
            ))}
          </div>

          {/* Audio Player */}
          <div className="audio-player listening-audio-player">
            <div className="listening-audio-player__label">
              🎧 Section {sections[activeSection].section_number} Audio
            </div>
            <audio controls preload="none" className="listening-audio-el" key={activeSection}>
              <source
                src={getAuthUrl(`${BACKEND}/audio/${encodeURIComponent(sections[activeSection].audio_file)}`)}
                type="audio/mpeg"
              />
            </audio>
          </div>

          {/* Answer Input Grid */}
          <div className="card listening-answer-section">
            <h3 className="listening-answer-title">
              Enter answers — Section {sections[activeSection].section_number}
            </h3>
            <div className="listening-answer-grid">
              {getQuestionRange(sections[activeSection].question_range).map(q => {
                const isCorrect = checkAnswer(q)
                const dispAnswer = getDisplayAnswer(q)
                const ak = getCorrectAnswerForQuestion(q, answerKey)
                return (
                  <div key={q} className="listening-q-row">
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
                      <div className="listening-q-feedback" style={{ color: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)' }}>
                        {isCorrect ? '✓' : '✗'} <span style={{ color: 'var(--status-correct)' }}>{dispAnswer}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Question Palette */}
          <div className="card">
            <h4 className="listening-palette-title">
              Question Palette
            </h4>
            <div className="question-palette" style={{ boxShadow: 'none', padding: 0 }}>
              {Array.from({ length: 40 }, (_, i) => i + 1).map(q => {
                const isAnswered = (answers[q] ?? '').trim() !== ''
                const sectionIdx = sections.findIndex(s => {
                  const [start, end] = s.question_range.split('-').map(Number)
                  return q >= start && q <= end
                })
                const isInActiveSection = sectionIdx === activeSection
                return (
                  <div
                    key={q}
                    className={`question-palette__item ${isAnswered ? 'question-palette__item--answered' : ''} ${isInActiveSection ? 'question-palette__item--current' : ''}`}
                    onClick={() => {
                      if (sectionIdx >= 0) setActiveSection(sectionIdx)
                    }}
                    title={`Question ${q}`}
                  >
                    {q}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="listening-legend-container">
              <div className="listening-legend-item">
                <div className="listening-legend-dot" style={{ background: 'var(--accent-blue)' }} />
                Answered
              </div>
              <div className="listening-legend-item">
                <div className="listening-legend-dot" style={{ border: '2px solid var(--ielts-red)' }} />
                Current Section
              </div>
              <div className="listening-legend-item">
                <div className="listening-legend-dot" style={{ border: '2px solid var(--border-light)' }} />
                Unanswered
              </div>
            </div>
          </div>

          {/* Explanations (after submit) */}
          {isSubmitted && answerKey && (
            <div className="card listening-explanations-section">
              <h4 className="listening-explanations-title">
                📝 Answer Explanations — Section {sections[activeSection].section_number}
              </h4>
              <div className="listening-explanations-grid">
                {getQuestionRange(sections[activeSection].question_range).map(q => {
                  const ak = getCorrectAnswerForQuestion(q, answerKey)
                  if (!ak || !ak.explanation) return null
                  const isCorrect = checkAnswer(q)
                  const dispAnswer = getDisplayAnswer(q)
                  return (
                    <div key={q} className="listening-explanation-card" style={{
                      borderLeft: `3px solid ${isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)'}`,
                    }}>
                      <strong style={{ color: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)' }}>
                        Question {q}:
                      </strong>{' '}
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

      {/* Result Modal */}
      <ResultModal
        isOpen={showResult && !!result}
        emoji="🎧"
        title="Listening Result"
        testNumber={test}
        correctCount={result?.correct ?? 0}
        totalCount={result?.total ?? 40}
        bandScore={estimateListeningBand(result?.correct ?? 0)}
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
