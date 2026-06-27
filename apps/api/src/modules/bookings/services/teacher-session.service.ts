import { Types } from 'mongoose'

import { AppError } from '../../../shared/errors/app-error.js'
import { FeeModel } from '../../fees/models/fee.model.js'
import { TeacherProfileModel } from '../../teachers/models/teacher-profile.model.js'
import { BookingModel } from '../models/booking.model.js'

type SessionFilter =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'completed'
  | 'cancelled'

type ListInput = {
  status?: SessionFilter
  search?: string
  page?: string | number
  limit?: string | number
}

type UpdateDetailsInput = {
  meetingLink?: string
  teacherNote?: string
}

type CompleteInput = {
  teacherNote?: string
}

type UserReference = {
  _id: Types.ObjectId
  name: string
  email?: string
  avatar?: string | null
  phone?: string | null
}

type SubjectReference = {
  _id: Types.ObjectId
  name: string
}

type DoubtReference = {
  _id: Types.ObjectId
  title: string
  description?: string
  status?: string
  voteCount?: number
  commentCount?: number
}

type BookingLean = {
  _id: Types.ObjectId
  studentId: UserReference | Types.ObjectId
  subjectId: SubjectReference | Types.ObjectId
  doubtPollId?: DoubtReference | Types.ObjectId | null
  topicName: string
  doubtText?: string
  studentGrade?: string | null
  studentNote?: string
  teacherNote?: string
  scheduledAt: Date
  endAt: Date
  durationMinutes: number
  timezone: string
  status: string
  paymentStatus: string
  availabilitySlotId: Types.ObjectId
  meetingLink?: string | null
  meetingProvider?: string | null
  createdAt: Date
  updatedAt: Date
}

type FeeLean = {
  _id: Types.ObjectId
  bookingId: Types.ObjectId
  amount: number
  platformFee: number
  totalAmount: number
  currency: string
  status: string
  paymentMethod: string
  paymentGateway: string
  refundStatus?: string
  refundAmount?: number
}

const ACTIVE_STATUSES = [
  'accepted',
  'upcoming',
  'rescheduled',
] as const

function getUser(value: unknown): UserReference | null {
  if (value && typeof value === 'object' && '_id' in value && 'name' in value) {
    return value as UserReference
  }
  return null
}

function getSubject(value: unknown): SubjectReference | null {
  if (value && typeof value === 'object' && '_id' in value && 'name' in value) {
    return value as SubjectReference
  }
  return null
}

function getDoubt(value: unknown): DoubtReference | null {
  if (value && typeof value === 'object' && '_id' in value && 'title' in value) {
    return value as DoubtReference
  }
  return null
}

