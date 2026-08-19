import type { InputHTMLAttributes, ReactNode } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  supportingText?: string
  error?: boolean
  trailingIcon?: ReactNode
}

export default function TextField({
  label,
  supportingText,
  error = false,
  trailingIcon,
  id,
  disabled,
  className = '',
  ...rest
}: TextFieldProps) {
  const inputId = id ?? `tf-${label?.replace(/\s/g, '-')}`

  return (
    <div className={`ds-tf ${error ? 'ds-tf--error' : ''} ${disabled ? 'ds-tf--disabled' : ''} ${className}`}>
      {label && <label className="ds-tf__label" htmlFor={inputId}>{label}</label>}
      <div className="ds-tf__wrap">
        <input
          id={inputId}
          disabled={disabled}
          className="ds-tf__input"
          {...rest}
        />
        {trailingIcon && <span className="ds-tf__icon">{trailingIcon}</span>}
      </div>
      {supportingText && (
        <span className="ds-tf__support">{supportingText}</span>
      )}
    </div>
  )
}
