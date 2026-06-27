import { Types } from 'mongoose'

import { AppError } from '../../../shared/errors/app-error.js'
import { AvailabilityModel } from '../../availability/models/availability.model.js'
import { BookingModel } from '../../bookings/models/booking.model.js'
import { DoubtPollModel } from '../../doubt-polls/models/doubt-poll.model.js'
import { FeeModel } from '../../fees/models/fee.model.js'
import { TeacherReviewModel } from '../../reviews/models/teacher-review.model.js'
import { TeacherProfileModel } from '../models/teacher-profile.model.js'

type NamedReference = {
  _id: Types.ObjectId
  name: string
  avatar?: string | null
}

type SubjectReference = {
  _id: Types.ObjectId
  name: string
  slug?: string
}

type TeacherProfileLean = {
  _id: Types.ObjectId
  userId: NamedReference | Types.ObjectId
  subjects?: Array<SubjectReference | Types.ObjectId>
  isApproved?: boolean
  approvalStatus?: string
  submittedAt?: Date | null
  rejectionReason?: string | null
  profileCompletedPercent?: number
  rating?: number
  totalReviews?: number
  totalSessionsCompleted?: number
  totalStudentsTaught?: number
  totalEarnings?: number
  pendingPayout?: number
  averageResponseTimeMinutes?: number
  timezone?: string
}

type BookingLean = {
  _id: Types.ObjectId
  studentId: NamedReference | Types.ObjectId
  subjectId: SubjectReference | Types.ObjectId
  topicName: string
  studentGrade?: string | null
  scheduledAt: Date
  endAt: Date
  timezone: string
  status: string
  paymentStatus: string
  meetingLink?: string | null
}

type DoubtLean = {
  _id: Types.ObjectId
  gradeLevel: string
  subjectName: string
  topicName: string
  title: string
  status: string
  voteCount: number
  commentCount: number
  createdAt: Date
}

type ReviewLean = {
  _id: Types.ObjectId
  studentId: NamedReference | Types.ObjectId
  rating: number
  review: string
  createdAt: Date
}

type FeeLean = {
  teacherEarning?: number
  paidAt?: Date | null
  createdAt: Date
  payoutStatus?: string
}

type AvailabilityLean = {
  _id: Types.ObjectId
  date: Date
  startTime: string
  endTime: string
  timezone: string
  subjectIds?: Array<SubjectReference | Types.ObjectId>
}

const ACTIVE_SESSION_STATUSES = ['accepted', 'upcoming', 'rescheduled'] as const

function getNamedReference(value: unknown): NamedReference | null {
  if (value && typeof value === 'object' && '_id' in value && 'name' in value) {
    return value as NamedReference
  }
  return null
}

function getSubjectReference(value: unknown): SubjectReference | null {
  if (value && typeof value === 'object' && '_id' in value && 'name' in value) {
    return value as SubjectReference
  }
  return null
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function previousMonthRange(date: Date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth() - 1, 1),
    end: new Date(date.getFullYear(), date.getMonth(), 1),
  }
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    return year && month && day ? `${year}-${month}-${day}` : toDateKey(date)
  } catch {
    return toDateKey(date)
  }
}

function applicationStatus(profile: TeacherProfileLean) {
  if (profile.isApproved) return 'approved'
  if (profile.approvalStatus === 'rejected') return 'rejected'
  if (profile.submittedAt) return 'pending'
  return 'draft'
}

function timeInMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

function serializeAvailability(slot: AvailabilityLean) {
  return {
    id: String(slot._id),
    date: slot.date.toISOString().slice(0, 10),
    startTime: slot.startTime,
    endTime: slot.endTime,
    timezone: slot.timezone,
    durationMinutes: Math.max(
      0,
      timeInMinutes(slot.endTime) - timeInMinutes(slot.startTime),
    ),
    subjects: (slot.subjectIds ?? [])
      .map(getSubjectReference)
      .filter((subject): subject is SubjectReference => Boolean(subject))
      .map((subject) => ({
        id: String(subject._id),
        name: subject.name,
      })),
  }
}

function serializeBooking(booking: BookingLean) {
  const student = getNamedReference(booking.studentId)
  const subject = getSubjectReference(booking.subjectId)

  return {
    id: String(booking._id),
    student: {
      id: String(student?._id ?? booking.studentId),
      name: student?.name ?? 'Student',
      avatar: student?.avatar ?? null,
    },
    subject: {
      id: String(subject?._id ?? booking.subjectId),
      name: subject?.name ?? 'Subject',
    },
    topicName: booking.topicName,
    studentGrade: booking.studentGrade ?? null,
    scheduledAt: booking.scheduledAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    timezone: booking.timezone,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    meetingLink: booking.meetingLink ?? null,
  }
}

