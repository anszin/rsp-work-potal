import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonVariants, Tooltip, TooltipContent, TooltipTrigger } from 'rsp-react-design-system/shadcn'

export type IconButtonVariant = 'filled' | 'outlined' | 'text'
export type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  icon: ReactNode
  label: string  // aria-label + 툴팁 문구 (필수)
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
  title,
  className,
  ...rest
}: IconButtonProps) {
  // 아이콘만 있는 버튼이므로 SDK 툴팁으로 의미 표시 (title 지정 시 title 우선)
  // React 18 에서는 SDK Button 이 ref 를 전달하지 못해 render={<Button/>} 시 툴팁 위치를 잡지 못함
  // → TooltipTrigger 자체를 버튼으로 렌더링하고 SDK buttonVariants 클래스로 동일한 모양 적용
  // data-slot="button": SDK ButtonGroup 등의 버튼 인식용, data-portal-icon-size: 크기 보정용 (index.css)
  return (
    <Tooltip>
      <TooltipTrigger
        type={type}
        aria-label={label}
        data-slot="button"
        data-portal-icon-size={size}
        className={[buttonVariants({ variant: VARIANT_MAP[variant], size: SIZE_MAP[size] }), className].filter(Boolean).join(' ')}
        {...rest}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{title ?? label}</TooltipContent>
    </Tooltip>
  )
}
