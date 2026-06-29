import client from './client'

export type FinanceCategory = 'REVENUE' | 'EXPENSE'

export interface FinanceRecord {
  id: number
  year: number
  month: number
  category: FinanceCategory
  itemName: string
  amount: number
  note: string | null
  createdAt: string
}

export interface MonthlySummary {
  month: number
  revenue: number
  expense: number
  profit: number
}

export interface SaveFinanceRequest {
  year: number
  month: number
  category: FinanceCategory
  itemName: string
  amount: number
  note?: string
}

export const financeApi = {
  list: (year: number, month?: number) =>
    client.get<FinanceRecord[]>('/finance', { params: month ? { year, month } : { year } }),
  summary: (year: number) =>
    client.get<MonthlySummary[]>('/finance/summary', { params: { year } }),
  years: () => client.get<number[]>('/finance/years'),
  create: (data: SaveFinanceRequest) => client.post<FinanceRecord>('/finance', data),
  update: (id: number, data: SaveFinanceRequest) =>
    client.put<FinanceRecord>(`/finance/${id}`, data),
  delete: (id: number) => client.delete(`/finance/${id}`),
}
