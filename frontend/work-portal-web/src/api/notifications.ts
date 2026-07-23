import client from './client'

export interface SendNotificationRequest {
  target: 'ALL' | 'SELECTED'
  usernames?: string[]
  message: string
  senderName?: string
  useRoom?: boolean
}

export interface SendNotificationResponse {
  sent: number
  message: string
}

export const notificationApi = {
  send: (data: SendNotificationRequest) =>
    client.post<SendNotificationResponse>('/notifications/send', data),
}
