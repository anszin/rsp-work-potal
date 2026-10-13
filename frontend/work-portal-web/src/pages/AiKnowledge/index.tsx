import { useState, useEffect, useCallback } from 'react'
import {
  getKnowledgeStats, getKnowledgeFiles,
  KnowledgeStats, KnowledgeSource, KnowledgeFile, SourceType,
} from '../../api/aiApi'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui'

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
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
      background: `color-mix(in srgb, ${b.color} 13%, transparent)`, color: b.color, border: `1px solid color-mix(in srgb, ${b.color} 27%, transparent)`,
      whiteSpace: 'nowrap',
    }}>
      {b.label}
    </span>
  )
}

// ── 요약 카드 ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--c-card)', border: '1px solid var(--c-border)',
      borderRadius: 10, padding: '16px 20px', minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
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
      <div style={{ padding: '10px 14px 10px 48px', fontSize: 12, color: 'var(--c-text-muted)' }}>불러오는 중...</div>
    )
    if (files.length === 0) return (
      <div style={{ padding: '10px 14px 10px 48px', fontSize: 12, color: 'var(--c-text-muted)' }}>파일 없음</div>
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
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>지식베이스 현황</h2>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 3 }}>
          RAG 색인된 소스 및 청크 현황을 확인합니다
        </div>
      </div>

      {/* 요약 카드 */}
      {!loading && stats && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="전체 청크" value={stats.totalChunks ?? stats.total_chunks ?? 0} sub="벡터 DB 저장 단위" />
          <StatCard label="소스 수" value={stats.sources.length} sub="저장소 / 업로드 문서" />
        </div>
      )}

      {/* 테이블 */}
      <div style={{
        background: 'var(--c-card)', border: '1px solid var(--c-border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>소스별 색인 현황</span>
          <button
            onClick={load}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
              border: '1px solid var(--c-border)', background: 'var(--c-bg)',
              color: 'var(--c-text-muted)',
            }}
          >
            새로고침
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>
            불러오는 중...
          </div>
        ) : error ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--c-tag-err-t)', fontSize: 13 }}>
            {error}
          </div>
        ) : !stats || stats.sources.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            색인된 소스가 없습니다
          </div>
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
      </div>
    </div>
  )
}
