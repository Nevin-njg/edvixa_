export type TeacherStudentEngagement = 'upcoming' | 'completed' | 'inactive'

export type TeacherStudentListItem = {
  id: string
  name: string
  email: string
  avatar: string | null
  phone: string | null
  grade: string | null
  subjects: Array<{ id: string; name: string }>
  engagement: TeacherStudentEngagement
  sessions: {
    total: number
    upcoming: number
    completed: number
    cancelled: number
    nextAt: string | null
    lastAt: string | null
  }
  practice: {
    sessions: number
    averageScore: number
    latestAt: string | null
  }
  weakTopics: Array<{ name: string; mastery: number }>
  note: {
    text: string
    tags: string[]
    updatedAt: string | null
  }
}

export type TeacherStudentListData = {
  summary: {
    totalStudents: number
    activeStudents: number
    upcomingLessons: number
    completedLessons: number
    averagePracticeScore: number
  }
  filters: {
    grades: string[]
    subjects: Array<{ id: string; name: string }>
  }
  items: TeacherStudentListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type TeacherStudentDetails = {
  student: {
    id: string
    name: string
    email: string
    avatar: string | null
    phone: string | null
    grade: string | null
    subjects: Array<{ id: string; name: string }>
  }
  progress: {
    level: number
    xp: number
    streak: number
    averageScore: number
    accuracy: number
    totalTests: number
    practiceSessions: number
    practiceMinutes: number
    learningGoal: string
    topicMastery: Array<{
      id: string
      name: string
      mastery: number
      attempts: number
      correct: number
      wrong: number
      lastAttemptAt: string | null
    }>
  }
  sessionSummary: {
    total: number
    upcoming: number
    completed: number
    cancelled: number
    totalPaid: number
  }
  sessions: Array<{
    id: string
    subject: string
    chapter: string
    scheduledAt: string
    endAt: string
    durationMinutes: number
    timezone: string
    status: string
    paymentStatus: string
    meetingLink: string | null
    studentNote: string
    teacherNote: string
    doubtTitle: string
    amount: number
  }>
  practiceHistory: Array<{
    id: string
    subject: string
    accuracy: number
    score: number
    questionCount: number
    timeTakenSeconds: number
    completedAt: string | null
  }>
  doubts: Array<{
    id: string
    subject: string
    chapter: string
    title: string
    description: string
    status: string
    votes: number
    comments: number
    createdAt: string
  }>
  privateNote: {
    text: string
    tags: string[]
    updatedAt: string | null
  }
}
