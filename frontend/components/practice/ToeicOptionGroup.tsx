"use client"

import { Radio } from 'antd'
import { Controller, type Control } from 'react-hook-form'
import './ToeicOptionGroup.css'
import type { AnswerFieldName } from '@/lib/useAnswerForm'

type Props = {
  // Control of the form created by useAnswerForm()
  control: Control<{ answers: Record<string, string> }>
  name: AnswerFieldName
  options: string[]
  disabled: boolean
  /** When set (after submit), the correct option turns green and a wrong pick turns red. */
  correctAnswer?: string
  className?: string
}

const CORRECT = { background: 'var(--status-correct, #22c55e)', borderColor: 'var(--status-correct, #22c55e)', color: '#fff' }
const WRONG = { background: 'var(--status-wrong, #ef4444)', borderColor: 'var(--status-wrong, #ef4444)', color: '#fff' }

export default function ToeicOptionGroup({ control, name, options, disabled, correctAnswer, className }: Props) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Radio.Group
          className={`ets-options-group ${className ?? ''}`}
          optionType="button"
          buttonStyle="solid"
          value={field.value || undefined}
          onChange={e => field.onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map(opt => (
            <Radio.Button
              key={opt}
              value={opt}
              className="ets-option-label"
              style={correctAnswer
                ? opt === correctAnswer ? CORRECT : field.value === opt ? WRONG : undefined
                : undefined}
            >
              {opt}
            </Radio.Button>
          ))}
        </Radio.Group>
      )}
    />
  )
}
