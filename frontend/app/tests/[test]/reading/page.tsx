async function fetchTest(testNumber: string) {
  const response = await fetch(`http://127.0.0.1:8000/api/tests/11/${testNumber}`, { cache: 'no-store' })
  if (!response.ok) return null
  return response.json()
}

export default async function ReadingPage({ params }: { params: Promise<{ test: string }> }) {
  const { test } = await params
  const testData = await fetchTest(test)

  if (!testData) return <div>Test not found</div>

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 12 }}>
        <h3>Passage (placeholder)</h3>
        <p>Passage content is not available in seed; import the full question content in Phase 1d.</p>
      </div>
      <div style={{ width: 360 }}>
        <h3>Questions</h3>
        {testData.sections.map((s: any, si: number) => (
          <div key={si} style={{ marginBottom: 12 }}>
            <strong>{s.name}</strong>
            <ol>
              {s.rows.map((r: any) => (
                <li key={r.question_number}>{r.question_number}. (answer: {r.answer_text || '—'})</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
