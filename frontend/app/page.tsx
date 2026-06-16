"use client"
import { useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import './page.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SKILL_ICONS: Record<string, { emoji: string; color: string }> = {
  listening: { emoji: '🎧', color: '#3b82f6' },
  reading: { emoji: '📖', color: '#22c55e' },
  writing: { emoji: '✍️', color: '#f59e0b' },
  speaking: { emoji: '🎙️', color: '#8b5cf6' },
}

export default function TestLibraryPage() {
  const { data, error, isLoading } = useSWR('/api/tests', fetcher)

  // Group tests by book
  const testsByBook = useMemo(() => {
    if (!data || !Array.isArray(data)) return {}
    const grouped: Record<number, any[]> = {}
    data.forEach((t: any) => {
      const b = t.book ?? 11
      if (!grouped[b]) grouped[b] = []
      grouped[b].push(t)
    })
    // Sort tests within each book by test_number
    Object.keys(grouped).forEach((b: any) => {
      grouped[b].sort((a: any, b: any) => a.test_number - b.test_number)
    })
    return grouped
  }, [data])

  const sortedBooks = useMemo(() => {
    return Object.keys(testsByBook).map(Number).sort((a, b) => a - b)
  }, [testsByBook])

  return (
    <div className="container fade-in">
      {/* Hero Section */}
      <div className="home-hero">
        <div className="home-hero__shape-1" />
        <div className="home-hero__shape-2" />
        <h1 className="home-hero__title">
          Cambridge IELTS Practice
        </h1>
        <p className="home-hero__subtitle">
          Luyện thi IELTS với đề thi Cambridge chính thức. Giao diện mô phỏng thi thật trên máy tính.
        </p>
        <div className="home-hero__stats">
          <div className="home-hero__stat">
            <div className="home-hero__stat-num">9</div>
            <div className="home-hero__stat-label">Books (11-19)</div>
          </div>
          <div className="home-hero__divider" />
          <div className="home-hero__stat">
            <div className="home-hero__stat-num">36</div>
            <div className="home-hero__stat-label">Tests</div>
          </div>
          <div className="home-hero__divider" />
          <div className="home-hero__stat">
            <div className="home-hero__stat-num">4</div>
            <div className="home-hero__stat-label">Skills</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="home-error">
          ⚠️ Không thể tải danh sách bài test. Hãy đảm bảo backend đang chạy.
        </div>
      )}

      {isLoading && (
        <>
          {[11, 12].map((bk) => (
            <div key={bk} className="home-book-section">
              <div style={{ marginBottom: '16px' }}>
                <div className="skeleton" style={{ width: 180, height: 20, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: 120, height: 14 }} />
              </div>
              <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="test-card" style={{ pointerEvents: 'none' }}>
                    <div className="test-card__header">
                      <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 8 }} />
                      <div className="skeleton" style={{ width: 120, height: 20 }} />
                    </div>
                    <div className="test-card__body">
                      <div className="test-card__skills">
                        {[1, 2, 3, 4].map(j => (
                          <div key={j} className="skeleton" style={{ height: 36 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {data && Array.isArray(data) && (
        <>
          {sortedBooks.map((book) => (
            <div key={book} className="home-book-section">
              <div className="home-book-header">
                <h2 className="home-book-title">Cambridge IELTS {book}</h2>
                <p className="home-book-subtitle">Academic • {testsByBook[book].length} Tests Available</p>
              </div>

              <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {testsByBook[book].map((t: any) => (
                  <Link
                    key={t.test_number}
                    href={`/tests/${book}/${t.test_number}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="test-card slide-up" style={{ animationDelay: `${(t.test_number - 1) * 100}ms` }}>
                      <div className="test-card__header">
                        <div className="test-card__book">Cambridge IELTS {book}</div>
                        <div className="test-card__title">Test {t.test_number}</div>
                      </div>
                      <div className="test-card__body">
                        <div className="test-card__skills">
                          {Object.entries(SKILL_ICONS).map(([skill, info]) => (
                            <div key={skill} className="test-card__skill">
                              <span>{info.emoji}</span>
                              <span style={{ textTransform: 'capitalize' }}>{skill}</span>
                            </div>
                          ))}
                        </div>
                        <div className="test-card__actions">
                          <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                            Bắt đầu
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
