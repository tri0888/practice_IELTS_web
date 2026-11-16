"use client"

import { useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'

/**
 * react-hook-form state for exam answer sheets (question number -> answer).
 *
 * Fields are stored under `answers.q<N>` (a numeric path segment would make
 * RHF build an array), while `answers` is exposed as `Record<number, string>`
 * so grading/submit code keeps working unchanged.
 */
type AnswerFormValues = { answers: Record<string, string> }
export type AnswerFieldName = `answers.q${number}`

const toFormValues = (init: Record<number, string>) => {
  const values: Record<string, string> = {}
  for (const [q, value] of Object.entries(init)) values[`q${q}`] = value
  return values
}

export function useAnswerForm(initial: Record<number, string> = {}) {
  const { control, reset, setValue, watch } = useForm<AnswerFormValues>({ defaultValues: { answers: toFormValues(initial) } })
  const raw = watch('answers')

  const answers = useMemo(() => {
    const out: Record<number, string> = {}
    for (const [key, value] of Object.entries(raw ?? {})) out[Number(key.slice(1))] = value ?? ''
    return out
  }, [raw])

  const answerField = useCallback((q: number): AnswerFieldName => `answers.q${q}`, [])

  const resetAnswers = useCallback((init: Record<number, string>) => {
    reset({ answers: toFormValues(init) })
  }, [reset])

  const setAnswer = useCallback((q: number, value: string) => {
    setValue(`answers.q${q}`, value, { shouldDirty: true })
  }, [setValue])

  return { control, answers, answerField, resetAnswers, setAnswer }
}
