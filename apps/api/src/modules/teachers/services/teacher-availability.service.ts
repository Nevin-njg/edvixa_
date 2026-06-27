import { Types } from 'mongoose'

import { AppError } from '../../../shared/errors/app-error.js'
import { AvailabilityModel } from '../../availability/models/availability.model.js'
import { BookingModel } from '../../bookings/models/booking.model.js'
import { SubjectModel } from '../../subjects/models/subject.model.js'
import { TeacherProfileModel } from '../models/teacher-profile.model.js'

type SlotInput = {
  date: string
  startTime: string
  endTime: string
  timezone: string
  subjectIds: string[]
}

type RecurringInput = {
  startDate: string
  endDate: string
  weekdays: number[]
  startTime: string
  endTime: string
  timezone: string
  subjectIds: string[]
}

type CopyWeekInput = {
  sourceWeekStart: string
  targetWeekStart: string
}

function startOfUtcDay(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(422, 'Invalid date', 'INVALID_DATE')
  }
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return (hour ?? 0) * 60 + (minute ?? 0)
}

function durationMinutes(startTime: string, endTime: string): number {
  return minutes(endTime) - minutes(startTime)
}

class TeacherAvailabilityService {
  private async getApprovedProfile(userId: string) {
    const profile = await TeacherProfileModel.findOne({ userId }).lean()
    if (!profile) {
      throw new AppError(404, 'Teacher profile not found', 'TEACHER_PROFILE_NOT_FOUND')
    }
    if (!profile.isApproved) {
      throw new AppError(
        403,
        'Your teacher profile must be approved before managing slots',
        'TEACHER_NOT_APPROVED',
      )
    }
    return profile
  }

  private async validateSubjects(profileSubjects: Types.ObjectId[], subjectIds: string[]) {
    const allowed = new Set(profileSubjects.map((id) => String(id)))
    if (subjectIds.some((id) => !allowed.has(id))) {
      throw new AppError(
        422,
        'You can only assign subjects from your approved teacher profile',
        'INVALID_SLOT_SUBJECT',
      )
    }

    const count = await SubjectModel.countDocuments({
      _id: { $in: subjectIds },
      isActive: true,
    })
    if (count !== subjectIds.length) {
      throw new AppError(422, 'One or more subjects are unavailable', 'SUBJECT_NOT_FOUND')
    }
  }

  private async assertNoOverlap(
    teacherId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ) {
    const dayEnd = addUtcDays(date, 1)
    const query: Record<string, unknown> = {
      teacherId,
      date: { $gte: date, $lt: dayEnd },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }
    if (excludeId) query._id = { $ne: excludeId }

    const conflict = await AvailabilityModel.findOne(query).lean()
    if (conflict) {
      throw new AppError(
        409,
        'This time overlaps with an existing or blocked slot',
        'SLOT_OVERLAP',
      )
    }
  }

  private serialize(slot: any) {
    const subjects = Array.isArray(slot.subjectIds)
      ? slot.subjectIds.map((subject: any) => ({
          id: String(subject?._id ?? subject),
          name: subject?.name ?? 'Subject',
        }))
      : []

    const booking = slot.bookingId && typeof slot.bookingId === 'object'
      ? {
          id: String(slot.bookingId._id),
          status: slot.bookingId.status,
          paymentStatus: slot.bookingId.paymentStatus,
          topicName: slot.bookingId.topicName,
        }
      : null

    return {
      id: String(slot._id),
      date: new Date(slot.date).toISOString().slice(0, 10),
      startTime: slot.startTime,
      endTime: slot.endTime,
      timezone: slot.timezone,
      durationMinutes: durationMinutes(slot.startTime, slot.endTime),
      status: slot.isBlocked
        ? 'blocked'
        : slot.isBooked
          ? 'booked'
          : booking?.status === 'cancelled'
            ? 'cancelled'
            : 'available',
      isBooked: Boolean(slot.isBooked),
      isBlocked: Boolean(slot.isBlocked),
      isRecurring: Boolean(slot.isRecurring),
      subjects,
      booking,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    }
  }

