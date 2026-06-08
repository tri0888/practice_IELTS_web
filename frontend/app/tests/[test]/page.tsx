import Link from 'next/link'

async function fetchTest(testNumber: string) {
  const response = await fetch(`http://127.0.0.1:8000/api/tests/11/${testNumber}`, { cache: 'no-store' })
  if (!response.ok) return null
  return response.json()
}

export default async function TestPage({ params }: { params: Promise<{ test: string }> }) {
  const { test } = await params
  const testData = await fetchTest(test)

  if (!testData) return <div>Test not found</div>

  return (
    <div>
      <h2>Test {testData.test_number}</h2>
      <div style={{ marginBottom: 12 }}>
        <Link href={`/tests/${test}/practice`}>Start doing test</Link> |{' '}
        <Link href={`/tests/${test}/listening`}>Open Listening</Link> |{' '}
        <Link href={`/tests/${test}/reading`}>Open Reading</Link>
      </div>
      <h3>Sections</h3>
      <ul>
        {testData.sections.map((s: any, i: number) => (
          <li key={i}>{s.name} — {s.row_count} items</li>
        ))}
      </ul>
    </div>
  )
}
