import React from 'react'

interface PDFViewerProps {
  pages: number[]
  containerRef?: React.RefObject<HTMLDivElement | null>
  style?: React.CSSProperties
}

const BACKEND = '/api'

export default function PDFViewer({ pages, containerRef, style }: PDFViewerProps) {
  return (
    <div className="pdf-viewer-container" ref={containerRef} style={style}>
      {pages.map((pageNumber) => (
        <div key={pageNumber} className="pdf-page-card">
          <img
            src={`${BACKEND}/pdf-pages/${pageNumber}.png`}
            alt={`Page ${pageNumber}`}
            className="pdf-page-img"
          />
          <div className="pdf-page-number">Trang {pageNumber}</div>
        </div>
      ))}
    </div>
  )
}
