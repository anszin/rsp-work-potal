import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSystems, createSystem, updateSystem, deleteSystem, System,
  getSystemManagers, addSystemManager, removeSystemManager, getUsers,
  getSubSystems, createSubSystem, updateSubSystem, deleteSubSystem, SubSystem,
  getSystemServers, addSystemServer, deleteSystemServer,
} from '../../api/systems'
import PageHeader from '../../components/PageHeader'
import { Switch } from '@lotte/rsp-react-design-system/shadcn'
import { Button, Input, Select, Modal, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Panel, Loading, EmptyState } from '../../components/ui'

const emptyForm = () => ({ code: '', name: '', description: '', redmineProjectKey: '', webexRoomId: '', sortOrder: '' })
const emptySubForm = () => ({ code: '', name: '', description: '' })

export default function SystemManagementPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<System | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [managerPanel, setManagerPanel] = useState<System | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number>(0)
  const [subPanel, setSubPanel] = useState<System | null>(null)
  const [subForm, setSubForm] = useState(emptySubForm())
  const [editingSub, setEditingSub] = useState<SubSystem | null>(null)
  const [showSubForm, setShowSubForm] = useState(false)
  const [serverSubPanel, setServerSubPanel] = useState<SubSystem | null>(null)
  const [newServerName, setNewServerName] = useState('')

  const { data: systems = [], isLoading } = useQuery({ queryKey: ['systems'], queryFn: getSystems })
  const { data: managers = [] } = useQuery({
    queryKey: ['systems', managerPanel?.id, 'managers'],
    queryFn: () => getSystemManagers(managerPanel!.id),
    enabled: !!managerPanel,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!managerPanel,
  })
  const { data: subSystems = [] } = useQuery({
    queryKey: ['systems', subPanel?.id, 'subsystems'],
    queryFn: () => getSubSystems(subPanel!.id),
    enabled: !!subPanel,
  })
  const { data: servers = [] } = useQuery({
    queryKey: ['systems', subPanel?.id, 'subsystems', serverSubPanel?.id, 'servers'],
    queryFn: () => getSystemServers(subPanel!.id, serverSubPanel!.id),
    enabled: !!serverSubPanel && !!subPanel,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['systems'] })
  const invalidateManagers = () => qc.invalidateQueries({ queryKey: ['systems', managerPanel?.id, 'managers'] })
  const invalidateSubs = () => qc.invalidateQueries({ queryKey: ['systems', subPanel?.id, 'subsystems'] })
  const invalidateServers = () => qc.invalidateQueries({ queryKey: ['systems', subPanel?.id, 'subsystems', serverSubPanel?.id, 'servers'] })

  const createMut = useMutation({ mutationFn: createSystem, onSuccess: () => { invalidate(); reset() } })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string; active?: boolean; redmineProjectKey?: string; webexRoomId?: string; sortOrder?: number } }) =>
      updateSystem(id, data),
    onSuccess: () => { invalidate(); reset() },
  })
  const deleteMut = useMutation({ mutationFn: deleteSystem, onSuccess: invalidate })
  const addManagerMut = useMutation({
    mutationFn: ({ systemId, userId }: { systemId: number; userId: number }) => addSystemManager(systemId, userId),
    onSuccess: () => { invalidateManagers(); setSelectedUserId(0) },
  })
  const removeManagerMut = useMutation({
    mutationFn: ({ systemId, userId }: { systemId: number; userId: number }) => removeSystemManager(systemId, userId),
    onSuccess: invalidateManagers,
  })
  const createSubMut = useMutation({
    mutationFn: ({ systemId, data }: { systemId: number; data: { code: string; name: string; description?: string } }) =>
      createSubSystem(systemId, data),
    onSuccess: () => { invalidateSubs(); resetSubForm() },
    onError: (e: any) => alert(e.response?.data?.error ?? '하위시스템 등록 실패'),
  })
  const updateSubMut = useMutation({
    mutationFn: ({ systemId, subId, data }: { systemId: number; subId: number; data: { name: string; description?: string; active?: boolean } }) =>
      updateSubSystem(systemId, subId, data),
    onSuccess: () => { invalidateSubs(); resetSubForm() },
    onError: (e: any) => alert(e.response?.data?.error ?? '하위시스템 수정 실패'),
  })
  const deleteSubMut = useMutation({
    mutationFn: ({ systemId, subId }: { systemId: number; subId: number }) => deleteSubSystem(systemId, subId),
    onSuccess: invalidateSubs,
    onError: (e: any) => alert(e.response?.data?.error ?? '하위시스템 삭제 실패'),
  })
  const addServerMut = useMutation({
    mutationFn: ({ systemId, subSystemId, serverName }: { systemId: number; subSystemId: number; serverName: string }) =>
      addSystemServer(systemId, subSystemId, serverName),
    onSuccess: () => { invalidateServers(); setNewServerName('') },
    onError: (e: any) => alert(e.response?.data?.error ?? '서버 등록 실패'),
  })
  const deleteServerMut = useMutation({
    mutationFn: ({ systemId, subSystemId, serverId }: { systemId: number; subSystemId: number; serverId: number }) =>
      deleteSystemServer(systemId, subSystemId, serverId),
    onSuccess: invalidateServers,
  })

  const reset = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }
  const resetSubForm = () => { setShowSubForm(false); setEditingSub(null); setSubForm(emptySubForm()) }

  const openEdit = (s: System) => {
    setEditing(s)
    setForm({ code: s.code, name: s.name, description: s.description ?? '', redmineProjectKey: s.redmineProjectKey ?? '', webexRoomId: s.webexRoomId ?? '', sortOrder: String(s.sortOrder ?? 0) })
    setShowForm(true)
  }

  const openSubEdit = (sub: SubSystem) => {
    setEditingSub(sub)
    setSubForm({ code: sub.code, name: sub.name, description: sub.description ?? '' })
    setShowSubForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const sortOrder = form.sortOrder !== '' ? Number(form.sortOrder) : undefined
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { name: form.name, description: form.description || undefined, redmineProjectKey: form.redmineProjectKey || undefined, webexRoomId: form.webexRoomId || undefined, sortOrder } })
    } else {
      createMut.mutate({ code: form.code, name: form.name, description: form.description || undefined, redmineProjectKey: form.redmineProjectKey || undefined, webexRoomId: form.webexRoomId || undefined, sortOrder })
    }
  }

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subPanel) return
    if (editingSub) {
      updateSubMut.mutate({ systemId: subPanel.id, subId: editingSub.id, data: { name: subForm.name, description: subForm.description || undefined } })
    } else {
      createSubMut.mutate({ systemId: subPanel.id, data: { code: subForm.code, name: subForm.name, description: subForm.description || undefined } })
    }
  }

  const toggleActive = (s: System) => {
    updateMut.mutate({ id: s.id, data: { name: s.name, active: !s.active } })
  }

  const toggleSubActive = (sub: SubSystem) => {
    if (!subPanel) return
    updateSubMut.mutate({ systemId: subPanel.id, subId: sub.id, data: { name: sub.name, active: !sub.active } })
  }

  const assignedUserIds = new Set(managers.map(m => m.userId))
  const availableUsers = users.filter(u => !assignedUserIds.has(u.id))

  return (
    <div className="page-wrap">
      <PageHeader
        title="시스템 관리"
        actions={<Button onClick={() => { reset(); setShowForm(true) }} variant="filled">+ 시스템 등록</Button>}
      />

      {showForm && (
        <Panel style={{ display: 'block', padding: 24, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editing ? '시스템 수정' : '시스템 등록'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={s.grid}>
              {!editing && (
                <>
                  <label style={s.label}>시스템 코드 *</label>
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    required placeholder="예: SYS003" />
                </>
              )}
              <label style={s.label}>시스템명 *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="시스템 이름" />
              <label style={s.label}>설명</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="시스템 설명" />
              <label style={s.label}>레드마인 키</label>
              <Input value={form.redmineProjectKey} onChange={e => setForm(f => ({ ...f, redmineProjectKey: e.target.value }))}
                placeholder="예: retail-platform" />
              <label style={s.label}>Webex Room ID</label>
              <Input value={form.webexRoomId} onChange={e => setForm(f => ({ ...f, webexRoomId: e.target.value }))}
                placeholder="Webex 스페이스 Room ID" />
              <label style={s.label}>노출 순서</label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                placeholder="숫자가 낮을수록 먼저 표시 (기본 0)" style={{ width: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={reset} variant="outlined">취소</Button>
              <Button type="submit" variant="filled">{editing ? '수정' : '등록'}</Button>
            </div>
          </form>
        </Panel>
      )}

      {isLoading ? <Loading /> : (
        <Panel style={{ display: 'block', marginBottom: 16 }}>
          <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                {['순서', '코드', '시스템명', '설명', '상태', '등록일', ''].map(h => (
                  <TableHead key={h} style={{ textAlign: 'left' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.length === 0 ? (
                <TableRow><TableCell colSpan={7}><EmptyState title="등록된 시스템이 없습니다." /></TableCell></TableRow>
              ) : systems.map(sys => (
                <TableRow key={sys.id}>
                  <TableCell style={{ color: 'var(--c-text-muted)', textAlign: 'center' }}>{sys.sortOrder}</TableCell>
                  <TableCell style={{ fontWeight: 600, color: 'var(--c-action)' }}>{sys.code}</TableCell>
                  <TableCell style={{ fontWeight: 500 }}>{sys.name}</TableCell>
                  <TableCell style={{ color: 'var(--c-text-sub)' }}>{sys.description ?? '-'}</TableCell>
                  <TableCell>
                    <Switch size="sm" checked={sys.active} onCheckedChange={() => toggleActive(sys)}
                      label={<span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{sys.active ? '운영중' : '비활성'}</span>} />
                  </TableCell>
                  <TableCell style={{ color: 'var(--c-text-muted)' }}>
                    {new Date(sys.createdAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    <Button variant="outlined" size="sm" onClick={() => { setSubPanel(sys); resetSubForm() }} style={{ color: 'var(--c-tag-teal-t)', borderColor: 'var(--c-tag-teal-t)' }}>하위시스템</Button>
                    <Button variant="outlined" size="sm" onClick={() => setManagerPanel(sys)} style={{ color: 'var(--c-tag-pri-t)', borderColor: 'var(--c-tag-pri-t)' }}>담당자</Button>
                    <Button variant="outlined" size="sm" onClick={() => openEdit(sys)}>수정</Button>
                    <Button variant="danger" size="sm" onClick={() => { if (confirm(`[${sys.code}] ${sys.name}을 삭제하시겠습니까?`)) deleteMut.mutate(sys.id) }}>삭제</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Panel>
      )}

      {/* 하위시스템 패널 */}
      {subPanel && (
        <Modal open onClose={() => { setSubPanel(null); resetSubForm() }} width={560}>
            {/* 헤더에 추가 버튼이 있어 커스텀 헤더 유지 — SDK X 버튼과 겹치지 않도록 우측 여백 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingRight: 32 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{subPanel.name} 하위시스템 관리</h3>
              <Button variant="filled" size="sm" onClick={() => { setShowSubForm(true); setEditingSub(null); setSubForm(emptySubForm()) }}>+ 추가</Button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-text-muted)' }}>프론트엔드, 백엔드, API 등 구성 컴포넌트를 관리합니다.</p>

            {showSubForm && (
              <Panel style={{ display: 'block', background: 'var(--c-bg)', marginBottom: 16 }}>
              <form onSubmit={handleSubSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px 12px', alignItems: 'center', marginBottom: 10 }}>
                  {!editingSub && (
                    <>
                      <label style={s.label}>코드 *</label>
                      <Input value={subForm.code} onChange={e => setSubForm(f => ({ ...f, code: e.target.value }))}
                        required placeholder="예: FRONTEND" />
                    </>
                  )}
                  <label style={s.label}>이름 *</label>
                  <Input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                    required placeholder="하위시스템 이름" />
                  <label style={s.label}>설명</label>
                  <Input value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="설명" />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button type="button" onClick={resetSubForm} variant="outlined" size="sm">취소</Button>
                  <Button type="submit" variant="filled" size="sm">{editingSub ? '수정' : '등록'}</Button>
                </div>
              </form>
              </Panel>
            )}

            {subSystems.length === 0 ? (
              <EmptyState title="등록된 하위시스템이 없습니다." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {['코드', '이름', '설명', '상태', ''].map(h => (
                      <TableHead key={h} style={{ textAlign: 'left' }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subSystems.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell style={{ fontWeight: 600, color: 'var(--c-action)', fontSize: 12 }}>{sub.code}</TableCell>
                      <TableCell style={{ fontSize: 12 }}>{sub.name}</TableCell>
                      <TableCell style={{ color: 'var(--c-text-sub)', fontSize: 12 }}>{sub.description ?? '-'}</TableCell>
                      <TableCell>
                        <Switch size="sm" checked={sub.active} onCheckedChange={() => toggleSubActive(sub)}
                          label={<span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{sub.active ? '활성' : '비활성'}</span>} />
                      </TableCell>
                      <TableCell>
                        <Button variant="outlined" size="sm" onClick={() => { setServerSubPanel(sub); setNewServerName('') }} style={{ color: 'var(--c-tag-warn-t)', borderColor: 'var(--c-tag-warn-t)' }}>서버</Button>
                        <Button variant="outlined" size="sm" onClick={() => openSubEdit(sub)}>수정</Button>
                        <Button variant="danger" size="sm" onClick={() => { if (confirm(`[${sub.code}] ${sub.name}을 삭제하시겠습니까?`)) deleteSubMut.mutate({ systemId: subPanel.id, subId: sub.id }) }}>삭제</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="outlined" onClick={() => { setSubPanel(null); resetSubForm() }}>닫기</Button>
            </div>
        </Modal>
      )}

      {/* 서버 패널 */}
      {serverSubPanel && subPanel && (
        <Modal open onClose={() => setServerSubPanel(null)} title={`${serverSubPanel.name} 배포 서버 관리`} width={460}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-text-muted)' }}>배포 승인 후 단계별로 완료 처리할 서버 목록입니다.</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Input
                value={newServerName}
                onChange={e => setNewServerName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newServerName.trim()) addServerMut.mutate({ systemId: subPanel.id, subSystemId: serverSubPanel.id, serverName: newServerName.trim() }) }}
                placeholder="서버명 입력 (예: 1번서버)"
                style={{ flex: 1 }}
              />
              <Button variant="filled"
                onClick={() => { if (newServerName.trim()) addServerMut.mutate({ systemId: subPanel.id, subSystemId: serverSubPanel.id, serverName: newServerName.trim() }) }}
                disabled={!newServerName.trim()}>추가</Button>
            </div>

            {servers.length === 0 ? (
              <EmptyState title="등록된 서버가 없습니다." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {servers.map((sv, idx) => (
                  <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--c-bg)', borderRadius: 6, border: '1px solid var(--c-border-in)' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--c-action)', color: 'var(--rsp-color-text-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{sv.serverName}</span>
                    <Button variant="danger" size="sm" onClick={() => deleteServerMut.mutate({ systemId: subPanel.id, subSystemId: serverSubPanel.id, serverId: sv.id })}>삭제</Button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <Button variant="outlined" onClick={() => setServerSubPanel(null)}>닫기</Button>
            </div>
        </Modal>
      )}

      {/* 담당자 패널 */}
      {managerPanel && (
        <Modal open onClose={() => { setManagerPanel(null); setSelectedUserId(0) }} title={`${managerPanel.name} 담당자 관리`} width={460}>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--c-text-muted)' }}>시스템 담당자는 배포 요청 제출/완료 권한을 갖습니다.</p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>현재 담당자</div>
              {managers.length === 0 ? (
                <EmptyState title="등록된 담당자가 없습니다." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {managers.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, fontSize: 13 }}>
                      <span>{m.username}</span>
                      <Button variant="danger" size="sm" onClick={() => removeManagerMut.mutate({ systemId: managerPanel.id, userId: m.userId })}>제거</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {availableUsers.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <Select value={selectedUserId} onValueChange={v => setSelectedUserId(Number(v))}
                  style={{ flex: 1 }}>
                  <option value={0}>담당자 선택</option>
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </Select>
                <Button variant="filled"
                  onClick={() => { if (selectedUserId) addManagerMut.mutate({ systemId: managerPanel.id, userId: selectedUserId }) }}
                  disabled={!selectedUserId}>추가</Button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => { setManagerPanel(null); setSelectedUserId(0) }}>닫기</Button>
            </div>
        </Modal>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  btn: { padding: '8px 16px', background: 'var(--c-action)', color: 'var(--rsp-color-text-on-primary)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  grid: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)' },
}
