"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react'
import useSWR from 'swr'
import './page.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type WordItem = {
  vocab: string
  pronunciation: string
  POS: string
  definition: string
  status: 'unlearned' | 'learning' | 'mastered'
  correct_count: number
  wrong_count: number
}

type MatchItem = {
  id: string
  text: string
  type: 'word' | 'def'
  vocab: string
  matchId: number
}

export default function VocabularyPage() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'library' | 'flashcards' | 'practice'>('library')

  // Global Statistics SWR fetcher
  const { data: stats, error: statsError, mutate: mutateStats } = useSWR('/api/vocabulary/stats', fetcher)

  // Speak helper using Web Speech API
  const speakWord = (word: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel() // stop any current speaking
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    
    // Attempt to locate a premium natural English voice
    const voices = window.speechSynthesis.getVoices()
    const enVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB'))
    if (enVoice) {
      utterance.voice = enVoice
    }
    window.speechSynthesis.speak(utterance)
  }

  // Common progress update POST helper
  const updateWordProgress = async (
    vocab: string,
    updateData: { status?: string; is_correct?: boolean }
  ) => {
    try {
      const res = await fetch('/api/vocabulary/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocab, ...updateData }),
      })
      if (res.ok) {
        // Trigger local mutations to refresh cache
        mutateStats()
        return true
      }
    } catch (err) {
      console.error('Failed to update vocabulary progress:', err)
    }
    return false
  }

  return (
    <div className="vocab-view fade-in">
      <div className="vocab-container">
        {/* Header Title Area */}
        <div className="vocab-header">
          <div className="vocab-title-area">
            <h2>📖 Vocabulary Lab</h2>
            <p>Develop your academic word bank for IELTS and TOEIC with flashcards, tests, and interactive matches.</p>
          </div>
        </div>

        {/* Global Statistics Hub Dashboard */}
        {stats && (
          <div className="vocab-stats-grid">
            <div className="vocab-stat-card">
              <span className="vocab-stat-val">{stats.total_words || 0}</span>
              <span className="vocab-stat-label">Total Words</span>
            </div>
            <div className="vocab-stat-card">
              <span className="vocab-stat-val" style={{ color: 'var(--text-muted)' }}>
                {(stats.total_words || 0) - (stats.learning_count || 0) - (stats.mastered_count || 0)}
              </span>
              <span className="vocab-stat-label">Unlearned 🆕</span>
            </div>
            <div className="vocab-stat-card">
              <span className="vocab-stat-val" style={{ color: 'var(--accent-blue)' }}>
                {stats.learning_count || 0}
              </span>
              <span className="vocab-stat-label">Learning ✏️</span>
            </div>
            <div className="vocab-stat-card">
              <span className="vocab-stat-val" style={{ color: 'var(--accent-green)' }}>
                {stats.mastered_count || 0}
              </span>
              <span className="vocab-stat-label">Mastered ✅</span>
            </div>
            <div className="vocab-stat-card">
              <span className="vocab-stat-val">
                {stats.accuracy !== undefined ? `${stats.accuracy}%` : '---'}
              </span>
              <span className="vocab-stat-label">Quiz Accuracy</span>
            </div>
          </div>
        )}

        {/* Tabs Bar Navigation */}
        <div className="vocab-tabs-nav">
          <button
            type="button"
            className={`vocab-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <span>📑</span> Library
          </button>
          <button
            type="button"
            className={`vocab-tab-btn ${activeTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => setActiveTab('flashcards')}
          >
            <span>🎴</span> Flashcards
          </button>
          <button
            type="button"
            className={`vocab-tab-btn ${activeTab === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <span>✏️</span> Practice Games
          </button>
        </div>

        {/* Content Render Area depending on Active Tab */}
        <div className="vocab-tab-content">
          {activeTab === 'library' && (
            <LibraryView
              stats={stats}
              speakWord={speakWord}
              updateWordProgress={updateWordProgress}
              mutateStats={mutateStats}
            />
          )}
          {activeTab === 'flashcards' && (
            <FlashcardsView
              stats={stats}
              speakWord={speakWord}
              updateWordProgress={updateWordProgress}
            />
          )}
          {activeTab === 'practice' && (
            <PracticeView
              stats={stats}
              speakWord={speakWord}
              updateWordProgress={updateWordProgress}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   COMPONENT 1: Library View (Word Directory)
   ========================================================================== */
type LibraryViewProps = {
  stats: any
  speakWord: (word: string) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
  mutateStats: () => void
}

function LibraryView({
  stats,
  speakWord,
  updateWordProgress,
  mutateStats,
}: LibraryViewProps) {
  const [page, setPage] = useState(1)
  const [searchVal, setSearchVal] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeWord, setActiveWord] = useState<WordItem | null>(null)
  
  // Bulk selection of mastered vocabs to unmaster them
  const [selectedVocabs, setSelectedVocabs] = useState<Set<string>>(new Set())

  // Search input Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchVal)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchVal])

  // Reset page when POS or status filters update
  const handlePosChange = (pos: string) => {
    setPosFilter(pos)
    setPage(1)
  }

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
    setSelectedVocabs(new Set())
    setPage(1)
  }

  // API query
  const queryStr = `/api/vocabulary?search=${debouncedSearch}&pos=${posFilter}&status=${statusFilter}&page=${page}&limit=24`
  const { data, error, mutate: mutateList } = useSWR(queryStr, fetcher)

  const handleUpdateStatus = async (vocab: string, nextStatus: string) => {
    // Optimistic UI update
    if (data && data.items) {
      mutateList(
        {
          ...data,
          items: data.items.map((w: WordItem) =>
            w.vocab.toLowerCase() === vocab.toLowerCase()
              ? { ...w, status: nextStatus }
              : w
          ),
        },
        false
      )
    }
    if (activeWord && activeWord.vocab.toLowerCase() === vocab.toLowerCase()) {
      setActiveWord(prev => prev ? { ...prev, status: nextStatus as any } : null)
    }

    const success = await updateWordProgress(vocab, { status: nextStatus })
    if (success) {
      mutateList()
    }
  }

  const handleCardClick = (item: WordItem) => {
    setActiveWord(item)
  }

  // Checkbox toggle
  const handleCheckboxChange = (vocab: string) => {
    const vocabLower = vocab.toLowerCase()
    setSelectedVocabs(prev => {
      const next = new Set(prev)
      if (next.has(vocabLower)) {
        next.delete(vocabLower)
      } else {
        next.add(vocabLower)
      }
      return next
    })
  }

  // Bulk unmark mastered (set them back to 'learning' status)
  const handleBulkUnmaster = async () => {
    if (selectedVocabs.size === 0) return
    const vocabsArray = Array.from(selectedVocabs)

    try {
      const res = await fetch('/api/vocabulary/progress/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabs: vocabsArray, status: 'learning' }),
      })
      if (res.ok) {
        setSelectedVocabs(new Set())
        mutateList()
        mutateStats()
      } else {
        alert('Failed to unmark Mastered words.')
      }
    } catch (err) {
      console.error(err)
      alert('Error connecting to backend.')
    }
  }

  const isMasteredMode = statusFilter === 'mastered'

  return (
    <div className="library-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search & Filter Panel */}
      <div className="library-controls">
        <div className="search-row">
          <div className="search-input-wrapper">
            <svg
              className="search-icon-svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search words or Vietnamese definitions..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
            />
          </div>
        </div>

        {/* Word POS filters */}
        {stats && stats.unique_pos && stats.unique_pos.length > 0 && (
          <div className="filter-group">
            <div className="filter-label">Word Types:</div>
            <div className="filter-tags">
              <button
                type="button"
                className={`filter-tag ${posFilter === '' ? 'active' : ''}`}
                onClick={() => handlePosChange('')}
              >
                All
              </button>
              {stats.unique_pos.map((pos: string) => (
                <button
                  type="button"
                  key={pos}
                  className={`filter-tag ${posFilter === pos ? 'active' : ''}`}
                  onClick={() => handlePosChange(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress Filters */}
        <div className="filter-group">
          <div className="filter-label">Learning Status:</div>
          <div className="filter-tags">
            <button
              type="button"
              className={`filter-tag ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => handleStatusChange('')}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-tag ${statusFilter === 'unlearned' ? 'active' : ''}`}
              onClick={() => handleStatusChange('unlearned')}
            >
              🆕 Unlearned
            </button>
            <button
              type="button"
              className={`filter-tag ${statusFilter === 'learning' ? 'active' : ''}`}
              onClick={() => handleStatusChange('learning')}
            >
              ✏️ Learning
            </button>
            <button
              type="button"
              className={`filter-tag ${statusFilter === 'mastered' ? 'active' : ''}`}
              onClick={() => handleStatusChange('mastered')}
            >
              ✅ Mastered
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Vocabulary cards */}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--status-wrong)' }}>
          ⚠️ Failed to fetch words list. Please ensure backend server is online.
        </div>
      )}

      {!data && !error && (
        <div style={{ textAlign: 'center', padding: '80px', fontWeight: 600, color: 'var(--text-muted)' }}>
          Loading vocabulary directory...
        </div>
      )}

      {data && (
        <>
          {/* Bulk Action Header bar */}
          {selectedVocabs.size > 0 && (
            <div className="bulk-actions-bar animate-slide-down">
              <div className="bulk-actions-info">
                Selected <strong>{selectedVocabs.size}</strong> mastered words to unmark
              </div>
              <button type="button" className="bulk-action-btn" onClick={handleBulkUnmaster}>
                Unmark Mastered
              </button>
            </div>
          )}

          {data.total > data.limit && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total words matching filters: {data.total}
            </div>
          )}

          {data.items.length === 0 ? (
            <div
              style={{
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '80px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              🔍 No vocabulary words found matching these filters. Try refining your search query.
            </div>
          ) : (
            <div className="words-grid">
              {data.items.map((item: WordItem) => {
                const posClass = item.POS.toLowerCase().replace('.', '')
                const isChecked = selectedVocabs.has(item.vocab.toLowerCase())
                return (
                  <div
                    key={item.vocab}
                    className="word-card"
                    onClick={() => handleCardClick(item)}
                  >
                    <div className="word-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isMasteredMode && (
                          <div className="card-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="card-checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange(item.vocab)}
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="word-title">{item.vocab}</span>
                          <span className="word-pron">{item.pronunciation}</span>
                        </div>
                      </div>
                      <span className={`word-pos-badge ${posClass}`}>{item.POS}</span>
                    </div>

                    <p className="word-def">{item.definition}</p>

                    <div className="word-card-bottom">
                      <div className="word-stats">
                        {item.status !== 'unlearned' && (
                          <span
                            style={{
                              color:
                                item.status === 'mastered'
                                  ? 'var(--accent-green)'
                                  : 'var(--accent-blue)',
                              fontWeight: 700,
                            }}
                          >
                            {item.status === 'mastered' ? 'Mastered' : 'Learning'}
                          </span>
                        )}
                        <span>{item.correct_count}/{item.correct_count + item.wrong_count} correct</span>
                      </div>

                      <div className="word-actions">
                        <button
                          type="button"
                          className="action-btn"
                          title="Listen pronunciation"
                          onClick={(e) => {
                            e.stopPropagation()
                            speakWord(item.vocab)
                          }}
                        >
                          🔊
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination bar */}
          {data.total > data.limit && (
            <div className="pagination-container">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {Math.ceil(data.total / data.limit)}
              </span>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(data.total / data.limit)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Drawer Details */}
      {activeWord && (
        <div className="modal-overlay" onClick={() => setActiveWord(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="action-btn"
                  style={{ fontSize: '1.25rem' }}
                  onClick={() => speakWord(activeWord.vocab)}
                >
                  🔊
                </button>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveWord(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-word-header">
                <div className="detail-vocab-row">
                  <span className="detail-vocab">{activeWord.vocab}</span>
                  <span className={`word-pos-badge ${activeWord.POS.toLowerCase().replace('.', '')}`}>
                    {activeWord.POS}
                  </span>
                </div>
                <div className="detail-pron-row">
                  <span className="detail-pron">{activeWord.pronunciation}</span>
                </div>
              </div>

              <div className="detail-def-box">
                <div className="detail-def-title">Vietnamese Definition</div>
                <div className="detail-def-text">{activeWord.definition}</div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Mark Mastery:</div>
                <div className="status-toggles">
                  <button
                    type="button"
                    className={`status-toggle-btn ${activeWord.status === 'unlearned' ? 'active-unlearned' : ''}`}
                    onClick={() => handleUpdateStatus(activeWord.vocab, 'unlearned')}
                  >
                    Unlearned
                  </button>
                  <button
                    type="button"
                    className={`status-toggle-btn ${activeWord.status === 'learning' ? 'active-learning' : ''}`}
                    onClick={() => handleUpdateStatus(activeWord.vocab, 'learning')}
                  >
                    Learning
                  </button>
                  <button
                    type="button"
                    className={`status-toggle-btn ${activeWord.status === 'mastered' ? 'active-mastered' : ''}`}
                    onClick={() => handleUpdateStatus(activeWord.vocab, 'mastered')}
                  >
                    Mastered
                  </button>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Practice Metrics:</div>
                <div className="detail-stats-row">
                  <div className="detail-stat-box">
                    <div className="detail-def-title" style={{ color: 'var(--accent-green)' }}>Correct Answers</div>
                    <div className="detail-stat-box-val" style={{ color: 'var(--status-correct)' }}>
                      {activeWord.correct_count}
                    </div>
                  </div>
                  <div className="detail-stat-box">
                    <div className="detail-def-title" style={{ color: 'var(--status-wrong)' }}>Incorrect Answers</div>
                    <div className="detail-stat-box-val" style={{ color: 'var(--status-wrong)' }}>
                      {activeWord.wrong_count}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   COMPONENT 2: Flashcards View
   ========================================================================== */
function FlashcardsView({
  stats,
  speakWord,
  updateWordProgress,
}: {
  stats: any
  speakWord: (word: string) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [mode, setMode] = useState<'random' | 'studied'>('random')
  const [posFilter, setPosFilter] = useState('')
  const [limit, setLimit] = useState(15)

  const [deck, setDeck] = useState<WordItem[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const activeCard = deck[cardIndex]

  // Automatically speak the word once when the card changes
  useEffect(() => {
    if (isPlaying && activeCard) {
      const timer = setTimeout(() => {
        speakWord(activeCard.vocab)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isPlaying, cardIndex, activeCard, speakWord])

  // Reset posFilter if changing mode leaves us with an invalid category
  const handleModeChange = (newMode: 'random' | 'studied') => {
    setMode(newMode)
    if (newMode === 'studied' && stats?.studied_pos) {
      if (posFilter !== "" && !stats.studied_pos.includes(posFilter)) {
        setPosFilter("")
      }
    }
  }

  const startFlashcards = async () => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const url = `/api/vocabulary/practice?mode=${mode}&pos=${posFilter}&limit=${limit}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.length === 0) {
          setErrorMsg('No eligible practice words available (Mastered words are excluded).')
        } else {
          setDeck(data)
          setCardIndex(0)
          setIsPlaying(true)
        }
      } else {
        setErrorMsg('Failed to load flashcard deck. Verify the server connection.')
      }
    } catch (err) {
      setErrorMsg('Network error loading flashcards.')
    } finally {
      setIsLoading(false)
    }
  }

  // Flat flashcard Next action: automatically sets status to "learning" and advances
  const handleNextCard = async () => {
    if (!activeCard) return
    const word = activeCard.vocab
    
    // Save to learning/review pool immediately
    await updateWordProgress(word, { status: 'learning' })
    setCardIndex(idx => idx + 1)
  }

  // Determine dynamic list of POS choices
  const availablePosList = useMemo(() => {
    if (mode === 'studied') {
      return stats?.studied_pos || []
    }
    return stats?.unique_pos || []
  }, [mode, stats])

  if (isPlaying && cardIndex >= deck.length) {
    return (
      <div className="victory-box">
        <span className="victory-icon">🎉</span>
        <h3 className="match-victory-title">Flashcard Deck Completed!</h3>
        <p>You reviewed all {deck.length} words. They have been added to your Studied Words pool.</p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button type="button" className="start-deck-btn" onClick={startFlashcards}>
            Study Again
          </button>
          <button
            type="button"
            className="spelling-btn"
            style={{ padding: '12px 28px' }}
            onClick={() => setIsPlaying(false)}
          >
            Setup Deck
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flashcards-view-container">
      {!isPlaying ? (
        <div className="deck-selector-box">
          <span style={{ fontSize: '3rem' }}>🎴</span>
          <h3>Vocabulary Flashcards</h3>
          <p>Review academic words with flat description sheets. All words studied will go into your Studied Words pool.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', textAlign: 'left' }}>
            <div className="filter-group">
              <span className="filter-label">Practice Focus:</span>
              <div className="filter-tags">
                <button
                  type="button"
                  className={`filter-tag ${mode === 'random' ? 'active' : ''}`}
                  onClick={() => handleModeChange('random')}
                >
                  All Words
                </button>
                <button
                  type="button"
                  className={`filter-tag ${mode === 'studied' ? 'active' : ''}`}
                  onClick={() => handleModeChange('studied')}
                  disabled={!stats || !stats.studied_count}
                  style={{ opacity: !stats || !stats.studied_count ? 0.5 : 1 }}
                >
                  Studied Words ({stats?.studied_count || 0})
                </button>
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Filter by Word Type:</span>
              <select
                className="spelling-input"
                style={{ fontSize: '0.95rem', padding: '10px', height: 'auto', width: '100%', maxWidth: 'none' }}
                value={posFilter}
                onChange={e => setPosFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {availablePosList.map((pos: string) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Deck Size:</span>
              <div className="filter-tags">
                {[15, 20, 30].map(n => (
                  <button
                    type="button"
                    key={n}
                    className={`filter-tag ${limit === n ? 'active' : ''}`}
                    onClick={() => setLimit(n)}
                  >
                    {n} Cards
                  </button>
                ))}
              </div>
            </div>
          </div>

          {errorMsg && <div style={{ color: 'var(--status-wrong)', fontSize: '0.9rem' }}>⚠️ {errorMsg}</div>}

          <button
            type="button"
            className="start-deck-btn"
            disabled={isLoading}
            onClick={startFlashcards}
            style={{ width: '100%' }}
          >
            {isLoading ? 'Building deck...' : 'Start Review'}
          </button>
        </div>
      ) : (
        <div className="flashcard-game-container">
          <div className="game-top-bar">
            <button type="button" className="game-quit-btn" onClick={() => setIsPlaying(false)}>
              Quit Session
            </button>
            <div className="flashcard-deck-info">
              <span>Card {cardIndex + 1} of {deck.length}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flashcard-progress-bar-bg">
            <div
              className="flashcard-progress-bar-fill"
              style={{ width: `${((cardIndex) / deck.length) * 100}%` }}
            ></div>
          </div>

          {/* Flat Flashcard containing full details */}
          {activeCard && (
            <div className="card-face" style={{ height: '320px', cursor: 'default' }}>
              <div className="card-face-top">
                <span className={`word-pos-badge ${activeCard.POS.toLowerCase().replace('.', '')}`}>
                  {activeCard.POS}
                </span>
                <button
                  type="button"
                  className="action-btn"
                  title="Listen pronunciation"
                  onClick={() => speakWord(activeCard.vocab)}
                >
                  🔊
                </button>
              </div>
              
              <div className="card-face-mid" style={{ gap: '10px' }}>
                <span className="card-vocab-text">{activeCard.vocab}</span>
                <span className="word-pron" style={{ fontSize: '1.25rem' }}>{activeCard.pronunciation}</span>
                <span className="card-definition-text" style={{ marginTop: '10px' }}>{activeCard.definition}</span>
              </div>

              <span className="card-hint-text">Progress: {cardIndex + 1}/{deck.length} cards</span>
            </div>
          )}

          {/* Single Next Card action button */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              type="button"
              className="start-deck-btn"
              onClick={handleNextCard}
              style={{ width: '100%', padding: '14px' }}
            >
              {cardIndex === deck.length - 1 ? 'Finish Deck ➔' : 'Next Card ➔'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   COMPONENT 3: Practice Games View
   ========================================================================== */
function PracticeView({
  stats,
  speakWord,
  updateWordProgress,
}: {
  stats: any
  speakWord: (word: string) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [activeGame, setActiveGame] = useState<'translation' | 'spelling' | 'matching' | null>(null)
  
  // Game Setup variables
  const [mode, setMode] = useState<'random' | 'studied'>('random')
  const [posFilter, setPosFilter] = useState('')
  const [limit, setLimit] = useState(15)

  const [deck, setDeck] = useState<WordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Reset posFilter if changing mode leaves us with an invalid category
  const handleModeChange = (newMode: 'random' | 'studied') => {
    setMode(newMode)
    if (newMode === 'studied' && stats?.studied_pos) {
      if (posFilter !== "" && !stats.studied_pos.includes(posFilter)) {
        setPosFilter("")
      }
    }
  }

  const fetchPracticeDeck = async (count: number = limit) => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const url = `/api/vocabulary/practice?mode=${mode}&pos=${posFilter}&limit=${count}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.length === 0) {
          setErrorMsg('No eligible practice words available (Mastered words are excluded).')
          return null
        }
        return data
      } else {
        setErrorMsg('Failed to load vocabulary words.')
      }
    } catch (err) {
      setErrorMsg('Network error.')
    } finally {
      setIsLoading(false)
    }
    return null
  }

  const handleStartGame = async (gameType: 'translation' | 'spelling' | 'matching') => {
    const count = gameType === 'matching' ? 6 : limit
    const words = await fetchPracticeDeck(count)
    if (words) {
      setDeck(words)
      setActiveGame(gameType)
    }
  }

  // Determine dynamic list of POS choices
  const availablePosList = useMemo(() => {
    if (mode === 'studied') {
      return stats?.studied_pos || []
    }
    return stats?.unique_pos || []
  }, [mode, stats])

  return (
    <div className="practice-view-container">
      {!activeGame ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Game Setup Controls */}
          <div className="library-controls">
            <h3 className="filter-label" style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              ⚙️ Quiz Setup Configuration
            </h3>
            
            <div className="practice-selector" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div className="filter-group">
                <span className="filter-label">Vocabulary Scope:</span>
                <div className="filter-tags">
                  <button
                    type="button"
                    className={`filter-tag ${mode === 'random' ? 'active' : ''}`}
                    onClick={() => handleModeChange('random')}
                  >
                    All Words
                  </button>
                  <button
                    type="button"
                    className={`filter-tag ${mode === 'studied' ? 'active' : ''}`}
                    onClick={() => handleModeChange('studied')}
                    disabled={!stats || !stats.studied_count}
                    style={{ opacity: !stats || !stats.studied_count ? 0.5 : 1 }}
                  >
                    Studied ({stats?.studied_count || 0})
                  </button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">Word Type filter:</span>
                <select
                  className="spelling-input"
                  style={{ fontSize: '0.88rem', padding: '8px', height: 'auto', width: '100%', maxWidth: 'none' }}
                  value={posFilter}
                  onChange={e => setPosFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  {availablePosList.map((pos: string) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">Session length:</span>
                <div className="filter-tags">
                  {[15, 20, 30].map(n => (
                    <button
                      type="button"
                      key={n}
                      className={`filter-tag ${limit === n ? 'active' : ''}`}
                      onClick={() => setLimit(n)}
                    >
                      {n} Qs
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {errorMsg && <div style={{ color: 'var(--status-wrong)', fontSize: '0.88rem', marginTop: '6px' }}>⚠️ {errorMsg}</div>}
          </div>

          {/* Game selection cards */}
          <div className="practice-selector">
            <div className="practice-card" onClick={() => handleStartGame('translation')}>
              <span className="practice-icon">📝</span>
              <h4 className="practice-title">Translation Quiz</h4>
              <p className="practice-desc">Given a random English or Vietnamese word, write the corresponding translation. Automatically matches synonyms.</p>
              <button type="button" className="practice-play-btn" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Play Game'}
              </button>
            </div>

            <div className="practice-card" onClick={() => handleStartGame('spelling')}>
              <span className="practice-icon">🔊</span>
              <h4 className="practice-title">Spelling Bee</h4>
              <p className="practice-desc">Listen to pronunciation audio and write the correct English spelling. Focused purely on audio-based recognition.</p>
              <button type="button" className="practice-play-btn" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Play Game'}
              </button>
            </div>

            <div className="practice-card" onClick={() => handleStartGame('matching')}>
              <span className="practice-icon">⚡</span>
              <h4 className="practice-title">Match Pairs</h4>
              <p className="practice-desc">Connect English words with their definitions in a 6x2 grid as fast as you can. Trains swift recognition.</p>
              <button type="button" className="practice-play-btn" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Play Game'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-screen-wrapper">
          {activeGame === 'translation' && (
            <TranslationGame
              deck={deck}
              onQuit={() => setActiveGame(null)}
              updateWordProgress={updateWordProgress}
            />
          )}
          {activeGame === 'spelling' && (
            <SpellingGame
              deck={deck}
              onQuit={() => setActiveGame(null)}
              speakWord={speakWord}
              updateWordProgress={updateWordProgress}
            />
          )}
          {activeGame === 'matching' && (
            <MatchingGame
              deck={deck}
              onQuit={() => setActiveGame(null)}
              updateWordProgress={updateWordProgress}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   GAME SUB-COMPONENT 1: Translation Game (Fill-in-the-blank)
   ========================================================================== */
function TranslationGame({
  deck,
  onQuit,
  updateWordProgress,
}: {
  deck: WordItem[]
  onQuit: () => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [index, setIndex] = useState(0)
  const [typedWord, setTypedWord] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)

  const activeWord = deck[index]

  // Prompt direction set for each word.
  // en: prompt is English (vocab), answer is Vietnamese (definition)
  // vi: prompt is Vietnamese (definition), answer is English (vocab)
  const promptLang = useMemo(() => {
    return Math.random() < 0.5 ? 'en' : 'vi'
  }, [index])

  const handleVerify = async () => {
    if (!typedWord.trim() || isSubmitted) return

    const input = typedWord.trim().toLowerCase()
    let correct = false

    if (promptLang === 'en') {
      const correctDef = activeWord.definition.toLowerCase().trim()
      const synonyms = activeWord.definition.split(/[,;]/).map(s => s.trim().toLowerCase())
      correct = synonyms.includes(input) || input === correctDef
    } else {
      const correctVocab = activeWord.vocab.toLowerCase().trim()
      correct = input === correctVocab
    }

    setIsCorrect(correct)
    setIsSubmitted(true)

    if (correct) {
      setCorrectCount(c => c + 1)
    } else {
      setWrongCount(c => c + 1)
    }

    await updateWordProgress(activeWord.vocab, { is_correct: correct })
  }

  const handleNext = () => {
    setTypedWord('')
    setIsSubmitted(false)
    setIndex(i => i + 1)
  }

  if (index >= deck.length) {
    const accuracy = Math.round((correctCount / deck.length) * 100)
    return (
      <div className="victory-box">
        <span className="victory-icon">📝</span>
        <h3 className="match-victory-title">Translation Quiz Completed!</h3>
        <p>You finished all translation questions.</p>

        <div className="victory-stats">
          <div className="victory-stat">
            <div className="victory-stat-val" style={{ color: 'var(--accent-green)' }}>{correctCount}</div>
            <div className="filter-label">Correct ✅</div>
          </div>
          <div className="victory-stat">
            <div className="victory-stat-val" style={{ color: 'var(--status-wrong)' }}>{wrongCount}</div>
            <div className="filter-label">Wrong ❌</div>
          </div>
        </div>
        
        <div className="victory-stat" style={{ width: '100%', marginTop: '10px' }}>
          <div className="victory-stat-val" style={{ fontSize: '1.5rem', color: accuracy >= 70 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
            {accuracy}% Accuracy
          </div>
        </div>

        <button type="button" className="start-deck-btn" onClick={onQuit} style={{ marginTop: '12px' }}>
          Back to Practice Hub
        </button>
      </div>
    )
  }

  return (
    <div className="active-game-wrapper">
      <div className="game-top-bar">
        <button type="button" className="game-quit-btn" onClick={onQuit}>
          Quit Game
        </button>
        <div className="game-stats-hud">
          <span className="hud-correct">Correct: {correctCount}</span>
          <span className="hud-wrong">Wrong: {wrongCount}</span>
        </div>
      </div>

      <div className="flashcard-progress-bar-bg" style={{ height: '6px' }}>
        <div className="flashcard-progress-bar-fill" style={{ width: `${(index / deck.length) * 100}%` }}></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>
        <span>Question {index + 1} of {deck.length}</span>
      </div>

      {activeWord && (
        <div className="spelling-body">
          <span className="quiz-prompt">
            {promptLang === 'en'
              ? 'Translate this English word to Vietnamese:'
              : 'Write the English word matching this Vietnamese definition:'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '14px 0' }}>
            <div className="spelling-definition" style={{ fontSize: '1.8rem', color: promptLang === 'en' ? 'var(--ielts-red)' : 'var(--text-primary)', margin: 0 }}>
              {promptLang === 'en' ? activeWord.vocab : activeWord.definition}
            </div>
            <span className={`word-pos-badge ${activeWord.POS.toLowerCase().replace('.', '')}`}>
              {activeWord.POS}
            </span>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>
            Type the {promptLang === 'en' ? 'Vietnamese meaning' : 'English spelling'}
          </div>

          <input
            type="text"
            className={`spelling-input ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
            placeholder={promptLang === 'en' ? "Type Vietnamese definition..." : "Type English spelling..."}
            value={typedWord}
            onChange={(e) => setTypedWord(e.target.value)}
            disabled={isSubmitted}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerify()
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {isSubmitted && (
            <div className={`spelling-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? (
                <span>🎉 Correct answer!</span>
              ) : (
                <span>
                  ❌ Incorrect. Correct answer is:{' '}
                  <strong style={{ fontSize: '1.25rem', textDecoration: 'underline' }}>
                    {promptLang === 'en' ? activeWord.definition : activeWord.vocab}
                  </strong>
                </span>
              )}
            </div>
          )}

          <div className="spelling-actions">
            {!isSubmitted ? (
              <button
                type="button"
                className="spelling-btn submit"
                onClick={handleVerify}
                disabled={!typedWord.trim()}
              >
                Submit Answer
              </button>
            ) : (
              <button type="button" className="start-deck-btn" onClick={handleNext}>
                Continue Next ➔
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   GAME SUB-COMPONENT 2: Spelling Bee
   ========================================================================== */
function SpellingGame({
  deck,
  onQuit,
  speakWord,
  updateWordProgress,
}: {
  deck: WordItem[]
  onQuit: () => void
  speakWord: (word: string) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [index, setIndex] = useState(0)
  const [typedWord, setTypedWord] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [hintRevealed, setHintRevealed] = useState(false)

  const activeWord = deck[index]

  // Speak word automatically when active index changes
  useEffect(() => {
    if (activeWord) {
      const t = setTimeout(() => {
        speakWord(activeWord.vocab)
      }, 500)
      return () => clearTimeout(t)
    }
  }, [index, activeWord, speakWord])

  const handleVerify = async () => {
    if (!typedWord.trim() || isSubmitted) return
    
    const correctSpelling = activeWord.vocab.trim().toLowerCase()
    const inputSpelling = typedWord.trim().toLowerCase()
    
    const correct = inputSpelling === correctSpelling
    setIsCorrect(correct)
    setIsSubmitted(true)
    
    if (correct) {
      setCorrectCount(c => c + 1)
    } else {
      setWrongCount(c => c + 1)
    }

    await updateWordProgress(activeWord.vocab, { is_correct: correct })
  }

  const handleNext = () => {
    setTypedWord('')
    setIsSubmitted(false)
    setHintRevealed(false)
    setIndex(i => i + 1)
  }

  const handleRevealHint = () => {
    setHintRevealed(true)
  }

  // End screen
  if (index >= deck.length) {
    const accuracy = Math.round((correctCount / deck.length) * 100)
    return (
      <div className="victory-box">
        <span className="victory-icon">🐝</span>
        <h3 className="match-victory-title">Spelling Session Finished!</h3>
        <p>Great test of academic spelling structure.</p>

        <div className="victory-stats">
          <div className="victory-stat">
            <div className="victory-stat-val" style={{ color: 'var(--accent-green)' }}>{correctCount}</div>
            <div className="filter-label">Correct ✅</div>
          </div>
          <div className="victory-stat">
            <div className="victory-stat-val" style={{ color: 'var(--status-wrong)' }}>{wrongCount}</div>
            <div className="filter-label">Wrong ❌</div>
          </div>
        </div>
        
        <div className="victory-stat" style={{ width: '100%', marginTop: '10px' }}>
          <div className="victory-stat-val" style={{ fontSize: '1.5rem', color: accuracy >= 70 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
            {accuracy}% Accuracy
          </div>
        </div>

        <button type="button" className="start-deck-btn" onClick={onQuit} style={{ marginTop: '12px' }}>
          Back to Practice Hub
        </button>
      </div>
    )
  }

  return (
    <div className="active-game-wrapper">
      <div className="game-top-bar">
        <button type="button" className="game-quit-btn" onClick={onQuit}>
          Quit Game
        </button>
        <div className="game-stats-hud">
          <span className="hud-correct">Correct: {correctCount}</span>
          <span className="hud-wrong">Wrong: {wrongCount}</span>
        </div>
      </div>

      <div className="flashcard-progress-bar-bg" style={{ height: '6px' }}>
        <div className="flashcard-progress-bar-fill" style={{ width: `${(index / deck.length) * 100}%` }}></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>
        <span>Question {index + 1} of {deck.length}</span>
      </div>

      {activeWord && (
        <div className="spelling-body">
          <span className="quiz-prompt" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
            Listen to the English word and type its spelling.
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => speakWord(activeWord.vocab)}
              style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}
            >
              🔊 Play Word Pronunciation
            </button>
            <span className={`word-pos-badge ${activeWord.POS.toLowerCase().replace('.', '')}`}>
              {activeWord.POS}
            </span>
          </div>

          {/* Reveal details clue only if hintRevealed is true */}
          {hintRevealed && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              textAlign: 'center',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 750, color: 'var(--text-primary)' }}>
                Meaning: "{activeWord.definition}"
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span>Pronunciation: {activeWord.pronunciation}</span>
                <span>Type: ({activeWord.POS})</span>
              </div>
            </div>
          )}

          <input
            type="text"
            className={`spelling-input ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
            placeholder="Type spelling here..."
            value={typedWord}
            onChange={(e) => setTypedWord(e.target.value)}
            disabled={isSubmitted}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerify()
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {isSubmitted && (
            <div className={`spelling-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? (
                <span>🎉 Excellent spelling!</span>
              ) : (
                <span>
                  ❌ Incorrect spelling. Correct is:{' '}
                  <strong style={{ fontSize: '1.25rem', textDecoration: 'underline' }}>{activeWord.vocab}</strong>
                </span>
              )}
            </div>
          )}

          {/* Interactive controls */}
          <div className="spelling-actions">
            {!isSubmitted ? (
              <>
                <button
                  type="button"
                  className="spelling-btn"
                  onClick={handleRevealHint}
                  disabled={hintRevealed}
                  style={{ opacity: hintRevealed ? 0.5 : 1 }}
                >
                  💡 Show Clue / Meaning
                </button>
                <button
                  type="button"
                  className="spelling-btn submit"
                  onClick={handleVerify}
                  disabled={!typedWord.trim()}
                >
                  Submit spelling
                </button>
              </>
            ) : (
              <button type="button" className="start-deck-btn" onClick={handleNext}>
                Continue Next ➔
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   GAME SUB-COMPONENT 3: Match Pairs
   ========================================================================== */
function MatchingGame({
  deck,
  onQuit,
  updateWordProgress,
}: {
  deck: WordItem[]
  onQuit: () => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [items, setItems] = useState<MatchItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const [time, setTime] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const timerRef = useRef<any>(null)

  // Construct matching grid blocks from the deck of 6 words, adding POS to the English words
  useEffect(() => {
    if (deck && deck.length > 0) {
      const wordsSlice = deck.slice(0, 6)
      const listItems: MatchItem[] = []
      
      wordsSlice.forEach((w, idx) => {
        listItems.push({
          id: `w_${idx}`,
          text: `${w.vocab} (${w.POS})`, // Display POS alongside the English word
          type: 'word',
          vocab: w.vocab,
          matchId: idx,
        })
        listItems.push({
          id: `d_${idx}`,
          text: w.definition,
          type: 'def',
          vocab: w.vocab,
          matchId: idx,
        })
      })
      
      // Shuffle grid elements
      listItems.sort(() => Math.random() - 0.5)
      setItems(listItems)
      setTime(0)
      setIsFinished(false)
      setMatchedIds(new Set())
      setErrorIds(new Set())
      setSelectedId(null)

      // Start time keeping
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTime(t => t + 1)
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [deck])

  // End match game check
  useEffect(() => {
    if (items.length > 0 && matchedIds.size === items.length) {
      setIsFinished(true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [matchedIds, items])

  const handleTileClick = async (clickedItem: MatchItem) => {
    if (matchedIds.has(clickedItem.id) || errorIds.has(clickedItem.id)) return

    if (selectedId === null) {
      setSelectedId(clickedItem.id)
      return
    }

    if (selectedId === clickedItem.id) {
      setSelectedId(null)
      return
    }

    const selectedItem = items.find(i => i.id === selectedId)
    if (!selectedItem) return

    const isPairMatch =
      selectedItem.matchId === clickedItem.matchId &&
      selectedItem.type !== clickedItem.type

    if (isPairMatch) {
      // Add both block IDs to matched list
      setMatchedIds(prev => {
        const next = new Set(prev)
        next.add(selectedItem.id)
        next.add(clickedItem.id)
        return next
      })
      setSelectedId(null)
      
      await updateWordProgress(clickedItem.vocab, { is_correct: true })
    } else {
      // Failed pairing mismatch
      setErrorIds(new Set([selectedItem.id, clickedItem.id]))
      setSelectedId(null)
      
      setTimeout(() => {
        setErrorIds(new Set())
      }, 500)

      await updateWordProgress(clickedItem.vocab, { is_correct: false })
      await updateWordProgress(selectedItem.vocab, { is_correct: false })
    }
  }

  const restartMatchGame = () => {
    const listItems = [...items]
    listItems.sort(() => Math.random() - 0.5)
    setItems(listItems)
    setTime(0)
    setIsFinished(false)
    setMatchedIds(new Set())
    setErrorIds(new Set())
    setSelectedId(null)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTime(t => t + 1)
    }, 1000)
  }

  if (isFinished) {
    return (
      <div className="victory-box" style={{ maxWidth: '480px' }}>
        <span className="victory-icon">⚡</span>
        <h3 className="match-victory-title">Grid Matched Successfully!</h3>
        <p>Outstanding speed visual coordination drill completed.</p>

        <div className="victory-stat" style={{ width: '100%' }}>
          <div className="filter-label">Completion duration</div>
          <div className="victory-stat-val" style={{ fontSize: '2rem', color: 'var(--ielts-red)', marginTop: '4px' }}>
            {time} seconds
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button type="button" className="start-deck-btn" onClick={restartMatchGame}>
            Play Again
          </button>
          <button type="button" className="spelling-btn" style={{ padding: '12px 28px' }} onClick={onQuit}>
            Back to Hub
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="active-game-wrapper" style={{ maxWidth: '540px' }}>
      <div className="game-top-bar">
        <button type="button" className="game-quit-btn" onClick={onQuit}>
          Quit Game
        </button>
        <div className="match-timer-hud">
          ⏱️ Timer: {time}s
        </div>
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span className="quiz-prompt">Word Pairing challenge</span>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Connect the English words (with POS types) with their definitions below.
        </p>
      </div>

      <div className="match-grid">
        {items.map((tile) => {
          const isSelected = selectedId === tile.id
          const isMatched = matchedIds.has(tile.id)
          const isError = errorIds.has(tile.id)

          let stateClass = ''
          if (isMatched) stateClass = 'matched'
          else if (isError) stateClass = 'error'
          else if (isSelected) stateClass = 'selected'

          return (
            <div
              key={tile.id}
              className={`match-tile ${stateClass}`}
              onClick={() => handleTileClick(tile)}
            >
              <span>{tile.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
