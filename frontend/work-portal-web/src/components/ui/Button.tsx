import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button as SdkButton } from 'rsp-react-design-system/shadcn'

export type ButtonVariant = 'filled' | 'outlined' | 'text'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  children?: ReactNode
}

// 포탈 API → RSP 디자인시스템 SDK(shadcn) variant/size 매핑
const VARIANT_MAP = { filled: 'default', outlined: 'outline', text: 'ghost' } as const
const SIZE_MAP = { xs: 'xs', sm: 'sm', md: 'default', lg: 'lg' } as const

export default function Button({
  variant = 'filled',
  size = 'md',
  leadingIcon,
  trailingIcon,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <SdkButton type={type} variant={VARIANT_MAP[variant]} size={SIZE_MAP[size]} {...rest}>
      {leadingIcon && <span data-icon="inline-start" style={{ display: 'inline-flex' }}>{leadingIcon}</span>}
      {children}
      {trailingIcon && <span data-icon="inline-end" style={{ display: 'inline-flex' }}>{trailingIcon}</span>}
    </SdkButton>
  )
}
