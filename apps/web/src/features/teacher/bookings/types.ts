export type TeacherBookingStatus =
  | 'pending'
  | 'accepted'
  | 'upcoming'
  | 'rescheduled'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type TeacherBookingFilter =
  | 'all'
  | 'pending'
  | 'upcoming'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type TeacherBookingItem = {
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
  status: TeacherBookingStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  meetingLink: string | null
  createdAt: string
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

export type TeacherAvailableSlot = {
  id: string
  date: string
  startTime: string
  endTime: string
  scheduledAt: string
  endAt: string
  timezone: string
}

export type TeacherBookingListData = {
  profile: {
    id: string
    timezone: string
  }
  summary: {
    total: number
    pending: number
    upcoming: number
    completed: number
    rejected: number
    cancelled: number
  }
  items: TeacherBookingItem[]
  availableSlots: TeacherAvailableSlot[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
