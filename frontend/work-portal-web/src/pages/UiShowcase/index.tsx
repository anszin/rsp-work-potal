import { useState } from 'react'
import { Button, TextField, Checkbox, Radio, IconButton } from '../../components/ui'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 48 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-sub)', marginBottom: 20, paddingBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
      {title}
    </h2>
    {children}
  </section>
)

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
    <span style={{ width: 130, fontSize: 12, color: 'var(--c-text-muted)', flexShrink: 0 }}>{label}</span>
    {children}
  </div>
)

export default function UiShowcase() {
  const [checked, setChecked] = useState(false)
  const [radio, setRadio] = useState('a')
  const [textVal, setTextVal] = useState('')

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 32px', color: 'var(--c-text)' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>RSP Design System</h1>
      <p style={{ fontSize: 14, color: 'var(--c-text-muted)', marginBottom: 40 }}>UI 컴포넌트 쇼케이스</p>

      {/* ── Filled Button ── */}
      <Section title="Filled Button">
        <Row label="state=enabled">
          <Button variant="filled">Button</Button>
          <Button variant="filled" leadingIcon="＋">Button</Button>
          <Button variant="filled" trailingIcon="›">Button</Button>
        </Row>
        <Row label="size">
          <Button variant="filled" size="sm">Small</Button>
          <Button variant="filled" size="md">Medium</Button>
          <Button variant="filled" size="lg">Large</Button>
        </Row>
        <Row label="state=disabled">
          <Button variant="filled" disabled>Button</Button>
          <Button variant="filled" disabled leadingIcon="＋">Button</Button>
        </Row>
      </Section>

      {/* ── Outlined Button ── */}
      <Section title="Outlined Button">
        <Row label="state=enabled">
          <Button variant="outlined">Button</Button>
          <Button variant="outlined" leadingIcon="＋">Button</Button>
          <Button variant="outlined" trailingIcon="›">Button</Button>
        </Row>
        <Row label="size">
          <Button variant="outlined" size="sm">Small</Button>
          <Button variant="outlined" size="md">Medium</Button>
          <Button variant="outlined" size="lg">Large</Button>
        </Row>
        <Row label="state=disabled">
          <Button variant="outlined" disabled>Button</Button>
          <Button variant="outlined" disabled leadingIcon="＋">Button</Button>
        </Row>
      </Section>

      {/* ── Text Button ── */}
      <Section title="Text Button">
        <Row label="state=enabled">
          <Button variant="text">Button</Button>
          <Button variant="text" trailingIcon="›">Button</Button>
          <Button variant="text" leadingIcon="‹">Button</Button>
        </Row>
        <Row label="state=disabled">
          <Button variant="text" disabled>Button</Button>
          <Button variant="text" disabled trailingIcon="›">Button</Button>
        </Row>
      </Section>

      {/* ── Icon Button ── */}
      <Section title="Icon Button">
        <Row label="variant=filled">
          <IconButton variant="filled" size="sm" icon="★" label="즐겨찾기" />
          <IconButton variant="filled" size="md" icon="★" label="즐겨찾기" />
          <IconButton variant="filled" size="lg" icon="★" label="즐겨찾기" />
        </Row>
        <Row label="variant=outlined">
          <IconButton variant="outlined" size="sm" icon="✏" label="수정" />
          <IconButton variant="outlined" size="md" icon="✏" label="수정" />
          <IconButton variant="outlined" size="lg" icon="✏" label="수정" />
        </Row>
        <Row label="variant=text">
          <IconButton variant="text" size="sm" icon="✕" label="닫기" />
          <IconButton variant="text" size="md" icon="✕" label="닫기" />
          <IconButton variant="text" size="lg" icon="✕" label="닫기" />
        </Row>
        <Row label="disabled">
          <IconButton variant="filled" icon="★" label="즐겨찾기" disabled />
          <IconButton variant="outlined" icon="✏" label="수정" disabled />
          <IconButton variant="text" icon="✕" label="닫기" disabled />
        </Row>
      </Section>

      {/* ── TextField ── */}
      <Section title="TextField">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 600 }}>
          <TextField
            label="기본"
            placeholder="입력하세요"
            value={textVal}
            onChange={e => setTextVal(e.target.value)}
          />
          <TextField
            label="Supporting text"
            placeholder="입력하세요"
            supportingText="최대 100자까지 입력 가능합니다"
          />
          <TextField
            label="Trailing icon"
            placeholder="검색"
            trailingIcon="🔍"
          />
          <TextField
            label="Error 상태"
            placeholder="입력하세요"
            error
            supportingText="필수 항목입니다"
            defaultValue="잘못된 입력"
          />
          <TextField
            label="Disabled"
            placeholder="비활성화"
            disabled
            defaultValue="수정 불가"
          />
        </div>
      </Section>

      {/* ── Checkbox ── */}
      <Section title="Checkbox">
        <Row label="state=enabled">
          <Checkbox />
          <Checkbox label="Label" />
          <Checkbox label="Checked" checked onChange={() => {}} />
        </Row>
        <Row label="interactive">
          <Checkbox
            label={checked ? '선택됨' : '선택 안 됨'}
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
          />
        </Row>
        <Row label="state=disabled">
          <Checkbox disabled />
          <Checkbox label="Label" disabled />
          <Checkbox label="Checked" disabled checked onChange={() => {}} />
        </Row>
      </Section>

      {/* ── Radio ── */}
      <Section title="Radio Button">
        <Row label="state=enabled">
          <Radio name="demo-r" label="Label A" value="a" checked={radio === 'a'} onChange={() => setRadio('a')} />
          <Radio name="demo-r" label="Label B" value="b" checked={radio === 'b'} onChange={() => setRadio('b')} />
          <Radio name="demo-r" label="Label C" value="c" checked={radio === 'c'} onChange={() => setRadio('c')} />
        </Row>
        <Row label="state=disabled">
          <Radio name="demo-rd" label="Label" value="x" disabled />
          <Radio name="demo-rd" label="Selected" value="y" disabled checked onChange={() => {}} />
        </Row>
      </Section>

      {/* ── Color Tokens ── */}
      <Section title="Color Tokens">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            ['--c-action', '액션 (Primary)'],
            ['--c-action-hover', '액션 Hover'],
            ['--c-bg', 'Background'],
            ['--c-card', 'Card'],
            ['--c-thead', 'Table Head'],
            ['--c-border', 'Border'],
            ['--c-border-in', 'Border Strong'],
            ['--c-tag-done-bg', 'Tag Done'],
            ['--c-tag-sys', 'Tag System'],
            ['--c-tag-err-bg', 'Tag Error'],
            ['--c-tag-warn-bg', 'Tag Warning'],
            ['--c-tag-pri-bg', 'Tag Priority'],
          ].map(([token, label]) => (
            <div key={token} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 56, height: 36, borderRadius: 6, background: `var(${token})`, border: '1px solid var(--c-border)' }} />
              <span style={{ fontSize: 10, color: 'var(--c-text-muted)', textAlign: 'center', maxWidth: 60 }}>{label}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
