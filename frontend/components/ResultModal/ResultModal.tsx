"use client"

import React from 'react'
import Link from 'next/link'
import { Button, Modal, Space } from 'antd'
import './ResultModal.css'

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
  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      maskClosable={false}
      className="result-modal"
      destroyOnHidden
    >
      <div className="result-card">
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>{emoji}</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
          Cambridge IELTS 11 — Test {testNumber}
        </p>

        {customMessage ? (
          <div className="result-card-custom-message">
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
            <div className="result-card-info-box">
              Band Score: <strong style={{ color: 'var(--ielts-red)' }}>{bandScore}</strong>
            </div>
          </>
        )}

        <Space size={12} style={{ marginTop: 24, justifyContent: 'center', width: '100%' }}>
          <Link href={backUrl}>
            <Button size="large">Go Back</Button>
          </Link>
          <Button type="primary" size="large" onClick={onClose}>
            View Details
          </Button>
        </Space>
      </div>
    </Modal>
  )
}
