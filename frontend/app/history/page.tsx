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
    if (window.confirm("Bạn có chắc chắn muốn xóa bài thi này khỏi lịch sử làm bài không?")) {
      try {
        const resp = await fetch(`/api/attempts/${attemptId}`, { method: 'DELETE' })
        if (resp.ok) {
          mutateAttempts()
          if (selectedAttemptId === attemptId) {
            setSelectedAttemptId(null)
            setSelectedQNum(null)
          }
        } else {
          alert("Không thể xóa bài làm.")
        }
      } catch (err) {
        console.error("Xóa bài thi thất bại", err)
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
    if (skill === 'listening') return '🎧 IELTS Listening'
    if (skill === 'reading') return '📖 IELTS Reading'
    if (skill === 'writing') return '✍️ IELTS Writing'
    if (skill === 'speaking') return '🎙️ IELTS Speaking'
    if (skill === 'ets_lc') return '🎧 TOEIC Listening (LC)'
    if (skill === 'ets_rc') return '📖 TOEIC Reading (RC)'
    return skill
  }

  const formatTestName = (att: any) => {
    if (att.skill.startsWith('ets_')) {
      return `ETS ${att.book} — Đề ${att.test}`
    } else {
      return `Cam ${att.book} — Test ${att.test}`
    }
  }

  const getQuestionNumbers = (skill: string) => {
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
          <Link href="/" className="btn-back-home">
            ← Trang chủ
          </Link>
          <h2 className="history-title">📜 Lịch sử làm bài</h2>
          <p className="history-subtitle">Xem lại các bài thi đã làm và phân tích đáp án chi tiết.</p>
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
              <p>Chưa có bài thi nào được ghi nhận.</p>
              <Link href="/" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
                Luyện tập ngay
              </Link>
            </div>
          )}

          {!isLoading && completedAttempts.map((att: any) => {
            const isGraded = att.result && typeof att.result.correct === 'number'
            const percent = isGraded ? Math.round((att.result.correct / att.result.total) * 100) : null
            const isToeic = att.skill.startsWith('ets_')
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
                    title="Xóa kết quả này"
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
                        background: att.skill.startsWith('ets_') ? '#f0fdf4' : '#fef2f2',
                        color: att.skill.startsWith('ets_') ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {att.result.correct}/{att.result.total} ({percent}%)
                    </span>
                  ) : (
                    <span className="history-card-status-badge">Đã nộp</span>
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
            <h3>Xem chi tiết bài làm</h3>
            <p>Chọn một bài thi từ danh sách bên trái để xem lại kết quả chi tiết từng câu hỏi.</p>
          </div>
        )}

        {selectedAttemptId && detailLoading && (
          <div className="history-detail-loading">
            <div className="spinner" />
            <p>Đang tải chi tiết kết quả...</p>
          </div>
        )}

        {selectedAttemptId && !detailLoading && detail && (
          <div className="history-detail-content fade-in">
            <div className="detail-header">
              <h3 className="detail-title">{formatTestName(detail)}</h3>
              <div className="detail-skill-badge">{formatSkillName(detail.skill)}</div>
              <p className="detail-date">Làm bài lúc: {formatDate(detail.submitted_at || detail.started_at)}</p>
            </div>

            {/* Score Stats widget */}
            {detail.result && typeof detail.result.correct === 'number' && (
              <div className="detail-stats">
                <div className="detail-stat-card">
                  <div className="detail-stat-val text-success">
                    {detail.result.correct}
                  </div>
                  <div className="detail-stat-label">Số câu trả lời đúng</div>
                </div>
                <div className="detail-stat-card">
                  <div className="detail-stat-val text-error">
                    {detail.result.total - detail.result.correct}
                  </div>
                  <div className="detail-stat-label">Số câu trả lời sai</div>
                </div>
                <div className="detail-stat-card">
                  <div className="detail-stat-val text-primary">
                    {Math.round((detail.result.correct / detail.result.total) * 100)}%
                  </div>
                  <div className="detail-stat-label">Tỷ lệ chính xác</div>
                </div>
              </div>
            )}

            {/* Question Grid Overview */}
            <div className="detail-section">
              <h4 className="detail-section-title">🎯 Bản đồ câu hỏi</h4>
              <div className="question-grid-overview">
                {parsedQuestions.map((q) => (
                  <button 
                    key={q.qNum}
                    onClick={() => setSelectedQNum(q.qNum)} 
                    className={`question-circle-item ${q.status} ${selectedQNum === q.qNum ? 'focused' : ''}`}
                    title={`Câu ${q.qNum}: ${q.status === 'correct' ? 'Đúng' : q.status === 'incorrect' ? 'Sai' : 'Chưa trả lời'}\nĐáp án của bạn: ${q.userAns || 'Chưa trả lời'}\nĐáp án đúng: ${q.correctAns}`}
                  >
                    {q.qNum}
                  </button>
                ))}
              </div>
              <div className="question-grid-legend">
                <span className="legend-item"><span className="legend-dot legend-dot--correct" /> Đúng</span>
                <span className="legend-item"><span className="legend-dot legend-dot--incorrect" /> Sai</span>
                <span className="legend-item"><span className="legend-dot legend-dot--blank" /> Chưa làm</span>
              </div>
            </div>

            {/* Selected Question Detail Comparison (First section details replacement) */}
            <div className="detail-section selected-question-section">
              {selectedQuestionObj ? (
                <div className={`selected-question-box ${selectedQuestionObj.status}`}>
                  <div className="selected-question-box__header">
                    <span className="selected-question-title">Câu hỏi {selectedQuestionObj.qNum}</span>
                    <span className={`selected-question-badge ${selectedQuestionObj.status}`}>
                      {selectedQuestionObj.status === 'correct' ? '✓ Đúng' : selectedQuestionObj.status === 'incorrect' ? '✗ Sai' : '- Chưa trả lời'}
                    </span>
                  </div>
                  <div className="selected-question-compare">
                    <div className="compare-item">
                      <span className="compare-item__label">Câu trả lời của bạn</span>
                      <span className={`compare-item__val user-ans ${selectedQuestionObj.status}`}>
                        {selectedQuestionObj.userAns || <span className="empty-text">Bỏ trống</span>}
                      </span>
                    </div>
                    <div className="compare-item">
                      <span className="compare-item__label">Đáp án đúng</span>
                      <span className="compare-item__val correct-ans">
                        {selectedQuestionObj.correctAns || <span className="empty-text">---</span>}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="selected-question-placeholder">
                  💡 Nhấp vào một số câu hỏi ở trên để xem chi tiết câu trả lời của bạn và đáp án đúng.
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
