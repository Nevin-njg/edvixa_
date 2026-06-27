export type TeacherProfileSubject = {
  id: string
  name: string
  slug: string
  gradeLevels: string[]
}

export type TeacherProfileDocument = {
  id?: string
  title: string
  fileUrl: string
  fileType: string
  uploadedAt?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export type TeacherApplicationStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'

export type TeacherProfileData = {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    avatar: string | null
    isEmailVerified: boolean
    createdAt: string
  }
  profile: {
    bio: string
    teachingApproach: string
    qualification: string
    experienceYears: number
    hourlyRate: number
    timezone: string
    subjects: TeacherProfileSubject[]
    gradeLevels: string[]
    languages: string[]
    documents: TeacherProfileDocument[]
    applicationStatus: TeacherApplicationStatus
    approvalStatus: 'pending' | 'approved' | 'rejected'
    isApproved: boolean
    rejectionReason: string | null
    submittedAt: string | null
    approvedAt: string | null
    profileCompletedPercent: number
    rating: number
    totalReviews: number
    totalSessionsCompleted: number
    totalStudentsTaught: number
  }
  availableSubjects: TeacherProfileSubject[]
  options: {
    gradeLevels: string[]
    languages: string[]
    timezones: string[]
  }
}

export type TeacherProfileDraft = {
  name: string
  phone: string
  avatar: string
  bio: string
  teachingApproach: string
  qualification: string
  experienceYears: string
  hourlyRate: string
  timezone: string
  subjects: string[]
  gradeLevels: string[]
  languages: string[]
  documents: TeacherProfileDocument[]
}
