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
  const targetPage = pages && pages.length > 0 ? pages[0] : 1

  return (
    <div className="pdf-viewer-container" ref={containerRef} style={style}>
      <iframe
        key={`${bookVal}-${typeVal}-${targetPage}`}
        src={`${BACKEND}/tests/${bookVal}/pdf?pdf_type=${typeVal}#page=${targetPage}&toolbar=0`}
        className="pdf-viewer-iframe"
        title={`Cambridge ${bookVal} PDF`}
      />
    </div>
  )
}
