import type { CSSProperties, ReactNode } from 'react'

interface Props {
  title: ReactNode
  description?: ReactNode   // 제목 아래 설명 문구 (선택)
  extra?: ReactNode         // 제목 바로 오른쪽 보조 요소 (탭바, 건수 뱃지, 기준일 등)
  actions?: ReactNode       // 오른쪽 끝 액션 (버튼, 필터 등)
  style?: CSSProperties     // 바깥 여백 조정 등 레이아웃용
}

/*
 * 페이지 제목 영역 표준
 * - 제목 20px / 600 (글자 크기 체계의 '페이지 제목'), 설명 13px 보조색
 * - [제목][extra] ........ [actions] 한 줄, 좁은 화면에서는 줄바꿈
 * - 아래 여백 20px
 */
export default function PageHeader({ title, description, extra, actions, style }: Props) {
  return (
    <div className="page-header" style={style}>
      <div className="page-header__main">
        <div className="page-header__title-row">
          <h2 className="page-header__title">{title}</h2>
          {extra}
        </div>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
