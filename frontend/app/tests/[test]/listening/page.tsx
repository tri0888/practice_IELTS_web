async function fetchAudio(testNumber: string) {
  const response = await fetch(`http://127.0.0.1:8000/api/tests/11/${testNumber}/audio`, { cache: 'no-store' })
  if (!response.ok) return []
  return response.json()
}

export default async function ListeningPage({ params }: { params: Promise<{ test: string }> }) {
  const { test } = await params
  const audioList = await fetchAudio(test)

  return (
    <div>
      <h2>Listening — Test {test}</h2>
      <p>{audioList.length} audio parts loaded from backend.</p>
      <div>
        {audioList.map((s: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd' }}>
            <strong>{s.file_name}</strong>
            <div style={{ marginTop: 8 }}>
              <audio controls preload="none">
                <source src={`http://127.0.0.1:8000/api/audio/${encodeURIComponent(s.file_name)}`} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