  async list(
    userId: string,
    query: { start?: string; end?: string },
  ) {
    const profile = await this.getApprovedProfile(userId)
    const start = query.start ? startOfUtcDay(query.start) : startOfUtcDay(new Date())
    const end = query.end ? addUtcDays(startOfUtcDay(query.end), 1) : addUtcDays(start, 7)

    if (end <= start || end.getTime() - start.getTime() > 93 * 86_400_000) {
      throw new AppError(422, 'Date range must be between 1 and 93 days', 'INVALID_DATE_RANGE')
    }

    const slots = await AvailabilityModel.find({
      teacherId: profile.userId,
      date: { $gte: start, $lt: end },
    })
      .populate('subjectIds', 'name slug')
      .populate('bookingId', 'status paymentStatus topicName')
      .sort({ date: 1, startTime: 1 })
      .lean()

    const serialized = slots.map((slot) => this.serialize(slot))
    const summary = {
      available: serialized.filter((slot) => slot.status === 'available').length,
      booked: serialized.filter((slot) => slot.status === 'booked').length,
      blocked: serialized.filter((slot) => slot.status === 'blocked').length,
      totalHours: Number(
        (
          serialized
            .filter((slot) => slot.status !== 'blocked')
            .reduce((total, slot) => total + slot.durationMinutes, 0) / 60
        ).toFixed(1),
      ),
    }

    return {
      range: {
        start: start.toISOString().slice(0, 10),
        end: addUtcDays(end, -1).toISOString().slice(0, 10),
      },
      timezone: profile.timezone || 'Asia/Kolkata',
      summary,
      slots: serialized,
    }
  }

  async create(userId: string, input: SlotInput) {
    const profile = await this.getApprovedProfile(userId)
    const date = startOfUtcDay(input.date)
    if (date < startOfUtcDay(new Date())) {
      throw new AppError(422, 'Past availability cannot be created', 'PAST_SLOT')
    }

    await this.validateSubjects(profile.subjects as Types.ObjectId[], input.subjectIds)
    await this.assertNoOverlap(userId, date, input.startTime, input.endTime)

    const slot = await AvailabilityModel.create({
      teacherId: userId,
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      subjectIds: input.subjectIds,
      isBooked: false,
      isBlocked: false,
      isRecurring: false,
    })

    const populated = await slot.populate('subjectIds', 'name slug')
    return this.serialize(populated.toObject())
  }

  async createRecurring(userId: string, input: RecurringInput) {
    const profile = await this.getApprovedProfile(userId)
    await this.validateSubjects(profile.subjects as Types.ObjectId[], input.subjectIds)

    const start = startOfUtcDay(input.startDate)
    const end = startOfUtcDay(input.endDate)
    if (start < startOfUtcDay(new Date())) {
      throw new AppError(422, 'Recurring availability cannot begin in the past', 'PAST_SLOT')
    }

    const dates: Date[] = []
    for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
      if (input.weekdays.includes(cursor.getUTCDay())) dates.push(new Date(cursor))
    }

    if (dates.length === 0) {
      throw new AppError(422, 'No matching dates were found', 'NO_RECURRING_DATES')
    }
    if (dates.length > 120) {
      throw new AppError(422, 'Recurring slot would create too many entries', 'TOO_MANY_SLOTS')
    }

    const conflicts: string[] = []
    for (const date of dates) {
      try {
        await this.assertNoOverlap(userId, date, input.startTime, input.endTime)
      } catch (error) {
        if (error instanceof AppError && error.code === 'SLOT_OVERLAP') {
          conflicts.push(date.toISOString().slice(0, 10))
        } else {
          throw error
        }
      }
    }

    const conflictSet = new Set(conflicts)
    const creatable = dates.filter((date) => !conflictSet.has(date.toISOString().slice(0, 10)))
    if (creatable.length === 0) {
      throw new AppError(409, 'Every recurring date conflicts with an existing slot', 'ALL_SLOTS_CONFLICT')
    }

    await AvailabilityModel.insertMany(
      creatable.map((date) => ({
        teacherId: userId,
        date,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
        subjectIds: input.subjectIds,
        isBooked: false,
        isBlocked: false,
        isRecurring: true,
        recurringDays: input.weekdays,
        recurringUntil: end,
      })),
    )