class TeacherDashboardService {
  async getDashboard(userId: string) {
    const profile = (await TeacherProfileModel.findOne({ userId })
      .populate('userId', 'name avatar')
      .populate('subjects', 'name slug')
      .lean()) as unknown as TeacherProfileLean | null

    if (!profile) {
      throw new AppError(
        404,
        'Teacher profile not found',
        'TEACHER_PROFILE_NOT_FOUND',
      )
    }

    const teacherObjectId = new Types.ObjectId(userId)
    const now = new Date()
    const todayStart = startOfDay(now)
    const teacherTimeZone = profile.timezone || 'Asia/Kolkata'
    const teacherTodayKey = dateKeyInTimeZone(now, teacherTimeZone)
    const todayCandidateStart = new Date(now.getTime() - 36 * 60 * 60 * 1000)
    const todayCandidateEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000)
    const monthStart = startOfMonth(now)
    const previousMonth = previousMonthRange(now)
    const nextThirtyDays = new Date(now)
    nextThirtyDays.setDate(nextThirtyDays.getDate() + 30)

    const subjectIds = (profile.subjects ?? []).map((subject) => {
      const populated = getSubjectReference(subject)
      return populated ? populated._id : (subject as Types.ObjectId)
    })

    const [
      todaySessionCandidates,
      upcomingSessions,
      pendingRequests,
      pendingRequestItems,
      activeStudents,
      completedSessions,
      paidFees,
      availableSlots,
      upcomingAvailability,
      popularDoubts,
      recentReviews,
    ] = await Promise.all([
      BookingModel.find({
        teacherId: teacherObjectId,
        scheduledAt: { $gte: todayCandidateStart, $lte: todayCandidateEnd },
        status: { $in: [...ACTIVE_SESSION_STATUSES, 'completed'] },
        paymentStatus: 'paid',
      })
        .populate('studentId', 'name avatar')
        .populate('subjectId', 'name')
        .sort({ scheduledAt: 1 })
        .lean() as unknown as Promise<BookingLean[]>,
      BookingModel.find({
        teacherId: teacherObjectId,
        endAt: { $gte: now },
        status: { $in: ACTIVE_SESSION_STATUSES },
        paymentStatus: 'paid',
      })
        .populate('studentId', 'name avatar')
        .populate('subjectId', 'name')
        .sort({ scheduledAt: 1 })
        .limit(6)
        .lean() as unknown as Promise<BookingLean[]>,
      BookingModel.countDocuments({
        teacherId: teacherObjectId,
        status: 'pending',
      }),
      BookingModel.find({
        teacherId: teacherObjectId,
        status: 'pending',
      })
        .populate('studentId', 'name avatar')
        .populate('subjectId', 'name')
        .sort({ createdAt: -1 })
        .limit(4)
        .lean() as unknown as Promise<BookingLean[]>,
      BookingModel.distinct('studentId', {
        teacherId: teacherObjectId,
        paymentStatus: 'paid',
        status: { $in: [...ACTIVE_SESSION_STATUSES, 'completed'] },
      }),
      BookingModel.countDocuments({
        teacherId: teacherObjectId,
        status: 'completed',
      }),
      FeeModel.find({
        teacherId: teacherObjectId,
        status: 'paid',
      })
        .select('teacherEarning paidAt createdAt payoutStatus')
        .sort({ paidAt: -1, createdAt: -1 })
        .lean() as unknown as Promise<FeeLean[]>,
      AvailabilityModel.countDocuments({
        teacherId: teacherObjectId,
        date: { $gte: todayStart, $lte: nextThirtyDays },
        isBooked: false,
        isBlocked: false,
      }),
      AvailabilityModel.find({
        teacherId: teacherObjectId,
        date: { $gte: todayStart, $lte: nextThirtyDays },
        isBooked: false,
        isBlocked: false,
      })
        .populate('subjectIds', 'name slug')
        .sort({ date: 1, startTime: 1 })
        .limit(8)
        .lean() as unknown as Promise<AvailabilityLean[]>,
      subjectIds.length
        ? (DoubtPollModel.find({
            subjectId: { $in: subjectIds },
            status: { $in: ['open', 'will_cover'] },
          })
            .select(
              'gradeLevel subjectName topicName title status voteCount commentCount createdAt',
            )
            .sort({ voteCount: -1, commentCount: -1, createdAt: -1 })
            .limit(4)
            .lean() as unknown as Promise<DoubtLean[]>)
        : Promise.resolve([]),
      TeacherReviewModel.find({
        teacherId: teacherObjectId,
        isVisible: true,
      })
        .populate('studentId', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean() as unknown as Promise<ReviewLean[]>,
    ])

    const todaySessions = todaySessionCandidates.filter((booking) => (
      dateKeyInTimeZone(
        booking.scheduledAt,
        booking.timezone || teacherTimeZone,
      ) === teacherTodayKey
    ))

    const totalEarnings = paidFees.reduce(
      (sum, fee) => sum + (Number(fee.teacherEarning) || 0),
      0,
    )
    const pendingPayout = paidFees
      .filter((fee) => ['pending', 'approved'].includes(fee.payoutStatus ?? ''))
      .reduce((sum, fee) => sum + (Number(fee.teacherEarning) || 0), 0)
    const thisMonthEarnings = paidFees
      .filter((fee) => (fee.paidAt ?? fee.createdAt) >= monthStart)
      .reduce((sum, fee) => sum + (Number(fee.teacherEarning) || 0), 0)
    const previousMonthEarnings = paidFees
      .filter((fee) => {
        const paidDate = fee.paidAt ?? fee.createdAt
        return paidDate >= previousMonth.start && paidDate < previousMonth.end
      })
      .reduce((sum, fee) => sum + (Number(fee.teacherEarning) || 0), 0)

    const earningsChangePercent =
      previousMonthEarnings > 0
        ? Math.round(
            ((thisMonthEarnings - previousMonthEarnings) /
              previousMonthEarnings) *
              100,
          )
        : thisMonthEarnings > 0
          ? 100
          : 0

    const weeklyEarnings = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart)
      date.setDate(date.getDate() - (6 - index))
      const key = toDateKey(date)
      const amount = paidFees
        .filter((fee) => toDateKey(fee.paidAt ?? fee.createdAt) === key)
        .reduce((sum, fee) => sum + (Number(fee.teacherEarning) || 0), 0)
      return {
        date: date.toISOString(),
        label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        amount,
      }
    })

    const teacher = getNamedReference(profile.userId)

    return {
      applicationStatus: applicationStatus(profile),
      teacher: {
        id: String(teacher?._id ?? profile.userId),
        name: teacher?.name ?? 'Teacher',
        avatar: teacher?.avatar ?? null,
      },
      profile: {
        id: String(profile._id),
        isApproved: Boolean(profile.isApproved),
        profileCompletedPercent: profile.profileCompletedPercent ?? 0,
        rating: profile.rating ?? 0,
        totalReviews: profile.totalReviews ?? 0,
        averageResponseTimeMinutes: profile.averageResponseTimeMinutes ?? 0,
        subjects: (profile.subjects ?? [])
          .map(getSubjectReference)
          .filter((subject): subject is SubjectReference => Boolean(subject))
          .map((subject) => ({
            id: String(subject._id),
            name: subject.name,
            slug: subject.slug ?? '',
          })),
        rejectionReason: profile.rejectionReason ?? null,
      },
      summary: {
        todaySessions: todaySessions.length,
        upcomingSessions: upcomingSessions.length,
        pendingRequests,
        activeStudents: activeStudents.length,
        completedSessions,
        availableSlots,
        rating: profile.rating ?? 0,
        totalReviews: profile.totalReviews ?? 0,
        totalEarnings,
        thisMonthEarnings,
        pendingPayout,
        earningsChangePercent,
      },
      todaySessions: todaySessions.map(serializeBooking),
      upcomingSessions: upcomingSessions.map(serializeBooking),
      upcomingAvailability: upcomingAvailability.map(serializeAvailability),
      pendingRequestItems: pendingRequestItems.map(serializeBooking),
      weeklyEarnings,
      popularDoubts: popularDoubts.map((poll) => ({
        id: String(poll._id),
        gradeLevel: poll.gradeLevel,
        subjectName: poll.subjectName,
        topicName: poll.topicName,
        title: poll.title,
        status: poll.status,
        voteCount: poll.voteCount,
        commentCount: poll.commentCount,
        createdAt: poll.createdAt.toISOString(),
      })),
      recentReviews: recentReviews.map((review) => {
        const student = getNamedReference(review.studentId)
        return {
          id: String(review._id),
          studentName: student?.name ?? 'Student',
          studentAvatar: student?.avatar ?? null,
          rating: review.rating,
          review: review.review,
          createdAt: review.createdAt.toISOString(),
        }
      }),
    }
  }
}

export const teacherDashboardService = new TeacherDashboardService()
