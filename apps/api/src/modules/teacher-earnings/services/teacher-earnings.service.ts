import { Types } from 'mongoose'

import { AppError } from '../../../shared/errors/app-error.js'
import { FeeModel } from '../../fees/models/fee.model.js'
import { TeacherProfileModel } from '../../teachers/models/teacher-profile.model.js'

type EarningsPeriod = '7d' | '30d' | '90d' | 'year' | 'all'
type PaymentStatusFilter = 'all' | 'paid' | 'pending' | 'failed' | 'refunded'
type PayoutStatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'failed'

type ListInput = {
  period?: EarningsPeriod
  status?: PaymentStatusFilter
  payoutStatus?: PayoutStatusFilter
  search?: string
  page?: string | number
  limit?: string | number
}

type UserReference = {
  _id: Types.ObjectId
  name: string
  email?: string
  avatar?: string | null
}

type SubjectReference = {
  _id: Types.ObjectId
  name: string
}

type BookingReference = {
  _id: Types.ObjectId
  topicName?: string
  subjectId?: SubjectReference | Types.ObjectId | null
  scheduledAt?: Date | null
  completedAt?: Date | null
  status?: string
}

type FeeLean = {
  _id: Types.ObjectId
  studentId: UserReference | Types.ObjectId
  bookingId: BookingReference | Types.ObjectId
  amount?: number
  platformFee?: number
  platformCommission?: number
  teacherEarning?: number
  totalAmount?: number
  currency?: string
  status?: string
  paymentMethod?: string
  paymentGateway?: string
  gatewayPaymentId?: string | null
  receiptUrl?: string | null
  paidAt?: Date | null
  failedAt?: Date | null
  failureReason?: string | null
  refundStatus?: string
  refundAmount?: number
  refundedAt?: Date | null
  refundReason?: string | null
  payoutStatus?: string
  createdAt: Date
}

function numberValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function getUser(value: FeeLean['studentId']): UserReference | null {
  if (value && typeof value === 'object' && 'name' in value) {
    return value as UserReference
  }

  return null
}

function getBooking(value: FeeLean['bookingId']): BookingReference | null {
  if (value && typeof value === 'object' && '_id' in value) {
    return value as BookingReference
  }

  return null
}

function getSubject(
  value: BookingReference['subjectId'],
): SubjectReference | null {
  if (value && typeof value === 'object' && 'name' in value) {
    return value as SubjectReference
  }

  return null
}

function feeDate(fee: FeeLean): Date {
  return fee.paidAt ?? fee.createdAt
}

function startOfPeriod(period: EarningsPeriod): Date | null {
  const now = new Date()

  if (period === 'all') return null

  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1)
  }

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const start = new Date(now)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return start
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function serializeFee(fee: FeeLean) {
  const user = getUser(fee.studentId)
  const booking = getBooking(fee.bookingId)
  const subject = getSubject(booking?.subjectId)
  const platformFee = numberValue(fee.platformFee)
  const platformCommission = numberValue(fee.platformCommission)
  const teacherEarning = numberValue(fee.teacherEarning)

  return {
    id: String(fee._id),
    bookingId: String(booking?._id ?? fee.bookingId),
    student: {
      id: String(user?._id ?? fee.studentId),
      name: user?.name ?? 'Student',
      email: user?.email ?? '',
      avatar: user?.avatar ?? null,
    },
    subject: subject?.name ?? 'Subject',
    topicName: booking?.topicName ?? 'Teaching session',
    sessionDate: booking?.scheduledAt?.toISOString() ?? null,
    sessionStatus: booking?.status ?? 'unknown',
    amount: numberValue(fee.amount),
    totalAmount: numberValue(fee.totalAmount),
    platformFee,
    platformCommission,
    totalDeduction: roundMoney(platformFee + platformCommission),
    teacherEarning,
    currency: fee.currency ?? 'INR',
    paymentStatus: fee.status ?? 'pending',
    payoutStatus: fee.payoutStatus ?? 'pending',
    paymentMethod: fee.paymentMethod ?? 'unknown',
    paymentGateway: fee.paymentGateway ?? 'demo',
    gatewayPaymentId: fee.gatewayPaymentId ?? null,
    receiptUrl: fee.receiptUrl ?? null,
    paidAt: fee.paidAt?.toISOString() ?? null,
    failedAt: fee.failedAt?.toISOString() ?? null,
    failureReason: fee.failureReason ?? null,
    refundStatus: fee.refundStatus ?? 'none',
    refundAmount: numberValue(fee.refundAmount),
    refundedAt: fee.refundedAt?.toISOString() ?? null,
    refundReason: fee.refundReason ?? null,
    createdAt: fee.createdAt.toISOString(),
  }
}

class TeacherEarningsService {
  private async getApprovedTeacher(userId: string) {
    const profile = await TeacherProfileModel.findOne({
      userId,
      isApproved: true,
      approvalStatus: 'approved',
    })
      .select('_id userId')
      .lean()

    if (!profile) {
      throw new AppError(
        403,
        'Your teacher profile must be approved before viewing earnings',
        'TEACHER_NOT_APPROVED',
      )
    }

    return profile
  }

