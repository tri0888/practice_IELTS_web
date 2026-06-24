"use client"
import { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import './history.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function checkAnswerCorrect(userAns: string | undefined, correctAnsStr: string | undefined): boolean {
  if (!userAns || !correctAnsStr) return false;
  
  const clean = (s: string) => s.toLowerCase().trim().replace(/[\.,;:!\?"']/g, '').replace(/\s+/g, ' ');
  const uClean = clean(userAns);
  if (!uClean) return false;
  
  // Split by '/' for alternative answers
  const options = correctAnsStr.split(/\s+\/\s+/).map(clean);
  if (options.includes(uClean)) return true;
  
  // Check if there are parenthesis options
  // e.g. "a book (of drawings)" matches "a book" or "a book of drawings"
  const expandParentheses = (s: string): string[] => {
    const match = s.match(/\(([^)]*)\)/);
    if (!match) return [s];
    const start = s.indexOf(match[0]);
    const end = start + match[0].length;
    const prefix = s.slice(0, start);
    const inner = match[1];
    const suffix = s.slice(end);
    
    const opt1 = prefix + suffix;
    const opt2 = prefix + inner + suffix;
    return [...expandParentheses(opt1), ...expandParentheses(opt2)];
  };
  
  for (const opt of correctAnsStr.split(/\s+\/\s+/)) {
    const expanded = expandParentheses(opt).map(clean);
    if (expanded.includes(uClean)) return true;
  }
  
  // Hyphen fallback
  const parts = correctAnsStr.split(/\s*[-–—]\s*/);
  if (parts.length > 1) {
    if (uClean === clean(parts[0])) return true;
  }
  
  return false;
}

export default function HistoryPage() {
  const { data: attempts, mutate: mutateAttempts, isLoading } = useSWR('/api/attempts', fetcher)
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)
  const [selectedQNum, setSelectedQNum] = useState<number | null>(null)
  
  // Fetch detail for selected attempt
  const { data: detail, isLoading: detailLoading } = useSWR(
    selectedAttemptId ? `/api/attempts/${selectedAttemptId}/result` : null,
    fetcher
  )

  // Filter only completed (graded) attempts
  const completedAttempts = useMemo(() => {
    if (!attempts || !Array.isArray(attempts)) return []
    return attempts.filter((att: any) => att.result && typeof att.result.correct === 'number')
  }, [attempts])

  // Auto-select the first completed attempt
  useEffect(() => {
    if (!selectedAttemptId && completedAttempts.length > 0) {
      setSelectedAttemptId(completedAttempts[0].id)
    }
  }, [completedAttempts, selectedAttemptId])

  const handleDeleteAttempt = async (e: React.MouseEvent, attemptId: string) => {
    e.stopPropagation()
    if (window.confirm("Are you sure you want to delete this test attempt from your history?")) {
      try {
        const resp = await fetch(`/api/attempts/${attemptId}`, { method: 'DELETE' })
        if (resp.ok) {
          mutateAttempts()
          if (selectedAttemptId === attemptId) {
            setSelectedAttemptId(null)
            setSelectedQNum(null)
          }
        } else {
          alert("Failed to delete attempt.")
        }
      } catch (err) {
        console.error("Failed to delete test attempt", err)
      }
    }
  }

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '---'
    try {
      const d = new Date(isoStr)
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    } catch (e) {
      return '---'
    }
  }

  const formatSkillName = (skill: string) => {
    if (!skill) return ''
    if (skill === 'listening') return '🎧 IELTS Listening'
    if (skill === 'reading') return '📖 IELTS Reading'
    if (skill === 'writing') return '✍️ IELTS Writing'
    if (skill === 'speaking') return '🎙️ IELTS Speaking'
    if (skill === 'ets_lc') return '🎧 TOEIC Listening (LC)'
    if (skill === 'ets_rc') return '📖 TOEIC Reading (RC)'
    return skill
  }

  const formatTestName = (att: any) => {
    if (!att || !att.skill) return ''
    if (att.skill.startsWith('ets_')) {
      return `ETS ${att.book} — Test ${att.test}`
    } else {
      return `Cam ${att.book} — Test ${att.test}`
    }
  }

  const getQuestionNumbers = (skill: string) => {
    if (!skill) return []
    const s = skill.toLowerCase()
    if (s === 'ets_rc') {
      return Array.from({ length: 100 }, (_, i) => i + 101)
    }
    if (s === 'ets_lc') {
      return Array.from({ length: 100 }, (_, i) => i + 1)
    }
    return Array.from({ length: 40 }, (_, i) => i + 1)
  }

  // Map of responses for quick lookup
  const userResponsesMap = useMemo(() => {
    if (!detail || !Array.isArray(detail.responses)) return new Map<string, string>()
    return new Map<string, string>(
      detail.responses.map((r: any) => [r.question_number.toString(), r.answer || ''])
    )
  }, [detail])

  const parsedQuestions = useMemo(() => {
    if (!detail) return []
    const qNums = getQuestionNumbers(detail.skill || '')
    const correctAnswers = detail.correct_answers || {}
    
    return qNums.map(qNum => {
      const qStr = qNum.toString()
      const userAns = userResponsesMap.get(qStr) || ''
      const correctAns = correctAnswers[qStr] || ''
      
      const isAnswered = userAns.trim() !== ''
      const isCorrect = isAnswered && checkAnswerCorrect(userAns, correctAns)
      
      let status: 'correct' | 'incorrect' | 'blank' = 'blank'
      if (isAnswered) {
        status = isCorrect ? 'correct' : 'incorrect'
      }

      return {
        qNum,
        userAns,
        correctAns,
        status
      }
    })
  }, [detail, userResponsesMap])

  const selectedQuestionObj = useMemo(() => {
    if (selectedQNum === null) return null
    return parsedQuestions.find(q => q.qNum === selectedQNum) || null
  }, [parsedQuestions, selectedQNum])

  return (
    <div className="history-container fade-in">
      {/* Sidebar List */}
      <div className="history-list-panel">
        <div className="history-list-header">
          <Link href="/Home" className="btn-back-home">
            ← Home
          </Link>
          <h2 className="history-title">📜 Test History</h2>
          <p className="history-subtitle">Review your completed tests and analyze detailed answers.</p>
        </div>

        <div className="history-list-scrollable">
          {isLoading && (
            <div className="history-loading-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton history-card-skeleton" />
              ))}
            </div>
          )}

          {!isLoading && completedAttempts.length === 0 && (
            <div className="history-empty-list">
              <span className="empty-icon">📂</span>
              <p>No test attempts recorded yet.</p>
              <Link href="/tests" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
                Practice Now
              </Link>
            </div>
          )}

          {!isLoading && completedAttempts.map((att: any) => {
            const isGraded = att.result && typeof att.result.correct === 'number'
            const percent = isGraded ? Math.round((att.result.correct / att.result.total) * 100) : null
            const isToeic = att.skill && att.skill.startsWith('ets_')
            const isSelected = selectedAttemptId === att.id

            return (
              <div 
                key={att.id} 
                className={`history-item-card ${isSelected ? 'active' : ''} ${isToeic ? 'toeic-attempt' : 'ielts-attempt'}`}
                onClick={() => {
                  setSelectedAttemptId(att.id)
                  setSelectedQNum(null)
                }}
              >
                <div className="history-card-header">
                  <div className="history-card-name">{formatTestName(att)}</div>
                  <button 
                    className="btn-delete-history"
                    onClick={(e) => handleDeleteAttempt(e, att.id)}
                    title="Delete this attempt"
                  >
                    🗑️
                  </button>
                </div>
                <div className="history-card-skill">{formatSkillName(att.skill)}</div>
                
                <div className="history-card-footer">
                  <span className="history-card-date">{formatDate(att.submitted_at || att.started_at)}</span>
                  {isGraded ? (
                    <span 
                      className="history-card-score-badge"
                      style={{
                        background: att.skill && att.skill.startsWith('ets_') ? '#f0fdf4' : '#fef2f2',
                        color: att.skill && att.skill.startsWith('ets_') ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {att.result.correct}/{att.result.total} ({percent}%)
                    </span>
                  ) : (
                    <span className="history-card-status-badge">Submitted</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="history-detail-panel">
        {!selectedAttemptId && (
          <div className="history-empty-detail">
            <div className="empty-detail-glow" />
            <span className="empty-detail-icon">🔍</span>
            <h3>View Attempt Details</h3>
            <p>Select a test from the list on the left to see detailed results.</p>
          </div>
        )}

        {selectedAttemptId && detailLoading && (
          <div className="history-detail-loading">
            <div className="spinner" />
            <p>Loading detailed results...</p>
          </div>
        )}

        {selectedAttemptId && !detailLoading && detail && (
          <div className="history-detail-content fade-in">
            <div className="detail-header">
              <h3 className="detail-title">{formatTestName(detail)}</h3>
              <div className="detail-skill-badge">{formatSkillName(detail.skill)}</div>
              <p className="detail-date">Attempted at: {formatDate(detail.submitted_at || detail.started_at)}</p>
            </div>

            {/* Score Stats widget */}
            {detail.result && typeof detail.result.correct === 'number' && (
              <div className="detail-stats">
                <div className="detail-stat-card">
                  <div className="detail-stat-val text-success">
                    {detail.result.correct}
                  </div>
                  <div className="detail-stat-label">Correct Answers</div>
                </div>
                <div className="detail-stat-card">
                  <div className="detail-stat-val text-error">
                    {detail.result.total - detail.result.correct}
                  </div>
                  <div className="detail-stat-label">Incorrect Answers</div>
                </div>
                <div className="detail-stat-card">
                  <div className="detail-stat-val text-primary">
                    {Math.round((detail.result.correct / detail.result.total) * 100)}%
                  </div>
                  <div className="detail-stat-label">Accuracy Rate</div>
                </div>
              </div>
            )}

            {/* Question Grid Overview */}
            <div className="detail-section">
              <h4 className="detail-section-title">🎯 Question Map</h4>
              <div className="question-grid-overview">
                {parsedQuestions.map((q) => (
                  <button 
                    key={q.qNum}
                    onClick={() => setSelectedQNum(q.qNum)} 
                    className={`question-circle-item ${q.status} ${selectedQNum === q.qNum ? 'focused' : ''}`}
                    title={`Question ${q.qNum}: ${q.status === 'correct' ? 'Correct' : q.status === 'incorrect' ? 'Incorrect' : 'Unanswered'}\nYour Answer: ${q.userAns || 'Unanswered'}\nCorrect Answer: ${q.correctAns}`}
                  >
                    {q.qNum}
                  </button>
                ))}
              </div>
              <div className="question-grid-legend">
                <span className="legend-item"><span className="legend-dot legend-dot--correct" /> Correct</span>
                <span className="legend-item"><span className="legend-dot legend-dot--incorrect" /> Incorrect</span>
                <span className="legend-item"><span className="legend-dot legend-dot--blank" /> Unanswered</span>
              </div>
            </div>

            {/* Selected Question Detail Comparison */}
            <div className="detail-section selected-question-section">
              {selectedQuestionObj ? (
                <div className={`selected-question-box ${selectedQuestionObj.status}`}>
                  <div className="selected-question-box__header">
                    <span className="selected-question-title">Question {selectedQuestionObj.qNum}</span>
                    <span className={`selected-question-badge ${selectedQuestionObj.status}`}>
                      {selectedQuestionObj.status === 'correct' ? '✓ Correct' : selectedQuestionObj.status === 'incorrect' ? '✗ Incorrect' : '- Unanswered'}
                    </span>
                  </div>
                  <div className="selected-question-compare">
                    <div className="compare-item">
                      <span className="compare-item__label">Your Answer</span>
                      <span className={`compare-item__val user-ans ${selectedQuestionObj.status}`}>
                        {selectedQuestionObj.userAns || <span className="empty-text">Blank</span>}
                      </span>
                    </div>
                    <div className="compare-item">
                      <span className="compare-item__label">Correct Answer</span>
                      <span className="compare-item__val correct-ans">
                        {selectedQuestionObj.correctAns || <span className="empty-text">---</span>}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="selected-question-placeholder">
                  💡 Click on a question number above to view your answer and the correct answer.
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
