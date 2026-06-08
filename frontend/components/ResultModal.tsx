import React from 'react'
import Link from 'next/link'

interface ResultModalProps {
  isOpen: boolean
  emoji: string
  title: string
  testNumber: string
  correctCount: number
  totalCount: number
  bandScore: string
  onClose: () => void
  backUrl: string
  customMessage?: string
}

export default function ResultModal({
  isOpen,
  emoji,
  title,
  testNumber,
  correctCount,
  totalCount,
  bandScore,
  onClose,
  backUrl,
  customMessage,
}: ResultModalProps) {
  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      backdropFilter: 'blur(4px)',
    }}>
      <div className="result-card slide-up" style={{ maxWidth: 420, width: '90%' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>{emoji}</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
          Cambridge IELTS 11 — Test {testNumber}
        </p>
        
        {customMessage ? (
          <div style={{
            padding: '12px 16px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            textAlign: 'justify',
          }}>
            {customMessage}
          </div>
        ) : (
          <>
            <div className="result-card__score">
              {correctCount ?? '?'}/{totalCount ?? 40}
            </div>
            <div className="result-card__band" style={{ marginTop: 8 }}>
              Correct Answers
            </div>
            <div style={{
              marginTop: 16,
              padding: '8px 16px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
            }}>
              Band Score: <strong style={{ color: 'var(--ielts-red)' }}>{bandScore}</strong>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
          <Link href={backUrl}>
            <button className="btn btn-secondary">Quay lại</button>
          </Link>
          <button className="btn btn-primary" onClick={onClose}>
            Xem chi tiết
          </button>
        </div>
      </div>
    </div>
  )
}
