import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type IconButtonVariant = 'filled' | 'outlined' | 'text'
export type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  icon: ReactNode
  label: string  // aria-label (필수)
}

export default function IconButton({
  variant = 'text',
  size = 'md',
  icon,
  label,
  disabled,
  type = 'button',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      className={`ds-icon-btn ds-icon-btn--${variant} ds-icon-btn--${size} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  )
}
