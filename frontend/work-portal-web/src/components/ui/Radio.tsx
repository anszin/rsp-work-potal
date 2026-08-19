import type { InputHTMLAttributes } from 'react'

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export default function Radio({ label, id, disabled, className = '', ...rest }: RadioProps) {
  const inputId = id ?? `rb-${label?.replace(/\s/g, '-')}`

  return (
    <label className={`ds-radio ${disabled ? 'ds-radio--disabled' : ''} ${className}`} htmlFor={inputId}>
      <input
        id={inputId}
        type="radio"
        disabled={disabled}
        className="ds-radio__input"
        {...rest}
      />
      <span className="ds-radio__circle" aria-hidden="true" />
      {label && <span className="ds-radio__label">{label}</span>}
    </label>
  )
}
