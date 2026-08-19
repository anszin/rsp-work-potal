import type { InputHTMLAttributes } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export default function Checkbox({ label, id, disabled, className = '', ...rest }: CheckboxProps) {
  const inputId = id ?? `cb-${label?.replace(/\s/g, '-')}`

  return (
    <label className={`ds-checkbox ${disabled ? 'ds-checkbox--disabled' : ''} ${className}`} htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        disabled={disabled}
        className="ds-checkbox__input"
        {...rest}
      />
      <span className="ds-checkbox__box" aria-hidden="true" />
      {label && <span className="ds-checkbox__label">{label}</span>}
    </label>
  )
}