function dateKey(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function isActiveStatus(status: string) {
  return ACTIVE_STATUSES.some(
    (activeStatus) => activeStatus === status,
  )
}

class TeacherSessionService {
  private async getApprovedTeacher(userId: string) {
    const profile = await TeacherProfileModel.findOne({
      userId,
      isApproved: true,
      approvalStatus: 'approved',
    })
      .select('_id userId timezone')
      .lean()

    if (!profile) {
      throw new AppError(
        403,
        'Your teacher profile must be approved before managing sessions',
        'TEACHER_NOT_APPROVED',
      )
    }

    return profile
  }

  private async serializeBookings(bookings: BookingLean[]) {
    const bookingIds = bookings.map((booking) => booking._id)
    const fees = (await FeeModel.find({ bookingId: { $in: bookingIds } })
      .select(
        'bookingId amount platformFee totalAmount currency status paymentMethod paymentGateway refundStatus refundAmount',
      )
      .lean()) as unknown as FeeLean[]

    const feeByBooking = new Map(
      fees.map((fee) => [String(fee.bookingId), fee]),
    )

    return bookings.map((booking) => {
      const student = getUser(booking.studentId)
      const subject = getSubject(booking.subjectId)
      const doubt = getDoubt(booking.doubtPollId)
      const fee = feeByBooking.get(String(booking._id))

      return {
        id: String(booking._id),
        student: {
          id: String(student?._id ?? booking.studentId),
          name: student?.name ?? 'Student',
          email: student?.email ?? '',
          avatar: student?.avatar ?? null,
          phone: student?.phone ?? null,
          grade: booking.studentGrade ?? null,
        },
        subject: {
          id: String(subject?._id ?? booking.subjectId),
          name: subject?.name ?? 'Subject',
        },
        topicName: booking.topicName,
        doubt: doubt
          ? {
              id: String(doubt._id),
              title: doubt.title,
              description: doubt.description ?? '',
              status: doubt.status ?? 'open',
              votes: Number(doubt.voteCount) || 0,
              comments: Number(doubt.commentCount) || 0,
            }
          : booking.doubtText
            ? {
                id: null,
                title: booking.doubtText,
                description: '',
                status: 'open',
                votes: 0,
                comments: 0,
              }
            : null,
        studentNote: booking.studentNote ?? '',
        teacherNote: booking.teacherNote ?? '',
        scheduledAt: booking.scheduledAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        durationMinutes: booking.durationMinutes,
        timezone: booking.timezone,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        meetingLink: booking.meetingLink ?? null,
        meetingProvider: booking.meetingProvider ?? null,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        payment: fee
          ? {
              feeId: String(fee._id),
              amount: fee.amount,
              platformFee: fee.platformFee,
              totalAmount: fee.totalAmount,
              currency: fee.currency,
              status: fee.status,
              method: fee.paymentMethod,
              gateway: fee.paymentGateway,
              refundStatus: fee.refundStatus ?? 'none',
              refundAmount: fee.refundAmount ?? 0,
            }
          : null,
      }
    })
  }

  async list(userId: string, input: ListInput) {
    const profile = await this.getApprovedTeacher(userId)
    const teacherId = new Types.ObjectId(userId)
    const page = Math.max(1, Number(input.page) || 1)
    const limit = Math.min(30, Math.max(5, Number(input.limit) || 10))
    const search = String(input.search ?? '').trim()
    const filter = input.status ?? 'all'

    const query: Record<string, unknown> = {
      teacherId,
      status: {
        $in: [
          'accepted',
          'upcoming',
          'rescheduled',
          'completed',
          'cancelled',
          'rejected',
        ],
      },
    }

    if (search) {
      const studentIds = await (
        await import('../../users/models/user.model.js')
      ).UserModel.find({
        role: 'student',
        name: { $regex: search, $options: 'i' },
      }).distinct('_id')

      const subjectIds = await (
        await import('../../subjects/models/subject.model.js')
      ).SubjectModel.find({
        name: { $regex: search, $options: 'i' },
      }).distinct('_id')

      query.$or = [
        { studentId: { $in: studentIds } },
        { subjectId: { $in: subjectIds } },
        { topicName: { $regex: search, $options: 'i' } },
        { doubtText: { $regex: search, $options: 'i' } },
      ]
    }

    const bookings = (await BookingModel.find(query)
      .populate('studentId', 'name email avatar phone')
      .populate('subjectId', 'name')
      .populate(
        'doubtPollId',
        'title description status voteCount commentCount',
      )
      .sort({ scheduledAt: 1, createdAt: -1 })
      .limit(300)
      .lean()) as unknown as BookingLean[]

    const serialized = await this.serializeBookings(bookings)
    const now = new Date()
    const teacherTimeZone = profile.timezone ?? 'Asia/Kolkata'
    const todayKey = dateKey(now, teacherTimeZone)

    const isToday = (item: (typeof serialized)[number]) =>
      dateKey(new Date(item.scheduledAt), item.timezone || teacherTimeZone) ===
      todayKey

    const isLive = (item: (typeof serialized)[number]) => {
      const start = new Date(item.scheduledAt).getTime()
      const end = new Date(item.endAt).getTime()
      return isActiveStatus(item.status) && start <= now.getTime() && end >= now.getTime()
    }

    const matchesFilter = (item: (typeof serialized)[number]) => {
      if (filter === 'today') {
        return isActiveStatus(item.status) && isToday(item)
      }
      if (filter === 'upcoming') {
        return isActiveStatus(item.status) && new Date(item.endAt).getTime() >= now.getTime()
      }
      if (filter === 'completed') {
        return item.status === 'completed'
      }
      if (filter === 'cancelled') {
        return item.status === 'cancelled' || item.status === 'rejected'
      }
      return true
    }

    const filtered = serialized
      .filter(matchesFilter)
      .sort((first, second) => {
        if (filter === 'completed' || filter === 'cancelled') {
          return (
            new Date(second.scheduledAt).getTime() -
            new Date(first.scheduledAt).getTime()
          )
        }
        return (
          new Date(first.scheduledAt).getTime() -
          new Date(second.scheduledAt).getTime()
        )
      })

    const total = filtered.length
    const items = filtered.slice((page - 1) * limit, page * limit)

    const today = serialized.filter(
      (item) => isActiveStatus(item.status) && isToday(item),
    ).length
    const live = serialized.filter(isLive).length
    const upcoming = serialized.filter(
      (item) =>
        isActiveStatus(item.status) &&
        new Date(item.endAt).getTime() >= now.getTime(),
    ).length
    const completed = serialized.filter(
      (item) => item.status === 'completed',
    ).length
    const cancelled = serialized.filter(
      (item) => item.status === 'cancelled' || item.status === 'rejected',
    ).length

    return {
      profile: {
        id: String(profile._id),
        timezone: teacherTimeZone,
      },
      summary: {
        today,
        live,
        upcoming,
        completed,
        cancelled,
      },
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    }
  }

  async getById(userId: string, bookingId: string) {
    await this.getApprovedTeacher(userId)

    const booking = (await BookingModel.findOne({
      _id: bookingId,
      teacherId: userId,
      status: {
        $in: [
          'accepted',
          'upcoming',
          'rescheduled',
          'completed',
          'cancelled',
          'rejected',
        ],
      },
    })
      .populate('studentId', 'name email avatar phone')
      .populate('subjectId', 'name')
      .populate(
        'doubtPollId',
        'title description status voteCount commentCount',
      )
      .lean()) as unknown as BookingLean | null

    if (!booking) {
      throw new AppError(404, 'Teaching session not found', 'SESSION_NOT_FOUND')
    }

    const [serialized] = await this.serializeBookings([booking])
    return serialized
  }

  async updateDetails(
    userId: string,
    bookingId: string,
    input: UpdateDetailsInput,
  ) {
    await this.getApprovedTeacher(userId)

    const booking = await BookingModel.findOne({
      _id: bookingId,
      teacherId: userId,
      status: { $in: ACTIVE_STATUSES },
    })

    if (!booking) {
      throw new AppError(
        404,
        'Active teaching session not found',
        'SESSION_NOT_FOUND',
      )
    }

    const meetingLink = input.meetingLink?.trim() ?? ''
    const teacherNote = input.teacherNote?.trim() ?? ''

    await BookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          meetingLink: meetingLink || null,
          meetingProvider: meetingLink ? 'manual' : null,
          teacherNote,
        },
      },
    )

    return this.getById(userId, bookingId)
  }

  async complete(userId: string, bookingId: string, input: CompleteInput) {
    await this.getApprovedTeacher(userId)

    const booking = await BookingModel.findOne({
      _id: bookingId,
      teacherId: userId,
      status: { $in: ACTIVE_STATUSES },
    })

    if (!booking) {
      throw new AppError(
        404,
        'Active teaching session not found',
        'SESSION_NOT_FOUND',
      )
    }

    if (booking.scheduledAt.getTime() > Date.now()) {
      throw new AppError(
        409,
        'A session can only be completed after it starts',
        'SESSION_NOT_STARTED',
      )
    }

    await BookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          status: 'completed',
          teacherNote: input.teacherNote?.trim() || booking.teacherNote || '',
        },
      },
    )

    return this.getById(userId, bookingId)
  }
}

export const teacherSessionService = new TeacherSessionService()