    return {
      created: creatable.length,
      skipped: conflicts.length,
      skippedDates: conflicts,
    }
  }

  async update(userId: string, slotId: string, input: Partial<SlotInput>) {
    const profile = await this.getApprovedProfile(userId)
    const slot = await AvailabilityModel.findOne({ _id: slotId, teacherId: userId })
    if (!slot) throw new AppError(404, 'Availability slot not found', 'SLOT_NOT_FOUND')
    if (slot.isBooked || slot.bookingId) {
      throw new AppError(409, 'Booked or reserved slots cannot be edited', 'SLOT_LOCKED')
    }

    const date = input.date ? startOfUtcDay(input.date) : startOfUtcDay(slot.date)
    const startTime = input.startTime ?? slot.startTime
    const endTime = input.endTime ?? slot.endTime
    const subjectIds = input.subjectIds ?? slot.subjectIds.map(String)

    await this.validateSubjects(profile.subjects as Types.ObjectId[], subjectIds)
    await this.assertNoOverlap(userId, date, startTime, endTime, slotId)

    slot.date = date
    slot.startTime = startTime
    slot.endTime = endTime
    slot.timezone = input.timezone ?? slot.timezone
    slot.subjectIds = subjectIds.map((id) => new Types.ObjectId(id))
    await slot.save()

    const populated = await slot.populate('subjectIds', 'name slug')
    return this.serialize(populated.toObject())
  }

  async remove(userId: string, slotId: string) {
    await this.getApprovedProfile(userId)
    const slot = await AvailabilityModel.findOne({ _id: slotId, teacherId: userId })
    if (!slot) throw new AppError(404, 'Availability slot not found', 'SLOT_NOT_FOUND')
    if (slot.isBooked || slot.bookingId) {
      throw new AppError(409, 'Booked or reserved slots cannot be deleted', 'SLOT_LOCKED')
    }
    await slot.deleteOne()
    return { id: slotId }
  }

  async blockDate(userId: string, input: { date: string; timezone: string }) {
    await this.getApprovedProfile(userId)
    const date = startOfUtcDay(input.date)
    if (date < startOfUtcDay(new Date())) {
      throw new AppError(422, 'Past dates cannot be blocked', 'PAST_DATE')
    }

    const dayEnd = addUtcDays(date, 1)
    const booked = await AvailabilityModel.exists({
      teacherId: userId,
      date: { $gte: date, $lt: dayEnd },
      $or: [{ isBooked: true }, { bookingId: { $ne: null } }],
    })
    if (booked) {
      throw new AppError(409, 'A date with booked sessions cannot be blocked', 'DATE_HAS_BOOKINGS')
    }

    await AvailabilityModel.deleteMany({
      teacherId: userId,
      date: { $gte: date, $lt: dayEnd },
      isBooked: false,
      bookingId: null,
    })

    const blocked = await AvailabilityModel.create({
      teacherId: userId,
      date,
      startTime: '00:00',
      endTime: '23:59',
      timezone: input.timezone,
      subjectIds: [],
      isBooked: false,
      isBlocked: true,
      isRecurring: false,
    })

    return this.serialize(blocked.toObject())
  }

  async copyWeek(userId: string, input: CopyWeekInput) {
    await this.getApprovedProfile(userId)
    const source = startOfUtcDay(input.sourceWeekStart)
    const target = startOfUtcDay(input.targetWeekStart)
    const sourceEnd = addUtcDays(source, 7)
    const differenceDays = Math.round((target.getTime() - source.getTime()) / 86_400_000)

    const sourceSlots = await AvailabilityModel.find({
      teacherId: userId,
      date: { $gte: source, $lt: sourceEnd },
      isBooked: false,
      bookingId: null,
      isBlocked: false,
    }).lean()

    let created = 0
    let skipped = 0

    for (const slot of sourceSlots) {
      const date = addUtcDays(startOfUtcDay(slot.date), differenceDays)
      if (date < startOfUtcDay(new Date())) {
        skipped += 1
        continue
      }

      try {
        await this.assertNoOverlap(userId, date, slot.startTime, slot.endTime)
        await AvailabilityModel.create({
          teacherId: userId,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone,
          subjectIds: slot.subjectIds,
          isBooked: false,
          isBlocked: false,
          isRecurring: slot.isRecurring,
          recurringDays: slot.recurringDays,
          recurringUntil: slot.recurringUntil,
        })
        created += 1
      } catch (error) {
        if (error instanceof AppError && error.code === 'SLOT_OVERLAP') skipped += 1
        else throw error
      }
    }

    return { created, skipped }
  }
}

export const teacherAvailabilityService = new TeacherAvailabilityService()
