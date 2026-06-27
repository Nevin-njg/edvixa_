export type EarningsPeriod = '7d' | '30d' | '90d' | 'year' | 'all'

export type EarningsPaymentStatus =
  | 'all'
  | 'paid'
  | 'pending'
  | 'failed'
  | 'refunded'

export type EarningsPayoutStatus =
  | 'all'
  | 'pending'
  | 'approved'
  | 'paid'
  | 'failed'

export type TeacherEarningsTransaction = {
  id: string
  bookingId: string
  student: {
    id: string
    name: string
    email: string
    avatar: string | null
  }
  subject: string
  topicName: string
  sessionDate: string | null
  sessionStatus: string
  amount: number
  totalAmount: number
  platformFee: number
  platformCommission: number
  totalDeduction: number
  teacherEarning: number
  currency: string
  paymentStatus: string
  payoutStatus: string
  paymentMethod: string
  paymentGateway: string
  gatewayPaymentId: string | null
  receiptUrl: string | null
  paidAt: string | null
  failedAt: string | null
  failureReason: string | null
  refundStatus: string
  refundAmount: number
  refundedAt: string | null
  refundReason: string | null
  createdAt: string
}

export type TeacherEarningsSummary = {
  totalEarnings: number
  thisMonthEarnings: number
  pendingPayout: number
  paidOut: number
  platformDeductions: number
  completedSessionIncome: number
  refunds: number
  paidTransactions: number
  pendingTransactions: number
  completedSessions: number
  currency: string
}

export type TeacherEarningsData = {
  summary: TeacherEarningsSummary
  chart: Array<{
    key: string
    label: string
    value: number
  }>
  transactions: TeacherEarningsTransaction[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    period: EarningsPeriod
    status: EarningsPaymentStatus
    payoutStatus: EarningsPayoutStatus
    search: string
  }
  generatedAt: string
}

export type TeacherEarningsStatementData = {
  summary: TeacherEarningsSummary
  transactions: TeacherEarningsTransaction[]
  generatedAt: string
}
