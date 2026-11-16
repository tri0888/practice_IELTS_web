"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { Controller, useForm } from 'react-hook-form'
import { Alert, App, Button, Checkbox, Empty, Input, Modal, Pagination, Progress, Segmented, Select, Spin, Tabs, Tag } from 'antd'
import SearchRounded from '@mui/icons-material/SearchRounded'
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded'
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

  // Keep active utterances in a ref to prevent garbage collection
  const activeUtterancesRef = useRef<Set<SpeechSynthesisUtterance>>(new Set())

  // Speak helper using Web Speech API
  const speakWord = useCallback((word: string, onEnd?: () => void) => {
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

    activeUtterancesRef.current.add(utterance)
    const cleanup = () => {
      activeUtterancesRef.current.delete(utterance)
    }

    utterance.onend = () => {
      cleanup()
      if (onEnd) onEnd()
    }
    utterance.onerror = () => {
      cleanup()
      if (onEnd) onEnd()
    }

    window.speechSynthesis.speak(utterance)
  }, [])

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
        <Tabs
          className="vocab-tabs"
          activeKey={activeTab}
          onChange={key => setActiveTab(key as typeof activeTab)}
          items={[
            { key: 'library', label: <><span>📑</span> Library</> },
            { key: 'flashcards', label: <><span>🎴</span> Flashcards</> },
            { key: 'practice', label: <><span>✏️</span> Practice Games</> },
          ]}
        />

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
  speakWord: (word: string, onEnd?: () => void) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
  mutateStats: () => void
}

