"use client"

import { useParams } from 'next/navigation'
import ListeningPractice from '@/components/practice/ListeningPractice'

export default function ListeningPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  return <ListeningPractice book={book} test={test} />
}
