import React from 'react'
import './PDFViewer.css'

interface PDFViewerProps {
  pages: number[]
  containerRef?: React.RefObject<HTMLDivElement | null>
  style?: React.CSSProperties
  book?: string | number
  pdfType?: 'academic' | 'solution'
  partKey?: string
  test?: number
}

const BACKEND = '/api'

export default function PDFViewer({ pages, containerRef, style, book, pdfType, partKey, test }: PDFViewerProps) {
  const bookVal = book ?? '11'
  const typeVal = pdfType ?? 'academic'

  if (partKey && test) {
    return (
      <div className="pdf-viewer-container" ref={containerRef} style={style}>
        <div className="pdf-page-card">
          <img
            src={`${BACKEND}/pdf-parts/${bookVal}/${typeVal}/${test}/${partKey}.png`}
            alt={partKey}
            className="pdf-page-img"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pdf-viewer-container" ref={containerRef} style={style}>
      {pages.map((pageNumber) => (
        <div key={pageNumber} className="pdf-page-card">
          <img
            src={`${BACKEND}/pdf-pages/${bookVal}/${typeVal}/${pageNumber}.png`}
            alt={`Page ${pageNumber}`}
            className="pdf-page-img"
          />
          <div className="pdf-page-number">Trang {pageNumber}</div>
        </div>
      ))}
    </div>
  )
}
