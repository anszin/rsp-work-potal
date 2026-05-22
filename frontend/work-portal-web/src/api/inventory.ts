import client from './client'

export type ItemType = 'CONTRACT' | 'PROPOSAL'
export type ItemStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD'

export interface InventoryItem {
  id: number
  type: ItemType
  name: string
  client: string | null
  amount: number | null
  status: ItemStatus
  startDate: string | null
  endDate: string | null
  note: string | null
  createdAt: string
}

export interface SaveInventoryRequest {
  type: ItemType
  name: string
  client?: string
  amount?: number
  status?: ItemStatus
  startDate?: string
  endDate?: string
  note?: string
}

export const inventoryApi = {
  list: (type?: ItemType) =>
    client.get<InventoryItem[]>('/api/inventory', { params: type ? { type } : {} }),
  get: (id: number) => client.get<InventoryItem>(`/api/inventory/${id}`),
  create: (data: SaveInventoryRequest) => client.post<InventoryItem>('/api/inventory', data),
  update: (id: number, data: SaveInventoryRequest) =>
    client.put<InventoryItem>(`/api/inventory/${id}`, data),
  delete: (id: number) => client.delete(`/api/inventory/${id}`),
}
