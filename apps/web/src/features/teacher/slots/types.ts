export type SlotStatus = 'available' | 'booked' | 'blocked' | 'cancelled'

export type SlotSubject = {
  id: string
  name: string
}

export type TeacherAvailabilitySlot = {
  id: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  durationMinutes: number
  status: SlotStatus
  isBooked: boolean
  isBlocked: boolean
  isRecurring: boolean
  subjects: SlotSubject[]
  booking: {
    id: string
    status: string
    paymentStatus: string
    topicName: string
  } | null
  createdAt: string
  updatedAt: string
}

export type TeacherAvailabilityData = {
  range: {
    start: string
    end: string
  }
  timezone: string
  summary: {
    available: number
    booked: number
    blocked: number
    totalHours: number
  }
  slots: TeacherAvailabilitySlot[]
}

export type TeacherSlotProfile = {
  profile: {
    isApproved: boolean
    timezone: string
    subjects: SlotSubject[]
  }
}
