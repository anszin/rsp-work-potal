import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button as SdkButton } from 'rsp-react-design-system/shadcn'

export type IconButtonVariant = 'filled' | 'outlined' | 'text'
export type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  icon: ReactNode
  label: string  // aria-label (필수)
}

// 포탈 API → RSP 디자인시스템 SDK(shadcn) variant/size 매핑
const VARIANT_MAP = { filled: 'default', outlined: 'outline', text: 'ghost' } as const
const SIZE_MAP = { sm: 'icon-sm', md: 'icon', lg: 'icon-lg' } as const

export default function IconButton({
  variant = 'text',
  size = 'md',
  icon,
  label,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <SdkButton type={type} aria-label={label} variant={VARIANT_MAP[variant]} size={SIZE_MAP[size]} {...rest}>
      {icon}
    </SdkButton>
  )
}
