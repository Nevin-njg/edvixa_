export type TeacherSessionStatus =
  | 'accepted'
  | 'upcoming'
  | 'rescheduled'
  | 'completed'
  | 'cancelled'
  | 'rejected'

export type TeacherSessionFilter =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'completed'
  | 'cancelled'

export type TeacherSessionItem = {
  id: string
  student: {
    id: string
    name: string
    email: string
    avatar: string | null
    phone: string | null
    grade: string | null
  }
  subject: {
    id: string
    name: string
  }
  topicName: string
  doubt: {
    id: string | null
    title: string
    description: string
    status: string
    votes: number
    comments: number
  } | null
  studentNote: string
  teacherNote: string
  scheduledAt: string
  endAt: string
  durationMinutes: number
  timezone: string
  status: TeacherSessionStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  meetingLink: string | null
  meetingProvider: string | null
  createdAt: string
  updatedAt: string
  payment: {
    feeId: string
    amount: number
    platformFee: number
    totalAmount: number
    currency: string
    status: string
    method: string
    gateway: string
    refundStatus: string
    refundAmount: number
  } | null
}

export type TeacherSessionListData = {
  profile: {
    id: string
    timezone: string
  }
  summary: {
    today: number
    live: number
    upcoming: number
    completed: number
    cancelled: number
  }
  items: TeacherSessionItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
