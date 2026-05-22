import client from './client'

// Meeting Minutes
export interface MeetingMinute {
  id: number
  title: string
  meetingDate: string
  location: string | null
  attendees: string | null
  content: string | null
  actionItems: string | null
  author: string
  createdAt: string
}

export interface SaveMeetingRequest {
  title: string
  meetingDate: string
  location?: string
  attendees?: string
  content?: string
  actionItems?: string
}

// Weekly Reports
export interface WeeklyReport {
  id: number
  title: string
  weekStart: string
  weekEnd: string
  accomplishments: string | null
  plans: string | null
  issues: string | null
  author: string
  createdAt: string
}

export interface SaveWeeklyRequest {
  title: string
  weekStart: string
  weekEnd: string
  accomplishments?: string
  plans?: string
  issues?: string
}

// Daily Check Reports
export type CheckStatus = 'NORMAL' | 'WARNING' | 'CRITICAL'

export interface DailyCheckReport {
  id: number
  systemId: number
  systemName: string
  checkDate: string
  status: CheckStatus
  note: string | null
  reporter: string
  createdAt: string
}

export interface SaveDailyCheckRequest {
  systemId: number
  checkDate: string
  status: CheckStatus
  note?: string
}

export const meetingApi = {
  list: () => client.get<MeetingMinute[]>('/api/meeting-minutes'),
  get: (id: number) => client.get<MeetingMinute>(`/api/meeting-minutes/${id}`),
  create: (data: SaveMeetingRequest) => client.post<MeetingMinute>('/api/meeting-minutes', data),
  update: (id: number, data: SaveMeetingRequest) =>
    client.put<MeetingMinute>(`/api/meeting-minutes/${id}`, data),
  delete: (id: number) => client.delete(`/api/meeting-minutes/${id}`),
}

export const weeklyApi = {
  list: () => client.get<WeeklyReport[]>('/api/weekly-reports'),
  get: (id: number) => client.get<WeeklyReport>(`/api/weekly-reports/${id}`),
  create: (data: SaveWeeklyRequest) => client.post<WeeklyReport>('/api/weekly-reports', data),
  update: (id: number, data: SaveWeeklyRequest) =>
    client.put<WeeklyReport>(`/api/weekly-reports/${id}`, data),
  delete: (id: number) => client.delete(`/api/weekly-reports/${id}`),
}

export const dailyCheckApi = {
  list: (date?: string) =>
    client.get<DailyCheckReport[]>('/api/daily-checks', { params: date ? { date } : {} }),
  get: (id: number) => client.get<DailyCheckReport>(`/api/daily-checks/${id}`),
  create: (data: SaveDailyCheckRequest) => client.post<DailyCheckReport>('/api/daily-checks', data),
  update: (id: number, data: SaveDailyCheckRequest) =>
    client.put<DailyCheckReport>(`/api/daily-checks/${id}`, data),
  delete: (id: number) => client.delete(`/api/daily-checks/${id}`),
}
