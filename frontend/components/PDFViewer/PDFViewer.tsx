import React from 'react'
import './PDFViewer.css'

interface PDFViewerProps {
  pages: number[]
  containerRef?: React.RefObject<HTMLDivElement | null>
  style?: React.CSSProperties
  book?: string | number
  pdfType?: 'academic' | 'solution' | 'lc' | 'rc'
  partKey?: string
  test?: number
}

const BACKEND = '/api'

export default function PDFViewer({ pages, containerRef, style, book, pdfType, partKey, test }: PDFViewerProps) {
  const bookVal = book ?? '11'
  const typeVal = pdfType ?? 'academic'

  // 1. If partKey and test are provided, render the sliced layout PDF in an iframe
  if (partKey && test) {
    const srcUrl = `${BACKEND}/tests/${bookVal}/pdf-parts/${typeVal}/${test}/${partKey}#toolbar=0&zoom=115`
    return (
      <div className="pdf-viewer-container" ref={containerRef} style={style}>
        <iframe
          key={`${bookVal}-${typeVal}-${partKey}`}
          src={srcUrl}
          className="pdf-viewer-iframe"
          title={`Cambridge ${bookVal} Test ${test} Part ${partKey}`}
        />
      </div>
    )
  }

  // 2. If pages are provided, render a PDF containing only those pages in an iframe
  if (pages && pages.length > 0) {
    const targetPage = pages[0]
    const srcUrl = `${BACKEND}/tests/${bookVal}/pdf-pages/${typeVal}/${targetPage}#toolbar=0&zoom=115`
    return (
      <div className="pdf-viewer-container" ref={containerRef} style={style}>
        <iframe
          key={`${bookVal}-${typeVal}-${targetPage}`}
          src={srcUrl}
          className="pdf-viewer-iframe"
          title={`Cambridge ${bookVal} Page ${targetPage}`}
        />
      </div>
    )
  }

  // 3. Fallback: Entire PDF book iframe
  const targetPage = pages && pages.length > 0 ? pages[0] : 1
  return (
    <div className="pdf-viewer-container" ref={containerRef} style={style}>
      <iframe
        key={`${bookVal}-${typeVal}-${targetPage}`}
        src={`${BACKEND}/tests/${bookVal}/pdf?pdf_type=${typeVal}#page=${targetPage}&toolbar=0&zoom=115`}
        className="pdf-viewer-iframe"
        title={`Cambridge ${bookVal} PDF`}
      />
    </div>
  )
}

