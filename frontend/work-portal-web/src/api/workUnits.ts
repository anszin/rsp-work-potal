import client from './client'

export type WorkUnitType = 'PROJECT' | 'OPERATION' | 'OTHER'
export type WorkUnitStatus = 'IN_PROGRESS' | 'ON_HOLD' | 'DONE'

export const WORK_UNIT_TYPE_LABELS: Record<WorkUnitType, string> = {
  PROJECT:   '프로젝트',
  OPERATION: '운영/유지보수',
  OTHER:     '기타',
}

export const WORK_UNIT_STATUS_LABELS: Record<WorkUnitStatus, string> = {
  IN_PROGRESS: '진행중',
  ON_HOLD:     '보류',
  DONE:        '완료',
}

export const WORK_UNIT_STATUS_COLOR: Record<WorkUnitStatus, string> = {
  IN_PROGRESS: '#3182ce',
  ON_HOLD:     '#c05621',
  DONE:        '#38a169',
}

export interface WorkUnit {
  id: number
  keyTaskId: number
  title: string
  type: WorkUnitType
  status: WorkUnitStatus
  description: string | null
  createdAt: string
  updatedAt: string | null
}

export interface SaveWorkUnitRequest {
  keyTaskId: number
  title: string
  type?: WorkUnitType
  status?: WorkUnitStatus
  description?: string
}

export const workUnitApi = {
  listAll: () =>
    client.get<WorkUnit[]>('/work-units').then(r => r.data),
  listByKeyTask: (keyTaskId: number) =>
    client.get<WorkUnit[]>('/work-units', { params: { keyTaskId } }).then(r => r.data),
  create: (data: SaveWorkUnitRequest) =>
    client.post<WorkUnit>('/work-units', data).then(r => r.data),
  update: (id: number, data: SaveWorkUnitRequest) =>
    client.put<WorkUnit>(`/work-units/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    client.delete(`/work-units/${id}`),
}
