import { useState, useEffect, useCallback } from 'react'
import {
  getKnowledgeStats, getKnowledgeFiles,
  KnowledgeStats, KnowledgeSource, KnowledgeFile, SourceType,
} from '../../api/aiApi'
import { Button, Tag, Panel, Loading, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<SourceType, { label: string; color: string }> = {
  GITHUB: { label: 'GitHub', color: 'var(--c-chart-1)' },
  GITLAB: { label: 'GitLab', color: 'var(--c-chart-3)' },
  UPLOAD: { label: '업로드', color: 'var(--c-chart-2)' },
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

// ── 소스 타입 배지 ────────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: SourceType }) {
  const b = SOURCE_BADGE[type] ?? { label: type, color: 'var(--c-chart-8)' }
  return (
    <Tag color={b.color} style={{ whiteSpace: 'nowrap' }}>
      {b.label}
    </Tag>
  )
}

// ── 요약 카드 ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Panel style={{ display: 'block', padding: '16px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>{sub}</div>}
    </Panel>
  )
}

// ── 파일 목록 행 (펼침) ───────────────────────────────────────────────────────

type FileRowsParams =
  | { repo: string; sourceType?: never }
  | { sourceType: string; repo?: never }

function FileRows({ repo, sourceType }: FileRowsParams) {
  const [files, setFiles] = useState<KnowledgeFile[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = repo ? { repo } : { sourceType: sourceType! }
    getKnowledgeFiles(params)
      .then(setFiles)
      .catch(e => setError((e as Error).message))
  }, [repo, sourceType])

  const inner = (() => {
    if (error) return (
      <div style={{ padding: '10px 14px 10px 48px', fontSize: 12, color: 'var(--c-tag-err-t)' }}>{error}</div>
    )
    if (!files) return (
      <Loading style={{ padding: '10px 14px 10px 48px', fontSize: 12, justifyContent: 'flex-start' }} />
    )
    if (files.length === 0) return (
      <EmptyState title="파일 없음" style={{ padding: '10px 14px' }} />
    )

    // 청크 수 내림차순 정렬
    const repoPrefix = repo ? repo + '/' : ''
    const sorted = [...files].sort((a, b) => b.chunkCount - a.chunkCount)

    return (
      <Table>
        <TableBody>
          {sorted.map((f, i) => {
            // repo 소스: 접두어 제거 / UPLOAD: 경로 그대로
            const relPath = repoPrefix && f.sourcePath.startsWith(repoPrefix)
              ? f.sourcePath.slice(repoPrefix.length)
              : f.sourcePath
            const fileName = relPath.split('/').pop() || relPath
            const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : ''
            return (
              <TableRow key={i}>
                <TableCell style={{ paddingLeft: 48 }}>
                  <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginRight: 6 }}>└</span>
                  {dir && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginRight: 4 }}>
                      {dir}/
                    </span>
                  )}
                  <span
                    style={{ fontSize: 12, color: 'var(--c-text)', fontFamily: 'monospace', fontWeight: 500 }}
                    title={f.sourcePath}
                  >
                    {fileName}
                  </span>
                </TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {fmtNum(f.chunkCount)} 청크
                </TableCell>
                <TableCell style={{ width: 32 }} />
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  })()

  return (
    <TableRow>
      <TableCell colSpan={5} style={{ padding: 0, background: 'var(--c-bg)' }}>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {inner}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── 소스 행 ───────────────────────────────────────────────────────────────────

function SourceRow({ source }: { source: KnowledgeSource }) {
  const [expanded, setExpanded] = useState(false)
  const sourceType = (source.sourceType ?? source.source_type) as SourceType | undefined
  const chunkCount = source.chunkCount ?? source.chunk_count ?? 0
  const lastUpdated = source.lastUpdated ?? source.last_updated
  // repo 소스이거나 UPLOAD 소스 모두 펼침 가능
  const canExpand = true

  return (
    <>
      <TableRow
        onClick={() => canExpand && setExpanded(v => !v)}
        style={{ cursor: canExpand ? 'pointer' : 'default' }}
      >
        <TableCell>
          {sourceType && <SourceBadge type={sourceType} />}
        </TableCell>
        <TableCell>
          <span style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 500 }}>
            {source.repo ?? '업로드 문서'}
          </span>
        </TableCell>
        <TableCell style={{ textAlign: 'right', fontWeight: 600 }}>
          {fmtNum(chunkCount)}
        </TableCell>
        <TableCell style={{ fontSize: 12, color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
          {fmtDate(lastUpdated)}
        </TableCell>
        <TableCell style={{ textAlign: 'center', fontSize: 12, color: 'var(--c-text-muted)' }}>
          {canExpand ? (expanded ? '▲' : '▼') : ''}
        </TableCell>
      </TableRow>
      {expanded && (
        source.repo
          ? <FileRows repo={source.repo} />
          : <FileRows sourceType={sourceType ?? 'UPLOAD'} />
      )}
    </>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AiKnowledgePage() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStats(await getKnowledgeStats())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>

      {/* 헤더 */}
      <PageHeader
        title="지식베이스 현황"
        description="RAG 색인된 소스 및 청크 현황을 확인합니다"
      />

      {/* 요약 카드 */}
      {!loading && stats && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="전체 청크" value={stats.totalChunks ?? stats.total_chunks ?? 0} sub="벡터 DB 저장 단위" />
          <StatCard label="소스 수" value={stats.sources.length} sub="저장소 / 업로드 문서" />
        </div>
      )}

      {/* 테이블 */}
      <Panel style={{ display: 'block', padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>소스별 색인 현황</span>
          <Button variant="outlined" size="xs" onClick={load}>
            새로고침
          </Button>
        </div>

        {loading ? (
          <Loading style={{ padding: '48px 20px' }} />
        ) : error ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--c-tag-err-t)', fontSize: 13 }}>
            {error}
          </div>
        ) : !stats || stats.sources.length === 0 ? (
          <EmptyState title="색인된 소스가 없습니다" style={{ padding: '48px 20px' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  {['타입', '저장소', '청크 수', '마지막 업데이트', ''].map((h, i) => (
                    <TableHead key={i} style={{ textAlign: i === 2 ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.sources.map((src, i) => (
                  <SourceRow key={`${src.sourceType}-${src.repo}-${i}`} source={src} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  )
}