function LibraryView({
  stats,
  speakWord,
  updateWordProgress,
  mutateStats,
}: LibraryViewProps) {
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  // Search / POS / status filters are a react-hook-form; the list re-queries as they change
  const { control, watch } = useForm<{ search: string; pos: string; status: string }>({
    defaultValues: { search: '', pos: '', status: '' },
  })
  const searchVal = watch('search')
  const posFilter = watch('pos')
  const statusFilter = watch('status')
  const [debouncedSearch, setDebouncedSearch] = useState('')
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
  useEffect(() => {
    setPage(1)
  }, [posFilter])

  useEffect(() => {
    setSelectedVocabs(new Set())
    setPage(1)
  }, [statusFilter])

  // API query
  const queryStr = `/api/vocabulary?search=${encodeURIComponent(debouncedSearch)}&pos=${encodeURIComponent(posFilter)}&status=${statusFilter}&page=${page}&limit=24`
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

  // Generic bulk status update handler
  const handleBulkStatusUpdate = async () => {
    if (selectedVocabs.size === 0) return
    const vocabsArray = Array.from(selectedVocabs)
    const nextStatus = isMasteredMode ? 'learning' : 'unlearned'

    try {
      const res = await fetch('/api/vocabulary/progress/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabs: vocabsArray, status: nextStatus }),
      })
      if (res.ok) {
        setSelectedVocabs(new Set())
        mutateList()
        mutateStats()
      } else {
        message.error('Failed to update selected words status.')
      }
    } catch (err) {
      console.error(err)
      message.error('Error connecting to backend.')
    }
  }

  const isMasteredMode = statusFilter === 'mastered'
  const isLearningMode = statusFilter === 'learning'
  const isBulkSelectMode = isMasteredMode || isLearningMode

  // Get all vocabs currently shown on the page
  const shownVocabs = useMemo(() => {
    if (!data || !data.items) return []
    return data.items.map((item: WordItem) => item.vocab.toLowerCase())
  }, [data])

  // Check if all shown vocabs are selected
  const isAllSelected = useMemo(() => {
    if (shownVocabs.length === 0) return false
    return shownVocabs.every(vocab => selectedVocabs.has(vocab))
  }, [shownVocabs, selectedVocabs])

  // Select all / Deselect all toggle
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all shown vocabs
      setSelectedVocabs(prev => {
        const next = new Set(prev)
        shownVocabs.forEach(vocab => next.delete(vocab))
        return next
      })
    } else {
      // Select all shown vocabs
      setSelectedVocabs(prev => {
        const next = new Set(prev)
        shownVocabs.forEach(vocab => next.add(vocab))
        return next
      })
    }
  }

  return (
    <div className="library-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search & Filter Panel */}
      <div className="library-controls">
        <div className="search-row">
          <Controller
            control={control}
            name="search"
            render={({ field }) => (
              <Input
                {...field}
                size="large"
                allowClear
                className="search-input"
                prefix={<SearchRounded fontSize="small" />}
                placeholder="Search words or Vietnamese definitions..."
              />
            )}
          />
        </div>

        {/* Word POS filters */}
        {stats && stats.unique_pos && stats.unique_pos.length > 0 && (
          <div className="filter-group">
            <div className="filter-label">Word Types:</div>
            <Controller
              control={control}
              name="pos"
              render={({ field }) => (
                <div className="filter-tags">
                  {['', ...stats.unique_pos].map((pos: string) => (
                    <Tag.CheckableTag
                      key={pos || 'all'}
                      className="filter-tag"
                      checked={field.value === pos}
                      onChange={() => field.onChange(pos)}
                    >
                      {pos || 'All'}
                    </Tag.CheckableTag>
                  ))}
                </div>
              )}
            />
          </div>
        )}

        {/* Progress Filters */}
        <div className="filter-group">
          <div className="filter-label">Learning Status:</div>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Segmented
                value={field.value}
                onChange={value => field.onChange(value)}
                options={[
                  { value: '', label: 'All' },
                  { value: 'unlearned', label: '🆕 Unlearned' },
                  { value: 'learning', label: '✏️ Learning' },
                  { value: 'mastered', label: '✅ Mastered' },
                ]}
              />
            )}
          />
        </div>
      </div>

            {/* Grid of Vocabulary cards */}
      {error && (
        <Alert type="error" showIcon message="Failed to fetch words list. Please ensure backend server is online." />
      )}

      {!data && !error && (
        <div style={{ textAlign: 'center', padding: '80px', fontWeight: 600, color: 'var(--text-muted)' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12 }}>Loading vocabulary directory...</div>
        </div>
      )}

      {data && (
        <>
          {/* Bulk Action Header bar */}
          {isBulkSelectMode && (
            <div className="bulk-actions-bar animate-slide-down" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={!isAllSelected && shownVocabs.some(v => selectedVocabs.has(v))}
                onChange={handleToggleSelectAll}
              >
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Checkbox>
              
              {selectedVocabs.size > 0 ? (
                <>
                  <div className="bulk-actions-info" style={{ flex: 1, margin: 0 }}>
                    Selected <strong>{selectedVocabs.size}</strong> word(s) to unmark
                  </div>
                  <Button type="primary" danger onClick={handleBulkStatusUpdate}>
                    {isMasteredMode ? 'Unmark Mastered' : 'Unmark Learning'}
                  </Button>
                </>
              ) : (
                <div style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Select words to perform bulk actions
                </div>
              )}
            </div>
          )}

          {data.total > data.limit && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total words matching filters: {data.total}
            </div>
          )}

          {data.items.length === 0 ? (
            <Empty
              className="vocab-empty"
              description="No vocabulary words found matching these filters. Try refining your search query."
            />
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
                        {isBulkSelectMode && (
                          <div className="card-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
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
                        <Button
                          type="text"
                          shape="circle"
                          className="action-btn"
                          title="Listen pronunciation"
                          icon={<VolumeUpRounded fontSize="small" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            speakWord(item.vocab)
                          }}
                        />
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
              <Pagination
                current={page}
                pageSize={data.limit}
                total={data.total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Modal Drawer Details */}
      <Modal
        open={!!activeWord}
        onCancel={() => setActiveWord(null)}
        footer={null}
        centered
        width={520}
        className="vocab-word-modal"
        title={activeWord && (
          <Button
            type="text"
            shape="circle"
            className="action-btn"
            aria-label="Listen pronunciation"
            icon={<VolumeUpRounded />}
            onClick={() => speakWord(activeWord.vocab)}
          />
        )}
      >
        {activeWord && (
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
                <Segmented
                  block
                  value={activeWord.status}
                  onChange={value => handleUpdateStatus(activeWord.vocab, value as string)}
                  options={[
                    { value: 'unlearned', label: 'Unlearned' },
                    { value: 'learning', label: 'Learning' },
                    { value: 'mastered', label: 'Mastered' },
                  ]}
                />
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
        )}
      </Modal>
    </div>
  )
}

/* ==========================================================================
   Shared deck setup form (Flashcards + Practice Games) — react-hook-form
   ========================================================================== */
type DeckSetup = { mode: 'random' | 'studied'; pos: string; limit: number }

function useDeckSetup() {
  const form = useForm<DeckSetup>({ defaultValues: { mode: 'random', pos: '', limit: 15 } })
  const [mode, pos, limit] = form.watch(['mode', 'pos', 'limit'])
  return { form, mode, posFilter: pos, limit }
}

function DeckSetupFields({
  form,
  stats,
  labels,
}: {
  form: ReturnType<typeof useDeckSetup>['form']
  stats: any
  labels: { mode: string; studied: string; pos: string; limit: string; limitUnit: string }
}) {
  const { control, setValue, getValues, watch } = form
  const mode = watch('mode')
  const posOptions: string[] = (mode === 'studied' ? stats?.studied_pos : stats?.unique_pos) || []
  const hasStudied = !!stats?.studied_count

  return (
    <>
      <div className="filter-group">
        <span className="filter-label">{labels.mode}</span>
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <Segmented
              value={field.value}
              onChange={value => {
                field.onChange(value)
                // Reset POS if the new mode does not offer the current category
                const pos = getValues('pos')
                if (value === 'studied' && stats?.studied_pos && pos !== '' && !stats.studied_pos.includes(pos)) {
                  setValue('pos', '')
                }
              }}
              options={[
                { value: 'random', label: 'All Words' },
                { value: 'studied', label: `${labels.studied} (${stats?.studied_count || 0})`, disabled: !hasStudied },
              ]}
            />
          )}
        />
      </div>

      <div className="filter-group">
        <span className="filter-label">{labels.pos}</span>
        <Controller
          control={control}
          name="pos"
          render={({ field }) => (
            <Select
              value={field.value}
              onChange={field.onChange}
              style={{ width: '100%' }}
              options={[{ value: '', label: 'All Types' }, ...posOptions.map(p => ({ value: p, label: p }))]}
            />
          )}
        />
      </div>

      <div className="filter-group">
        <span className="filter-label">{labels.limit}</span>
        <Controller
          control={control}
          name="limit"
          render={({ field }) => (
            <Segmented
              value={field.value}
              onChange={value => field.onChange(Number(value))}
              options={[15, 20, 30].map(n => ({ value: n, label: `${n} ${labels.limitUnit}` }))}
            />
          )}
        />
      </div>
    </>
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
  speakWord: (word: string, onEnd?: () => void) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const { form: setupForm, mode, posFilter, limit } = useDeckSetup()

  const [deck, setDeck] = useState<WordItem[]>([])
  const [cardIndex, setCardIndex] = useState(-1) // Starts at -1 for the Start card
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false) // Lock Next button while reading

  const activeCard = deck[cardIndex]

  // Automatically speak the word once when the card changes
  useEffect(() => {
    if (isPlaying && activeCard) {
      setIsSpeaking(true)
      const timer = setTimeout(() => {
        speakWord(activeCard.vocab, () => {
          setIsSpeaking(false)
        })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isPlaying, cardIndex, activeCard, speakWord])

  const startFlashcards = async () => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const url = `/api/vocabulary/practice?mode=${mode}&pos=${encodeURIComponent(posFilter)}&limit=${limit}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.length === 0) {
          setErrorMsg('No eligible practice words available (Mastered words are excluded).')
        } else {
          setDeck(data)
          setCardIndex(-1) // Ready to start card
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
  const handleNextCard = () => {
    if (cardIndex === -1) {
      if (deck.length > 0) {
        // Mark first word as learning
        updateWordProgress(deck[0].vocab, { status: 'learning' })
        setCardIndex(0)
      }
    } else {
      if (!activeCard) return
      const nextIdx = cardIndex + 1
      if (nextIdx < deck.length) {
        // Mark next word as learning
        updateWordProgress(deck[nextIdx].vocab, { status: 'learning' })
      }
      setCardIndex(nextIdx)
    }
  }

  if (isPlaying && cardIndex >= deck.length) {
    return (
      <div className="victory-box">
        <span className="victory-icon">🎉</span>
        <h3 className="match-victory-title">Flashcard Deck Completed!</h3>
        <p>You reviewed all {deck.length} words. They have been added to your Studied Words pool.</p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <Button type="primary" size="large" onClick={startFlashcards} loading={isLoading}>
            Study Again
          </Button>
          <Button size="large" onClick={() => setIsPlaying(false)}>
            Setup Deck
          </Button>
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
            <DeckSetupFields
              form={setupForm}
              stats={stats}
              labels={{ mode: 'Practice Focus:', studied: 'Studied Words', pos: 'Filter by Word Type:', limit: 'Deck Size:', limitUnit: 'Cards' }}
            />
          </div>

          {errorMsg && <Alert type="error" showIcon message={errorMsg} style={{ width: '100%' }} />}

          <Button type="primary" size="large" block loading={isLoading} onClick={startFlashcards}>
            {isLoading ? 'Building deck...' : 'Start Review'}
          </Button>
        </div>
      ) : (
        <div className="flashcard-game-container">
          <div className="game-top-bar">
            <Button danger onClick={() => setIsPlaying(false)}>
              Quit Session
            </Button>
            <div className="flashcard-deck-info">
              <span>{cardIndex === -1 ? 'Ready' : `Card ${cardIndex + 1} of ${deck.length}`}</span>
            </div>
          </div>

          {/* Progress bar */}
          <Progress
            percent={cardIndex === -1 ? 0 : Math.round(((cardIndex + 1) / deck.length) * 100)}
            showInfo={false}
            strokeColor="var(--ielts-red)"
          />

          {/* Flat Flashcard containing full details */}
          {cardIndex === -1 ? (
            <div className="card-face" style={{ height: '320px', cursor: 'default', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '3rem' }}>🏁</span>
              <span className="card-vocab-text" style={{ fontSize: '1.8rem' }}>Ready to Start?</span>
              <span className="card-definition-text" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                Press "Start Deck" below to begin review. All words shown will go to your learning pool.
              </span>
            </div>
          ) : (
            activeCard && (
              <div className="card-face" style={{ height: '320px', cursor: 'default' }}>
                <div className="card-face-top">
                  <span className={`word-pos-badge ${activeCard.POS.toLowerCase().replace('.', '')}`}>
                    {activeCard.POS}
                  </span>
                  <Button
                    type="text"
                    shape="circle"
                    className="action-btn"
                    title="Listen pronunciation"
                    icon={<VolumeUpRounded />}
                    onClick={() => {
                      setIsSpeaking(true)
                      speakWord(activeCard.vocab, () => {
                        setIsSpeaking(false)
                      })
                    }}
                  />
                </div>
                
                <div className="card-face-mid" style={{ gap: '10px' }}>
                  <span className="card-vocab-text">{activeCard.vocab}</span>
                  <span className="word-pron" style={{ fontSize: '1.25rem' }}>{activeCard.pronunciation}</span>
                  <span className="card-definition-text" style={{ marginTop: '10px' }}>{activeCard.definition}</span>
                </div>

                <span className="card-hint-text">Progress: {cardIndex + 1}/{deck.length} cards</span>
              </div>
            )
          )}

          {/* Single Next Card action button */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Button
              type="primary"
              size="large"
              block
              onClick={handleNextCard}
              disabled={isSpeaking && cardIndex >= 0}
            >
              {cardIndex === -1 ? 'Start Deck ➔' : (cardIndex === deck.length - 1 ? 'Finish Deck ➔' : 'Next Card ➔')}
            </Button>
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
  speakWord: (word: string, onEnd?: () => void) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [activeGame, setActiveGame] = useState<'translation' | 'spelling' | 'matching' | null>(null)
  
  // Game Setup variables (react-hook-form)
  const { form: setupForm, mode, posFilter, limit } = useDeckSetup()

  const [deck, setDeck] = useState<WordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const fetchPracticeDeck = async (count: number = limit) => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const url = `/api/vocabulary/practice?mode=${mode}&pos=${encodeURIComponent(posFilter)}&limit=${count}`
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
              <DeckSetupFields
                form={setupForm}
                stats={stats}
                labels={{ mode: 'Vocabulary Scope:', studied: 'Studied', pos: 'Word Type filter:', limit: 'Session length:', limitUnit: 'Qs' }}
              />
            </div>
            {errorMsg && <Alert type="error" showIcon message={errorMsg} style={{ marginTop: 6 }} />}
          </div>

          {/* Game selection cards */}
          <div className="practice-selector">
            <div className="practice-card" onClick={() => handleStartGame('translation')}>
              <span className="practice-icon">📝</span>
              <h4 className="practice-title">Translation Quiz</h4>
              <p className="practice-desc">Given a random English or Vietnamese word, write the corresponding translation. Automatically matches synonyms.</p>
              <Button type="primary" block loading={isLoading}>
                {isLoading ? 'Loading...' : 'Play Game'}
              </Button>
            </div>

            <div className="practice-card" onClick={() => handleStartGame('spelling')}>
              <span className="practice-icon">🔊</span>
              <h4 className="practice-title">Spelling Bee</h4>
              <p className="practice-desc">Listen to pronunciation audio and write the correct English spelling. Focused purely on audio-based recognition.</p>
              <Button type="primary" block loading={isLoading}>
                {isLoading ? 'Loading...' : 'Play Game'}
              </Button>
            </div>

            <div className="practice-card" onClick={() => handleStartGame('matching')}>
              <span className="practice-icon">⚡</span>
              <h4 className="practice-title">Match Pairs</h4>
              <p className="practice-desc">Connect English words with their definitions in a 6x2 grid as fast as you can. Trains swift recognition.</p>
              <Button type="primary" block loading={isLoading}>
                {isLoading ? 'Loading...' : 'Play Game'}
              </Button>
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
  // The typed answer is a react-hook-form field, reset for every question
  const { control, reset, watch } = useForm<{ answer: string }>({ defaultValues: { answer: '' } })
  const typedWord = watch('answer') ?? ''
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [hintRevealed, setHintRevealed] = useState(false)

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
    reset({ answer: '' })
    setIsSubmitted(false)
    setHintRevealed(false)
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

        <Button type="primary" size="large" onClick={onQuit} style={{ marginTop: '12px' }}>
          Back to Practice Hub
        </Button>
      </div>
    )
  }

  return (
    <div className="active-game-wrapper">
      <div className="game-top-bar">
        <Button danger onClick={onQuit}>
          Quit Game
        </Button>
        <div className="game-stats-hud">
          <span className="hud-correct">Correct: {correctCount}</span>
          <span className="hud-wrong">Wrong: {wrongCount}</span>
        </div>
      </div>

      <Progress percent={Math.round((index / deck.length) * 100)} showInfo={false} size="small" strokeColor="var(--ielts-red)" />
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
              border: '1px solid var(--border-light)',
              marginBottom: '14px'
            }}>
              {promptLang === 'en' ? (
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  <span>Pronunciation: {activeWord.pronunciation}</span>
                  <span>Type: ({activeWord.POS})</span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '1px' }}>
                    Starts with: {activeWord.vocab.charAt(0)}{'_'.repeat(activeWord.vocab.length - 1)} ({activeWord.vocab.length} letters)
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>Pronunciation: {activeWord.pronunciation}</span>
                    <span>Type: ({activeWord.POS})</span>
                  </div>
                </>
              )}
            </div>
          )}

          <Controller
            control={control}
            name="answer"
            render={({ field }) => (
              <Input
                {...field}
                size="large"
                className={`spelling-input ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
                status={isSubmitted && !isCorrect ? 'error' : undefined}
                placeholder={promptLang === 'en' ? "Type Vietnamese definition..." : "Type English spelling..."}
                disabled={isSubmitted}
                onPressEnter={handleVerify}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
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
              <>
                <Button size="large" onClick={() => setHintRevealed(true)} disabled={hintRevealed}>
                  💡 Show Clue
                </Button>
                <Button type="primary" size="large" onClick={handleVerify} disabled={!typedWord.trim()}>
                  Submit Answer
                </Button>
              </>
            ) : (
              <Button type="primary" size="large" onClick={handleNext} autoFocus>
                Continue Next ➔
              </Button>
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
  speakWord: (word: string, onEnd?: () => void) => void
  updateWordProgress: (w: string, data: any) => Promise<boolean>
}) {
  const [index, setIndex] = useState(0)
  // The typed answer is a react-hook-form field, reset for every question
  const { control, reset, watch } = useForm<{ answer: string }>({ defaultValues: { answer: '' } })
  const typedWord = watch('answer') ?? ''
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [hintRevealed, setHintRevealed] = useState(false)

  const activeWord = deck[index]

  const lastPlayedIndexRef = useRef<number | null>(null)

  // Speak word automatically when active index changes
  useEffect(() => {
    if (activeWord && lastPlayedIndexRef.current !== index) {
      const t = setTimeout(() => {
        lastPlayedIndexRef.current = index
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
    reset({ answer: '' })
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

        <Button type="primary" size="large" onClick={onQuit} style={{ marginTop: '12px' }}>
          Back to Practice Hub
        </Button>
      </div>
    )
  }

  return (
    <div className="active-game-wrapper">
      <div className="game-top-bar">
        <Button danger onClick={onQuit}>
          Quit Game
        </Button>
        <div className="game-stats-hud">
          <span className="hud-correct">Correct: {correctCount}</span>
          <span className="hud-wrong">Wrong: {wrongCount}</span>
        </div>
      </div>

      <Progress percent={Math.round((index / deck.length) * 100)} showInfo={false} size="small" strokeColor="var(--ielts-red)" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>
        <span>Question {index + 1} of {deck.length}</span>
      </div>

      {activeWord && (
        <div className="spelling-body">
          <span className="quiz-prompt" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
            Listen to the English word and type its spelling.
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
            <Button size="large" icon={<VolumeUpRounded />} onClick={() => speakWord(activeWord.vocab)}>
              Play Word Pronunciation
            </Button>
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

          <Controller
            control={control}
            name="answer"
            render={({ field }) => (
              <Input
                {...field}
                size="large"
                className={`spelling-input ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
                status={isSubmitted && !isCorrect ? 'error' : undefined}
                placeholder="Type spelling here..."
                disabled={isSubmitted}
                onPressEnter={handleVerify}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
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
                <Button size="large" onClick={handleRevealHint} disabled={hintRevealed}>
                  💡 Show Clue / Meaning
                </Button>
                <Button type="primary" size="large" onClick={handleVerify} disabled={!typedWord.trim()}>
                  Submit spelling
                </Button>
              </>
            ) : (
              <Button type="primary" size="large" onClick={handleNext} autoFocus>
                Continue Next ➔
              </Button>
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
          <Button type="primary" size="large" onClick={restartMatchGame}>
            Play Again
          </Button>
          <Button size="large" onClick={onQuit}>
            Back to Hub
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="active-game-wrapper" style={{ maxWidth: '540px' }}>
      <div className="game-top-bar">
        <Button danger onClick={onQuit}>
          Quit Game
        </Button>
        <Tag color="red" style={{ fontSize: '1rem', fontWeight: 800, padding: '4px 12px' }}>
          ⏱️ Timer: {time}s
        </Tag>
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
