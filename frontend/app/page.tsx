"use client"
import useSWR from 'swr'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function Page() {
  const { data, error } = useSWR('/api/tests', fetcher)

  if (error) return <div>Failed to load tests</div>
  if (!data) return <div>Loading tests...</div>

  return (
    <div>
      <h2>Test Library</h2>
      <ul>
        {data.map((t: any) => (
          <li key={t.test_number}>
            <Link href={`/tests/${t.test_number}`}>Test {t.test_number}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
