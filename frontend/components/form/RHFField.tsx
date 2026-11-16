"use client"

import React from 'react'
import { Form } from 'antd'
import { Controller, type Control, type FieldValues, type Path, type RegisterOptions } from 'react-hook-form'

/**
 * Bridges react-hook-form (state + validation) with Ant Design inputs (UI).
 * The child must be a controlled AntD input (Input, Input.Password, Select, ...);
 * `value`/`onChange`/`onBlur` are injected from RHF.
 */
type RHFFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  label?: React.ReactNode
  rules?: RegisterOptions<T, Path<T>>
  className?: string
  children: React.ReactElement<Record<string, unknown>>
}

export default function RHFField<T extends FieldValues>({ control, name, label, rules, className, children }: RHFFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          className={className}
          validateStatus={fieldState.error ? 'error' : undefined}
          help={fieldState.error?.message}
          required={!!rules?.required}
        >
          {React.cloneElement(children, {
            ...field,
            id: name,
            status: fieldState.error ? 'error' : undefined,
          })}
        </Form.Item>
      )}
    />
  )
}
