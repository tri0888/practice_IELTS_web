"use client"

import { useParams } from 'next/navigation'
import ListeningPractice from '@/components/practice/ListeningPractice'

export default function ListeningPracticePage() {
  const params = useParams<{ test: string }>()
  const test = params?.test ?? '1'

  return <ListeningPractice test={test} />
}