  private async loadFees(userId: string): Promise<FeeLean[]> {
    return (await FeeModel.find({ teacherId: userId })
      .populate({
        path: 'studentId',
        select: 'name email avatar',
      })
      .populate({
        path: 'bookingId',
        select: 'topicName subjectId scheduledAt completedAt status',
        populate: {
          path: 'subjectId',
          select: 'name',
        },
      })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean()) as unknown as FeeLean[]
  }

  private filterFees(fees: FeeLean[], input: ListInput): FeeLean[] {
    const period = input.period ?? '30d'
    const status = input.status ?? 'all'
    const payoutStatus = input.payoutStatus ?? 'all'
    const search = (input.search ?? '').trim().toLowerCase()
    const start = startOfPeriod(period)

    return fees.filter((fee) => {
      if (start && feeDate(fee).getTime() < start.getTime()) return false

      if (status !== 'all' && fee.status !== status) return false

      if (
        payoutStatus !== 'all' &&
        (fee.payoutStatus ?? 'pending') !== payoutStatus
      ) {
        return false
      }

      if (!search) return true

      const user = getUser(fee.studentId)
      const booking = getBooking(fee.bookingId)
      const subject = getSubject(booking?.subjectId)
      const haystack = [
        user?.name,
        user?.email,
        booking?.topicName,
        subject?.name,
        fee.gatewayPaymentId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(search)
    })
  }

  private buildSummary(fees: FeeLean[]) {
    const now = new Date()
    const currentMonth = monthStart(now)
    const paidFees = fees.filter((fee) => fee.status === 'paid')

    const totalEarnings = paidFees.reduce(
      (sum, fee) => sum + numberValue(fee.teacherEarning),
      0,
    )

    const thisMonthEarnings = paidFees
      .filter((fee) => feeDate(fee).getTime() >= currentMonth.getTime())
      .reduce((sum, fee) => sum + numberValue(fee.teacherEarning), 0)

    const pendingPayout = paidFees
      .filter((fee) =>
        ['pending', 'approved'].includes(fee.payoutStatus ?? 'pending'),
      )
      .reduce((sum, fee) => sum + numberValue(fee.teacherEarning), 0)

    const paidOut = paidFees
      .filter((fee) => fee.payoutStatus === 'paid')
      .reduce((sum, fee) => sum + numberValue(fee.teacherEarning), 0)

    const platformDeductions = paidFees.reduce(
      (sum, fee) =>
        sum +
        numberValue(fee.platformFee) +
        numberValue(fee.platformCommission),
      0,
    )

    const completedSessionIncome = paidFees
      .filter((fee) => getBooking(fee.bookingId)?.status === 'completed')
      .reduce((sum, fee) => sum + numberValue(fee.teacherEarning), 0)

    const refunds = fees.reduce(
      (sum, fee) => sum + numberValue(fee.refundAmount),
      0,
    )

    return {
      totalEarnings: roundMoney(totalEarnings),
      thisMonthEarnings: roundMoney(thisMonthEarnings),
      pendingPayout: roundMoney(pendingPayout),
      paidOut: roundMoney(paidOut),
      platformDeductions: roundMoney(platformDeductions),
      completedSessionIncome: roundMoney(completedSessionIncome),
      refunds: roundMoney(refunds),
      paidTransactions: paidFees.length,
      pendingTransactions: fees.filter((fee) => fee.status === 'pending').length,
      completedSessions: paidFees.filter(
        (fee) => getBooking(fee.bookingId)?.status === 'completed',
      ).length,
      currency: fees[0]?.currency ?? 'INR',
    }
  }

  private buildChart(fees: FeeLean[]) {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return {
        key: monthKey(date),
        label: new Intl.DateTimeFormat('en-IN', {
          month: 'short',
        }).format(date),
        value: 0,
      }
    })

    const byKey = new Map(months.map((month) => [month.key, month]))

    for (const fee of fees) {
      if (fee.status !== 'paid') continue
      const bucket = byKey.get(monthKey(feeDate(fee)))
      if (bucket) {
        bucket.value += numberValue(fee.teacherEarning)
      }
    }

    return months.map((month) => ({
      ...month,
      value: roundMoney(month.value),
    }))
  }

  async list(userId: string, input: ListInput) {
    await this.getApprovedTeacher(userId)

    const fees = await this.loadFees(userId)
    const filtered = this.filterFees(fees, input)
    const page = Math.max(1, Number(input.page) || 1)
    const limit = Math.min(30, Math.max(5, Number(input.limit) || 10))
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const offset = (safePage - 1) * limit

    return {
      summary: this.buildSummary(fees),
      chart: this.buildChart(fees),
      transactions: filtered.slice(offset, offset + limit).map(serializeFee),
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
      filters: {
        period: input.period ?? '30d',
        status: input.status ?? 'all',
        payoutStatus: input.payoutStatus ?? 'all',
        search: input.search ?? '',
      },
      generatedAt: new Date().toISOString(),
    }
  }

  async statement(userId: string, input: ListInput) {
    await this.getApprovedTeacher(userId)

    const fees = await this.loadFees(userId)
    const filtered = this.filterFees(fees, input)

    return {
      summary: this.buildSummary(filtered),
      transactions: filtered.map(serializeFee),
      generatedAt: new Date().toISOString(),
    }
  }
}

export const teacherEarningsService = new TeacherEarningsService()
