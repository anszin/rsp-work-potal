import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'filled' | 'outlined' | 'text'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  children?: ReactNode
}

export default function Button({
  variant = 'filled',
  size = 'md',
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  type = 'button',
  className = '',
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`ds-btn ds-btn--${variant} ds-btn--${size} ${className}`}
      style={style}
      {...rest}
    >
      {leadingIcon && <span className="ds-btn__icon ds-btn__icon--lead">{leadingIcon}</span>}
      {children && <span className="ds-btn__label">{children}</span>}
      {trailingIcon && <span className="ds-btn__icon ds-btn__icon--trail">{trailingIcon}</span>}
    </button>
  )
}
