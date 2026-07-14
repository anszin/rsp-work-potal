import { useState, useRef, useEffect, useCallback, DragEvent } from 'react'
import { uploadDocument, getDocuments, deleteDocument, AiDocument, DocScope } from '../../api/aiApi'
import { useAuth } from '../../context/useAuth'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const SCOPES: { value: DocScope; label: string; color: string }[] = [
  { value: 'shared',   label: '전체 공유',    color: '#4caf50' },
  { value: 'backend',  label: '백엔드 전용',  color: '#1976d2' },
  { value: 'android',  label: '안드로이드 전용', color: '#9c27b0' },
  { value: 'frontend', label: '프론트 전용',  color: '#ff9800' },
  { value: 'planner',  label: '기획 전용',    color: '#607d8b' },
]

const ROLES: { value: string; label: string }[] = [
  { value: 'all',      label: '전체' },
  { value: 'backend',  label: '백엔드' },
  { value: 'android',  label: '안드로이드' },
  { value: 'frontend', label: '프론트엔드' },
  { value: 'planner',  label: '기획' },
]

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.java,.kt,.ts,.tsx,.js,.jsx,.py,.go,.xml,.yaml,.yml,.json,.csv,.html,.css,.sh,.sql'
const MAX_SIZE = 50 * 1024 * 1024

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ScopeBadge({ scope }: { scope: DocScope }) {
  const s = SCOPES.find(s => s.value === scope)
  if (!s) return null
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 10,
      background: s.color + '22', color: s.color, fontWeight: 600,
      border: `1px solid ${s.color}44`, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ── 업로드 큐 아이템 ──────────────────────────────────────────────────────────

interface UploadItem {
  id: string
  file: File
  scope: DocScope
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

// ── 삭제 확인 다이얼로그 ──────────────────────────────────────────────────────

function ConfirmDialog({
  filename, onConfirm, onCancel,
}: { filename: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--c-card)', border: '1px solid var(--c-border)',
        borderRadius: 12, padding: '24px 28px', maxWidth: 360, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--c-text)' }}>문서 삭제</div>
        <div style={{ fontSize: 13, color: 'var(--c-text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--c-text)' }}>{filename}</strong>을(를) 삭제하면<br />
          RAG 인덱스에서도 제거됩니다. 계속하시겠습니까?
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 13, cursor: 'pointer',
            background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)',
          }}>취소</button>
          <button onClick={onConfirm} style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 13, cursor: 'pointer',
            background: '#f44336', border: 'none', color: '#fff', fontWeight: 600,
          }}>삭제</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AiDocumentsPage() {
  const { user } = useAuth()
  const uploaderId = user?.username ?? ''

  const [docs, setDocs] = useState<AiDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [filterRole, setFilterRole] = useState('all')

  const [scope, setScope] = useState<DocScope>('shared')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AiDocument | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 문서 목록 로드 ──────────────────────────────────────────────────────────

  const loadDocs = useCallback(async () => {
    setDocsLoading(true)
    try {
      setDocs(await getDocuments(filterRole))
    } catch (e) {
      console.error('[AI] 문서 목록 조회 실패:', e)
    } finally {
      setDocsLoading(false)
    }
  }, [filterRole])

  useEffect(() => { loadDocs() }, [loadDocs])

  // ── 파일 업로드 처리 ────────────────────────────────────────────────────────

  const startUpload = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const items: UploadItem[] = arr.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      scope,
      progress: 0,
      status: 'pending' as const,
    }))

    setUploads(prev => [...prev, ...items])

    items.forEach(item => {
      if (item.file.size > MAX_SIZE) {
        setUploads(prev => prev.map(u =>
          u.id === item.id ? { ...u, status: 'error', error: '파일 크기 50MB 초과' } : u
        ))
        return
      }

      setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading' } : u))

      uploadDocument(item.file, item.scope, uploaderId, (pct) => {
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, progress: pct } : u))
      })
        .then(() => {
          setUploads(prev => prev.map(u =>
            u.id === item.id ? { ...u, status: 'done', progress: 100 } : u
          ))
          loadDocs()
        })
        .catch((err: Error) => {
          setUploads(prev => prev.map(u =>
            u.id === item.id ? { ...u, status: 'error', error: err.message } : u
          ))
        })
    })
  }, [scope, uploaderId, loadDocs])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      startUpload(e.target.files)
      e.target.value = ''
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) startUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const clearDoneUploads = () => setUploads(prev => prev.filter(u => u.status !== 'done' && u.status !== 'error'))

  // ── 삭제 ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteDocument(deleteTarget.id)
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id))
    } catch (e) {
      console.error('[AI] 문서 삭제 실패:', e)
    } finally {
      setDeleteTarget(null)
    }
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  const activeUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'pending')
  const finishedUploads = uploads.filter(u => u.status === 'done' || u.status === 'error')

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {deleteTarget && (
        <ConfirmDialog
          filename={deleteTarget.originalFilename}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>RAG 문서 관리</h2>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 3 }}>
          AI가 참조할 문서를 업로드합니다. PDF, Word, Excel, 코드 파일 지원 (최대 50MB)
        </div>
      </div>

      {/* 업로드 영역 */}
      <div style={{
        background: 'var(--c-card)', border: '1px solid var(--c-border)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 5 }}>공유 범위</div>
            <select
              value={scope}
              onChange={e => setScope(e.target.value as DocScope)}
              style={{
                padding: '7px 28px 7px 10px', borderRadius: 7, fontSize: 13,
                border: '1px solid var(--c-border)', background: 'var(--c-bg)',
                color: 'var(--c-text)', cursor: 'pointer', appearance: 'auto',
              }}
            >
              {SCOPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 5 }}>지원 형식</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.7 }}>
              PDF · Word · Excel · TXT · MD · Java · Kotlin · TypeScript · JavaScript · Python · Go · XML · YAML · JSON · CSV · SQL
            </div>
          </div>
        </div>

        {/* 드롭존 */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#1976d2' : 'var(--c-border)'}`,
            borderRadius: 10,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? '#1976d211' : 'var(--c-bg)',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 4 }}>
            파일을 드래그하거나 클릭해서 업로드
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
            현재 범위: <strong style={{ color: SCOPES.find(s => s.value === scope)?.color }}>{SCOPES.find(s => s.value === scope)?.label}</strong>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* 업로드 진행 목록 */}
        {uploads.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {activeUploads.map(u => (
              <div key={u.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--c-text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{u.file.name}</span>
                  <span style={{ color: 'var(--c-text-muted)', flexShrink: 0, marginLeft: 8 }}>{u.progress}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: '#1976d2',
                    width: `${u.progress}%`,
                    transition: 'width 0.2s',
                  }} />
                </div>
              </div>
            ))}

            {finishedUploads.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {finishedUploads.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0' }}>
                    <span style={{ color: u.status === 'done' ? '#4caf50' : '#f44336', flexShrink: 0 }}>
                      {u.status === 'done' ? '✓' : '✕'}
                    </span>
                    <span style={{ color: 'var(--c-text-sub)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.file.name}
                    </span>
                    {u.error && <span style={{ color: '#f44336', fontSize: 11 }}>{u.error}</span>}
                  </div>
                ))}
                <button onClick={clearDoneUploads} style={{
                  marginTop: 6, fontSize: 11, padding: '3px 9px', borderRadius: 5,
                  background: 'none', border: '1px solid var(--c-border)',
                  color: 'var(--c-text-muted)', cursor: 'pointer',
                }}>완료 항목 지우기</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 문서 목록 */}
      <div style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>업로드 문서</span>
            {!docsLoading && (
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{docs.length}개</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setFilterRole(r.value)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
                  border: `1px solid ${filterRole === r.value ? '#1976d2' : 'var(--c-border)'}`,
                  background: filterRole === r.value ? '#1976d218' : 'var(--c-bg)',
                  color: filterRole === r.value ? '#1976d2' : 'var(--c-text-muted)',
                  fontWeight: filterRole === r.value ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            ))}
            <button onClick={loadDocs} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
              border: '1px solid var(--c-border)', background: 'var(--c-bg)',
              color: 'var(--c-text-muted)',
            }}>새로고침</button>
          </div>
        </div>

        {docsLoading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>
            불러오는 중...
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            업로드된 문서가 없습니다
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--c-thead)' }}>
                  {['파일명', '범위', '크기', '청크', '업로더', '날짜', ''].map(h => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left', fontSize: 12,
                      color: 'var(--c-text-muted)', fontWeight: 600,
                      borderBottom: '1px solid var(--c-border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr
                    key={doc.id}
                    style={{ borderBottom: '1px solid var(--c-border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                      <div style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--c-text)', fontWeight: 500,
                      }} title={doc.originalFilename}>
                        {doc.originalFilename}
                      </div>
                      {doc.status !== 'DONE' && doc.status !== 'done' && (
                        <div style={{ fontSize: 10, color: '#ff9800', marginTop: 2 }}>{doc.status}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}><ScopeBadge scope={doc.scope} /></td>
                    <td style={{ padding: '10px 14px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--c-text-muted)', textAlign: 'center' }}>
                      {doc.chunkCount}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
                      {doc.uploaderId}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(doc.createdAt)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          download={doc.originalFilename}
                          style={{
                            fontSize: 12, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid var(--c-border)', background: 'none',
                            color: 'var(--c-text-sub)', cursor: 'pointer',
                            textDecoration: 'none', display: 'inline-block',
                          }}
                        >다운로드</a>
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          style={{
                            fontSize: 12, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid #f4433644', background: 'none',
                            color: '#f44336', cursor: 'pointer',
                          }}
                        >삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
