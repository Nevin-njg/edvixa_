import { Types } from 'mongoose'

import { AppError } from '../../../shared/errors/app-error.js'
import { AvailabilityModel } from '../../availability/models/availability.model.js'
import { DoubtPollModel } from '../../doubt-polls/models/doubt-poll.model.js'
import { FeeModel } from '../../fees/models/fee.model.js'
import { TeacherProfileModel } from '../../teachers/models/teacher-profile.model.js'
import { BookingModel } from '../models/booking.model.js'

type BookingStatusFilter =
  | 'all'
  | 'pending'
  | 'upcoming'
  | 'completed'
  | 'rejected'
  | 'cancelled'

type ListInput = {
  status?: BookingStatusFilter
  search?: string
  page?: string
  limit?: string
}

type ActionInput = {
  note?: string
  meetingLink?: string
}

type SuggestSlotInput = {
  slotId: string
  note?: string
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
  status: string
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

type AvailabilityLean = {
  _id: Types.ObjectId
  date: Date
  startTime: string
  endTime: string
  timezone?: string
  isBooked?: boolean
  isBlocked?: boolean
  subjectIds?: Types.ObjectId[]
}

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

function combineDateAndTime(date: Date, time: string): Date {
  const [hoursText = '0', minutesText = '0'] = time.split(':')
  const result = new Date(date)
  result.setHours(Number(hoursText), Number(minutesText), 0, 0)
  return result
}

function normalizedStatusFilter(status: BookingStatusFilter | undefined) {
  switch (status) {
    case 'pending':
      return { status: 'pending' }
    case 'upcoming':
      return { status: { $in: ['accepted', 'upcoming', 'rescheduled'] } }
    case 'completed':
      return { status: 'completed' }
    case 'rejected':
      return { status: 'rejected' }
    case 'cancelled':
      return { status: 'cancelled' }
    default:
      return {}
  }
}

function serializeSlot(slot: AvailabilityLean) {
  const scheduledAt = combineDateAndTime(slot.date, slot.startTime)
  const endAt = combineDateAndTime(slot.date, slot.endTime)

  return {
    id: String(slot._id),
    date: slot.date.toISOString().slice(0, 10),
    startTime: slot.startTime,
    endTime: slot.endTime,
    scheduledAt: scheduledAt.toISOString(),
    endAt: endAt.toISOString(),
    timezone: slot.timezone ?? 'Asia/Kolkata',
  }
}

class TeacherBookingService {
  private async getApprovedTeacher(userId: string) {
    const profile = await TeacherProfileModel.findOne({
      userId,
      isApproved: true,
      approvalStatus: 'approved',
    })
      .select('_id userId subjects timezone')
      .lean()

    if (!profile) {
      throw new AppError(
        403,
        'Your teacher profile must be approved before managing bookings',
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
              status: doubt.status,
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
        createdAt: booking.createdAt.toISOString(),
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
    const page = Math.max(1, Number(input.page) || 1)
    const limit = Math.min(30, Math.max(5, Number(input.limit) || 10))
    const search = input.search?.trim() ?? ''
    const status = input.status ?? 'all'
    const teacherId = new Types.ObjectId(userId)

    const baseQuery: Record<string, unknown> = {
      teacherId,
      ...normalizedStatusFilter(status),
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

      baseQuery.$or = [
        { studentId: { $in: studentIds } },
        { subjectId: { $in: subjectIds } },
        { topicName: { $regex: search, $options: 'i' } },
        { doubtText: { $regex: search, $options: 'i' } },
      ]
    }

    const [bookings, total, pending, upcoming, completed, rejected, cancelled] =
      await Promise.all([
        BookingModel.find(baseQuery)
          .populate('studentId', 'name email avatar phone')
          .populate('subjectId', 'name')
          .populate(
            'doubtPollId',
            'title description status voteCount commentCount',
          )
          .sort({ createdAt: -1, scheduledAt: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean() as unknown as Promise<BookingLean[]>,
        BookingModel.countDocuments(baseQuery),
        BookingModel.countDocuments({ teacherId, status: 'pending' }),
        BookingModel.countDocuments({
          teacherId,
          status: { $in: ['accepted', 'upcoming', 'rescheduled'] },
        }),
        BookingModel.countDocuments({ teacherId, status: 'completed' }),
        BookingModel.countDocuments({ teacherId, status: 'rejected' }),
        BookingModel.countDocuments({ teacherId, status: 'cancelled' }),
      ])

    const now = new Date()
    const future = new Date(now)
    future.setDate(future.getDate() + 45)

    const availableSlots = (await AvailabilityModel.find({
      teacherId,
      date: { $gte: now, $lte: future },
      isBooked: false,
      isBlocked: false,
    })
      .sort({ date: 1, startTime: 1 })
      .limit(60)
      .lean()) as unknown as AvailabilityLean[]

    return {
      profile: {
        id: String(profile._id),
        timezone: profile.timezone ?? 'Asia/Kolkata',
      },
      summary: {
        total: pending + upcoming + completed + rejected + cancelled,
        pending,
        upcoming,
        completed,
        rejected,
        cancelled,
      },
      items: await this.serializeBookings(bookings),
      availableSlots: availableSlots.map(serializeSlot),
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
    })
      .populate('studentId', 'name email avatar phone')
      .populate('subjectId', 'name')
      .populate(
        'doubtPollId',
        'title description status voteCount commentCount',
      )
      .lean()) as unknown as BookingLean | null

    if (!booking) {
      throw new AppError(404, 'Booking request not found', 'BOOKING_NOT_FOUND')
    }

    const [serialized] = await this.serializeBookings([booking])
    return serialized
  }

  async accept(userId: string, bookingId: string, input: ActionInput) {
    await this.getApprovedTeacher(userId)

    const booking = await BookingModel.findOne({
      _id: bookingId,
      teacherId: userId,
    })

    if (!booking) {
      throw new AppError(404, 'Booking request not found', 'BOOKING_NOT_FOUND')
    }

    if (booking.status !== 'pending') {
      throw new AppError(
        409,
        'Only pending requests can be accepted',
        'BOOKING_NOT_PENDING',
      )
    }

    if (booking.paymentStatus !== 'paid') {
      throw new AppError(
        409,
        'The student payment must be completed before acceptance',
        'PAYMENT_NOT_COMPLETED',
      )
    }

    booking.status = 'upcoming'
    booking.teacherNote = input.note?.trim() ?? booking.teacherNote

    if (input.meetingLink?.trim()) {
      booking.meetingLink = input.meetingLink.trim()
      booking.meetingProvider = 'manual'
    }

    await booking.save()
    return this.getById(userId, bookingId)
  }

  async decline(userId: string, bookingId: string, input: ActionInput) {
    await this.getApprovedTeacher(userId)

    const booking = await BookingModel.findOne({
      _id: bookingId,
      teacherId: userId,
    })

    if (!booking) {
      throw new AppError(404, 'Booking request not found', 'BOOKING_NOT_FOUND')
    }

    if (booking.status !== 'pending') {
      throw new AppError(
        409,
        'Only pending requests can be declined',
        'BOOKING_NOT_PENDING',
      )
    }

    const reason = input.note?.trim() || 'Declined by teacher'
    booking.status = 'rejected'
    booking.cancelledBy = 'teacher'
    booking.cancellationReason = reason
    booking.cancelledAt = new Date()
    booking.teacherNote = reason

    const fee = await FeeModel.findOne({ bookingId: booking._id })
    if (fee?.status === 'paid') {
      fee.refundReason = reason
      fee.refundAmount = fee.totalAmount

      if (fee.paymentGateway === 'demo') {
        fee.status = 'refunded'
        fee.refundStatus = 'processed'
        fee.refundedAt = new Date()
        booking.paymentStatus = 'refunded'
      } else {
        fee.refundStatus = 'requested'
      }

      await fee.save()
    }

    await booking.save()
    await AvailabilityModel.updateOne(
      { _id: booking.availabilitySlotId, bookingId: booking._id },
      { $set: { isBooked: false, bookingId: null } },
    )

    return this.getById(userId, bookingId)
  }

  async suggestSlot(
    userId: string,
    bookingId: string,
    input: SuggestSlotInput,
  ) {
    await this.getApprovedTeacher(userId)

    const booking = await BookingModel.findOne({
      _id: bookingId,
      teacherId: userId,
    })

    if (!booking) {
      throw new AppError(404, 'Booking request not found', 'BOOKING_NOT_FOUND')
    }

    if (booking.status !== 'pending') {
      throw new AppError(
        409,
        'Only pending requests can be moved to another slot',
        'BOOKING_NOT_PENDING',
      )
    }

    if (String(booking.availabilitySlotId) === input.slotId) {
      throw new AppError(422, 'Choose a different time slot', 'SAME_SLOT')
    }

    const newSlot = (await AvailabilityModel.findOneAndUpdate(
      {
        _id: input.slotId,
        teacherId: userId,
        isBooked: false,
        isBlocked: false,
      },
      { $set: { isBooked: true, bookingId: booking._id } },
      { new: true },
    )) as unknown as AvailabilityLean | null

    if (!newSlot) {
      throw new AppError(
        409,
        'The selected slot is no longer available',
        'SLOT_UNAVAILABLE',
      )
    }

    if (
      (newSlot.subjectIds ?? []).length > 0 &&
      !(newSlot.subjectIds ?? []).some(
        (subjectId) => String(subjectId) === String(booking.subjectId),
      )
    ) {
      await AvailabilityModel.updateOne(
        { _id: newSlot._id, bookingId: booking._id },
        { $set: { isBooked: false, bookingId: null } },
      )
      throw new AppError(
        422,
        'The selected slot does not support this subject',
        'SLOT_SUBJECT_MISMATCH',
      )
    }

    const oldSlotId = booking.availabilitySlotId
    const oldScheduledAt = booking.scheduledAt
    const scheduledAt = combineDateAndTime(newSlot.date, newSlot.startTime)
    const endAt = combineDateAndTime(newSlot.date, newSlot.endTime)

    if (scheduledAt.getTime() <= Date.now()) {
      await AvailabilityModel.updateOne(
        { _id: newSlot._id, bookingId: booking._id },
        { $set: { isBooked: false, bookingId: null } },
      )
      throw new AppError(409, 'The selected slot has passed', 'SLOT_EXPIRED')
    }

    try {
      booking.rescheduleHistory.push({
        oldScheduledAt,
        newScheduledAt: scheduledAt,
        oldAvailabilitySlotId: oldSlotId,
        newAvailabilitySlotId: newSlot._id,
        changedBy: 'teacher',
        reason: input.note?.trim() || 'Teacher suggested another time',
        changedAt: new Date(),
      })
      booking.availabilitySlotId = newSlot._id
      booking.scheduledAt = scheduledAt
      booking.endAt = endAt
      booking.durationMinutes = Math.max(
        1,
        Math.round((endAt.getTime() - scheduledAt.getTime()) / 60000),
      )
      booking.timezone = newSlot.timezone ?? booking.timezone
      booking.teacherNote =
        input.note?.trim() || 'Teacher suggested another available time.'
      await booking.save()

      await AvailabilityModel.updateOne(
        { _id: oldSlotId, bookingId: booking._id },
        { $set: { isBooked: false, bookingId: null } },
      )
    } catch (error) {
      await AvailabilityModel.updateOne(
        { _id: newSlot._id, bookingId: booking._id },
        { $set: { isBooked: false, bookingId: null } },
      )
      throw error
    }

    return this.getById(userId, bookingId)
  }
}

export const teacherBookingService = new TeacherBookingService()
