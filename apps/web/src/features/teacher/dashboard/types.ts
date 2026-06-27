export type TeacherDashboardAvailability = {
  id: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  durationMinutes: number
  subjects: Array<{ id: string; name: string }>
}

export type TeacherDashboardSession = {
  id: string
  student: {
    id: string
    name: string
    avatar: string | null
  }
  subject: {
    id: string
    name: string
  }
  topicName: string
  studentGrade: string | null
  scheduledAt: string
  endAt: string
  timezone: string
  status: string
  paymentStatus: string
  meetingLink: string | null
}

export type TeacherDashboardData = {
  applicationStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  teacher: {
    id: string
    name: string
    avatar: string | null
  }
  profile: {
    id: string
    isApproved: boolean
    profileCompletedPercent: number
    rating: number
    totalReviews: number
    averageResponseTimeMinutes: number
    subjects: Array<{ id: string; name: string; slug: string }>
    rejectionReason: string | null
  }
  summary: {
    todaySessions: number
    upcomingSessions: number
    pendingRequests: number
    activeStudents: number
    completedSessions: number
    availableSlots: number
    rating: number
    totalReviews: number
    totalEarnings: number
    thisMonthEarnings: number
    pendingPayout: number
    earningsChangePercent: number
  }
  todaySessions: TeacherDashboardSession[]
  upcomingSessions: TeacherDashboardSession[]
  upcomingAvailability: TeacherDashboardAvailability[]
  pendingRequestItems: TeacherDashboardSession[]
  weeklyEarnings: Array<{
    date: string
    label: string
    amount: number
  }>
  popularDoubts: Array<{
    id: string
    gradeLevel: string
    subjectName: string
    topicName: string
    title: string
    status: string
    voteCount: number
    commentCount: number
    createdAt: string
  }>
  recentReviews: Array<{
    id: string
    studentName: string
    studentAvatar: string | null
    rating: number
    review: string
    createdAt: string
  }>
}
