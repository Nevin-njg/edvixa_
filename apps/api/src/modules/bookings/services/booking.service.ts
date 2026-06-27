import { Types } from 'mongoose'

import { env } from '../../../config/env.js'
import { AppError } from '../../../shared/errors/app-error.js'
import { AvailabilityModel } from '../../availability/models/availability.model.js'
import { FeeModel } from '../../fees/models/fee.model.js'
import { doubtPollService } from '../../doubt-polls/services/doubt-poll.service.js'
import {
  type RazorpayPayment,
  razorpayService,
} from '../../payments/services/razorpay.service.js'
import { SubjectModel } from '../../subjects/models/subject.model.js'
import { TeacherProfileModel } from '../../teachers/models/teacher-profile.model.js'
import { UserModel } from '../../users/models/user.model.js'
import { BookingModel } from '../models/booking.model.js'

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet'

type CheckoutInput = {
  teacherId: string
  subjectId: string
  topicId?: string
  topicName: string
  doubtPollId: string
  customTopic?: '0' | '1'
  slotId: string
}

type CreateBookingInput = CheckoutInput & {
  paymentMethod: PaymentMethod
  studentNote?: string
  agreedToTerms: true
}

type VerifyPaymentInput = {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

type PopulatedTeacherUser = {
  _id: Types.ObjectId
  name: string
  avatar?: string | null
  isActive?: boolean
}

type PopulatedTeacherSubject = {
  _id: Types.ObjectId
  name: string
  slug: string
}

type TeacherProfileLean = {
  _id: Types.ObjectId
  userId: PopulatedTeacherUser | Types.ObjectId
  subjects?: Array<PopulatedTeacherSubject | Types.ObjectId>
  hourlyRate?: number
  timezone?: string
  isApproved?: boolean
  approvalStatus?: string
}

type AvailabilityLean = {
  _id: Types.ObjectId
  teacherId: Types.ObjectId
  date: Date
  startTime: string
  endTime: string
  timezone?: string
  subjectIds?: Types.ObjectId[]
  isBooked?: boolean
  isBlocked?: boolean
}

type NamedReference = {
  _id: Types.ObjectId
  name: string
}

type BookingResultLean = {
  _id: Types.ObjectId
  teacherId: NamedReference | Types.ObjectId
  subjectId: NamedReference | Types.ObjectId
  topicName: string
  scheduledAt: Date
  endAt: Date
  timezone: string
  status: string
  paymentStatus: string
}

function getTeacherUser(profile: TeacherProfileLean): PopulatedTeacherUser | null {
  if (
    profile.userId &&
    typeof profile.userId === 'object' &&
    'name' in profile.userId
  ) {
    return profile.userId as PopulatedTeacherUser
  }
  return null
}

function getTeacherSubjects(
  profile: TeacherProfileLean,
): PopulatedTeacherSubject[] {
  return (profile.subjects ?? []).filter(
    (subject): subject is PopulatedTeacherSubject =>
      Boolean(subject && typeof subject === 'object' && 'name' in subject),
  )
}

function getNamedReference(
  value: NamedReference | Types.ObjectId,
): NamedReference | null {
  if (value && typeof value === 'object' && 'name' in value) {
    return value as NamedReference
  }
  return null
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hoursText = '0', minutesText = '0'] = time.split(':')
  const result = new Date(date)
  result.setHours(Number(hoursText), Number(minutesText), 0, 0)
  return result
}

function createReceiptUrl(feeId: string): string {
  return `/api/v1/fees/${feeId}/receipt`
}

function normalizePaymentMethod(method?: string): PaymentMethod {
  if (
    method === 'upi' ||
    method === 'card' ||
    method === 'netbanking' ||
    method === 'wallet'
  ) {
    return method
  }
  return 'upi'
}

class BookingService {
  private async resolveCheckout(studentId: string, input: CheckoutInput) {
    const profile = (await TeacherProfileModel.findOne({
      _id: input.teacherId,
      isApproved: true,
      approvalStatus: 'approved',
    })
      .populate('userId', 'name avatar isActive')
      .populate('subjects', 'name slug')
      .lean()) as unknown as TeacherProfileLean | null

    if (!profile) {
      throw new AppError(404, 'Teacher is unavailable', 'TEACHER_NOT_FOUND')
    }

    const teacherUser = getTeacherUser(profile)
    if (!teacherUser || teacherUser.isActive === false) {
      throw new AppError(404, 'Teacher is unavailable', 'TEACHER_NOT_FOUND')
    }

    const teacherSubjects = getTeacherSubjects(profile)
    const subject = teacherSubjects.find(
      (item) => String(item._id) === input.subjectId,
    )

    if (!subject) {
      throw new AppError(
        422,
        'This teacher does not teach the selected subject',
        'SUBJECT_NOT_SUPPORTED',
      )
    }

    const subjectDocument = await SubjectModel.findOne({
      _id: input.subjectId,
      isActive: true,
    }).lean()

    if (!subjectDocument) {
      throw new AppError(404, 'Subject is unavailable', 'SUBJECT_NOT_FOUND')
    }

    const isCustomTopic = input.customTopic === '1'
    if (!isCustomTopic) {
      const topic = subjectDocument.topics.find(
        (item) => String(item._id) === input.topicId && item.isActive !== false,
      )
      if (!topic) {
        throw new AppError(
          422,
          'The selected chapter does not belong to this subject',
          'TOPIC_NOT_FOUND',
        )
      }
      if (
        topic.name.trim().toLowerCase() !==
        input.topicName.trim().toLowerCase()
      ) {
        throw new AppError(
          422,
          'The selected chapter details changed. Please choose it again.',
          'TOPIC_MISMATCH',
        )
      }
    }

    const doubtPoll = await doubtPollService.validateForBooking(
      studentId,
      input.doubtPollId,
      input.subjectId,
      input.topicId,
      input.topicName,
    )

    const slot = (await AvailabilityModel.findOne({
      _id: input.slotId,
      teacherId: teacherUser._id,
      isBooked: false,
      isBlocked: false,
    }).lean()) as unknown as AvailabilityLean | null

    if (!slot) {
      throw new AppError(
        409,
        'This time slot has already been booked or is no longer available',
        'SLOT_UNAVAILABLE',
      )
    }

    if (
      (slot.subjectIds ?? []).length > 0 &&
      !(slot.subjectIds ?? []).some((id) => String(id) === input.subjectId)
    ) {
      throw new AppError(
        422,
        'The selected subject is not allowed for this time slot',
        'SLOT_SUBJECT_MISMATCH',
      )
    }

    const scheduledAt = combineDateAndTime(slot.date, slot.startTime)
    const endAt = combineDateAndTime(slot.date, slot.endTime)

    if (scheduledAt.getTime() <= Date.now()) {
      throw new AppError(409, 'This time slot has already passed', 'SLOT_EXPIRED')
    }

    const amount = Math.max(0, Number(profile.hourlyRate) || 0)
    const platformFee = Math.round(amount * 0.05)
    const totalAmount = amount + platformFee

    return {
      profile,
      teacherUser,
      subject,
      slot,
      scheduledAt,
      endAt,
      isCustomTopic,
      amount,
      platformFee,
      totalAmount,
      doubtPoll,
    }
  }

  private async getStudent(studentId: string) {
    const student = await UserModel.findOne({
      _id: studentId,
      role: 'student',
      isActive: true,
    })
      .select('name email')
      .lean()

    if (!student) {
      throw new AppError(404, 'Student account not found', 'STUDENT_NOT_FOUND')
    }

    return student
  }

  private async buildBookingResult(bookingId: Types.ObjectId | string) {
    const booking = (await BookingModel.findById(bookingId)
      .populate('teacherId', 'name')
      .populate('subjectId', 'name')
      .lean()) as unknown as BookingResultLean | null

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND')
    }

    const fee = await FeeModel.findOne({ bookingId: booking._id }).lean()
    if (!fee) {
      throw new AppError(404, 'Payment record not found', 'PAYMENT_NOT_FOUND')
    }

    const teacher = getNamedReference(booking.teacherId)
    const subject = getNamedReference(booking.subjectId)

    return {
      booking: {
        id: String(booking._id),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        teacherName: teacher?.name ?? 'Teacher',
        subjectName: subject?.name ?? 'Subject',
        topicName: booking.topicName,
        scheduledAt: booking.scheduledAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        timezone: booking.timezone,
      },
      payment: {
        feeId: String(fee._id),
        status: fee.status,
        method: normalizePaymentMethod(fee.paymentMethod),
        amount: fee.amount,
        platformFee: fee.platformFee,
        totalAmount: fee.totalAmount,
        currency: fee.currency,
        receiptUrl: fee.receiptUrl ?? createReceiptUrl(String(fee._id)),
      },
    }
  }

  async checkoutSummary(studentId: string, input: CheckoutInput) {
    const student = await this.getStudent(studentId)
    const resolved = await this.resolveCheckout(studentId, input)

    return {
      student: {
        id: String(student._id),
        name: student.name,
        email: student.email,
      },
      teacher: {
        id: String(resolved.profile._id),
        userId: String(resolved.teacherUser._id),
        name: resolved.teacherUser.name,
        avatar: resolved.teacherUser.avatar ?? null,
      },
      subject: {
        id: String(resolved.subject._id),
        name: resolved.subject.name,
        slug: resolved.subject.slug,
      },
      topic: {
        id: input.topicId ?? null,
        name: input.topicName.trim(),
        isCustom: resolved.isCustomTopic,
      },
      doubt: {
        id: resolved.doubtPoll.id,
        title: resolved.doubtPoll.title,
        description: resolved.doubtPoll.description,
        gradeLevel: resolved.doubtPoll.gradeLevel,
      },
      slot: {
        id: String(resolved.slot._id),
        date: resolved.slot.date.toISOString(),
        startTime: resolved.slot.startTime,
        endTime: resolved.slot.endTime,
        timezone:
          resolved.slot.timezone ?? resolved.profile.timezone ?? 'Asia/Kolkata',
        scheduledAt: resolved.scheduledAt.toISOString(),
        endAt: resolved.endAt.toISOString(),
        durationMinutes: Math.max(
          1,
          Math.round(
            (resolved.endAt.getTime() - resolved.scheduledAt.getTime()) / 60000,
          ),
        ),
      },
      pricing: {
        amount: resolved.amount,
        platformFee: resolved.platformFee,
        totalAmount: resolved.totalAmount,
        currency: 'INR',
      },
      payment: {
        provider: env.PAYMENT_PROVIDER,
        razorpayConfigured: razorpayService.isConfigured(),
      },
      cancellationPolicy: {
        title: 'Free cancellation up to 12 hours before the session',
        description:
          'Late cancellations may not be eligible for a full refund. Rescheduling depends on teacher availability.',
      },
    }
  }

  async create(studentId: string, input: CreateBookingInput) {
    if (env.PAYMENT_PROVIDER !== 'demo') {
      throw new AppError(
        409,
        'Direct demo checkout is disabled while Razorpay is active.',
        'DEMO_PAYMENT_DISABLED',
      )
    }

    const resolved = await this.resolveCheckout(studentId, input)

    const claimedSlot = await AvailabilityModel.findOneAndUpdate(
      {
        _id: input.slotId,
        teacherId: resolved.teacherUser._id,
        isBooked: false,
        isBlocked: false,
      },
      { $set: { isBooked: true } },
      { new: true },
    )

    if (!claimedSlot) {
      throw new AppError(
        409,
        'This time slot was booked by another student. Please choose another time.',
        'SLOT_UNAVAILABLE',
      )
    }

    let bookingId: Types.ObjectId | null = null

    try {
      const booking = await BookingModel.create({
        studentId,
        teacherId: resolved.teacherUser._id,
        teacherProfileId: resolved.profile._id,
        availabilitySlotId: claimedSlot._id,
        subjectId: resolved.subject._id,
        topicIds:
          input.topicId && !resolved.isCustomTopic ? [input.topicId] : [],
        topicName: input.topicName.trim(),
        doubtPollId: input.doubtPollId,
        doubtText: resolved.doubtPoll.title,
        studentGrade: resolved.doubtPoll.gradeLevel,
        isCustomTopic: resolved.isCustomTopic,
        studentNote: input.studentNote?.trim() ?? '',
        scheduledAt: resolved.scheduledAt,
        endAt: resolved.endAt,
        durationMinutes: Math.max(
          1,
          Math.round(
            (resolved.endAt.getTime() - resolved.scheduledAt.getTime()) / 60000,
          ),
        ),
        timezone:
          resolved.slot.timezone ?? resolved.profile.timezone ?? 'Asia/Kolkata',
        status: 'pending',
        paymentStatus: 'paid',
      })

      bookingId = booking._id

      const fee = await FeeModel.create({
        studentId,
        teacherId: resolved.teacherUser._id,
        bookingId: booking._id,
        amount: resolved.amount,
        platformFee: resolved.platformFee,
        platformCommission: resolved.platformFee,
        teacherEarning: resolved.amount,
        totalAmount: resolved.totalAmount,
        currency: 'INR',
        status: 'paid',
        paymentMethod: input.paymentMethod,
        paymentGateway: 'demo',
        gatewayOrderId: `demo_order_${String(booking._id)}`,
        gatewayPaymentId: `demo_payment_${Date.now()}`,
        paidAt: new Date(),
      })

      fee.receiptUrl = createReceiptUrl(String(fee._id))
      await fee.save()

      booking.feeId = fee._id
      await booking.save()

      claimedSlot.bookingId = booking._id
      await claimedSlot.save()
      await doubtPollService.linkBooking(input.doubtPollId, booking._id)

      return this.buildBookingResult(booking._id)
    } catch (error) {
      if (bookingId) {
        await BookingModel.deleteOne({ _id: bookingId }).catch(() => undefined)
        await FeeModel.deleteOne({ bookingId }).catch(() => undefined)
      }
      await AvailabilityModel.updateOne(
        { _id: claimedSlot._id },
        { $set: { isBooked: false, bookingId: null } },
      ).catch(() => undefined)
      throw error
    }
  }

  async createRazorpayOrder(studentId: string, input: CreateBookingInput) {
    if (env.PAYMENT_PROVIDER !== 'razorpay') {
      throw new AppError(
        409,
        'Razorpay checkout is not active. Set PAYMENT_PROVIDER=razorpay.',
        'RAZORPAY_NOT_ACTIVE',
      )
    }

    const student = await this.getStudent(studentId)
    const resolved = await this.resolveCheckout(studentId, input)
    const receipt = `edv_${Date.now()}_${studentId.slice(-6)}`

    const order = await razorpayService.createOrder({
      amountPaise: Math.round(resolved.totalAmount * 100),
      currency: 'INR',
      receipt,
      notes: {
        studentId,
        teacherProfileId: String(resolved.profile._id),
        subjectId: String(resolved.subject._id),
        topicName: input.topicName.trim(),
        doubtPollId: input.doubtPollId,
        doubtText: resolved.doubtPoll.title,
        studentGrade: resolved.doubtPoll.gradeLevel,
        slotId: input.slotId,
      },
    })

    const claimedSlot = await AvailabilityModel.findOneAndUpdate(
      {
        _id: input.slotId,
        teacherId: resolved.teacherUser._id,
        isBooked: false,
        isBlocked: false,
      },
      { $set: { isBooked: true } },
      { new: true },
    )

    if (!claimedSlot) {
      throw new AppError(
        409,
        'This time slot was booked by another student. Please choose another time.',
        'SLOT_UNAVAILABLE',
      )
    }

    let bookingId: Types.ObjectId | null = null

    try {
      const paymentExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
      const booking = await BookingModel.create({
        studentId,
        teacherId: resolved.teacherUser._id,
        teacherProfileId: resolved.profile._id,
        availabilitySlotId: claimedSlot._id,
        subjectId: resolved.subject._id,
        topicIds:
          input.topicId && !resolved.isCustomTopic ? [input.topicId] : [],
        topicName: input.topicName.trim(),
        doubtPollId: input.doubtPollId,
        doubtText: resolved.doubtPoll.title,
        studentGrade: resolved.doubtPoll.gradeLevel,
        isCustomTopic: resolved.isCustomTopic,
        studentNote: input.studentNote?.trim() ?? '',
        scheduledAt: resolved.scheduledAt,
        endAt: resolved.endAt,
        durationMinutes: Math.max(
          1,
          Math.round(
            (resolved.endAt.getTime() - resolved.scheduledAt.getTime()) / 60000,
          ),
        ),
        timezone:
          resolved.slot.timezone ?? resolved.profile.timezone ?? 'Asia/Kolkata',
        status: 'pending',
        paymentStatus: 'pending',
        paymentExpiresAt,
      })

      bookingId = booking._id

      const fee = await FeeModel.create({
        studentId,
        teacherId: resolved.teacherUser._id,
        bookingId: booking._id,
        amount: resolved.amount,
        platformFee: resolved.platformFee,
        platformCommission: resolved.platformFee,
        teacherEarning: resolved.amount,
        totalAmount: resolved.totalAmount,
        currency: 'INR',
        status: 'pending',
        paymentMethod: input.paymentMethod,
        paymentGateway: 'razorpay',
        gatewayOrderId: order.id,
        dueDate: paymentExpiresAt,
      })

      fee.receiptUrl = createReceiptUrl(String(fee._id))
      await fee.save()

      booking.feeId = fee._id
      await booking.save()

      claimedSlot.bookingId = booking._id
      await claimedSlot.save()
      await doubtPollService.linkBooking(input.doubtPollId, booking._id)

      return {
        provider: 'razorpay' as const,
        keyId: razorpayService.getPublicKeyId(),
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        bookingId: String(booking._id),
        expiresAt: paymentExpiresAt.toISOString(),
        prefill: {
          name: student.name,
          email: student.email,
        },
      }
    } catch (error) {
      if (bookingId) {
        await BookingModel.deleteOne({ _id: bookingId }).catch(() => undefined)
        await FeeModel.deleteOne({ bookingId }).catch(() => undefined)
      }
      await AvailabilityModel.updateOne(
        { _id: claimedSlot._id },
        { $set: { isBooked: false, bookingId: null } },
      ).catch(() => undefined)
      throw error
    }
  }

  private async finalizeCapturedPayment(
    orderId: string,
    payment: RazorpayPayment,
    signature: string,
    studentId?: string,
  ) {
    const fee = await FeeModel.findOne({
      gatewayOrderId: orderId,
      paymentGateway: 'razorpay',
      ...(studentId ? { studentId } : {}),
    })

    if (!fee) {
      throw new AppError(404, 'Payment order not found', 'PAYMENT_ORDER_NOT_FOUND')
    }

    if (fee.status === 'paid') {
      return this.buildBookingResult(fee.bookingId)
    }

    if (payment.order_id !== orderId) {
      throw new AppError(422, 'Payment order mismatch', 'PAYMENT_ORDER_MISMATCH')
    }

    if (payment.amount !== Math.round(fee.totalAmount * 100)) {
      throw new AppError(422, 'Payment amount mismatch', 'PAYMENT_AMOUNT_MISMATCH')
    }

    if (payment.currency !== fee.currency) {
      throw new AppError(
        422,
        'Payment currency mismatch',
        'PAYMENT_CURRENCY_MISMATCH',
      )
    }

    if (payment.status !== 'captured' && payment.captured !== true) {
      throw new AppError(
        409,
        'Payment has not been captured yet. Please wait and try again.',
        'PAYMENT_NOT_CAPTURED',
      )
    }

    const booking = await BookingModel.findOne({
      _id: fee.bookingId,
      ...(studentId ? { studentId } : {}),
    })

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND')
    }

    fee.status = 'paid'
    fee.paymentMethod = normalizePaymentMethod(payment.method)
    fee.gatewayPaymentId = payment.id
    fee.gatewaySignature = signature
    fee.paidAt = new Date()
    fee.failedAt = null
    fee.failureReason = null
    await fee.save()

    booking.status = 'pending'
    booking.paymentStatus = 'paid'
    booking.paymentExpiresAt = null
    await booking.save()

    return this.buildBookingResult(booking._id)
  }

  async verifyRazorpayPayment(studentId: string, input: VerifyPaymentInput) {
    if (env.PAYMENT_PROVIDER !== 'razorpay') {
      throw new AppError(409, 'Razorpay checkout is not active', 'RAZORPAY_NOT_ACTIVE')
    }

    const validSignature = razorpayService.verifyPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    })

    if (!validSignature) {
      throw new AppError(
        400,
        'Razorpay payment signature is invalid',
        'INVALID_PAYMENT_SIGNATURE',
      )
    }

    const payment = await razorpayService.fetchPayment(input.razorpayPaymentId)

    return this.finalizeCapturedPayment(
      input.razorpayOrderId,
      payment,
      input.razorpaySignature,
      studentId,
    )
  }

  async cancelRazorpayPayment(
    studentId: string,
    input: { orderId: string; reason?: string },
  ) {
    const fee = await FeeModel.findOne({
      studentId,
      gatewayOrderId: input.orderId,
      paymentGateway: 'razorpay',
    })

    if (!fee || fee.status === 'paid') {
      return { released: false }
    }

    const booking = await BookingModel.findOne({
      _id: fee.bookingId,
      studentId,
      paymentStatus: 'pending',
    })

    if (!booking) {
      return { released: false }
    }

    fee.status = 'failed'
    fee.failedAt = new Date()
    fee.failureReason = input.reason?.trim() || 'Checkout closed before payment'
    await fee.save()

    booking.status = 'cancelled'
    booking.paymentStatus = 'failed'
    booking.cancelledBy = 'student'
    booking.cancellationReason = fee.failureReason
    booking.cancelledAt = new Date()
    booking.paymentExpiresAt = null
    await booking.save()

    await AvailabilityModel.updateOne(
      { _id: booking.availabilitySlotId, bookingId: booking._id },
      { $set: { isBooked: false, bookingId: null } },
    )

    return { released: true }
  }

  async processRazorpayWebhook(rawBody: Buffer, signature: string) {
    const valid = razorpayService.verifyWebhookSignature(rawBody, signature)
    if (!valid) {
      throw new AppError(
        400,
        'Invalid Razorpay webhook signature',
        'INVALID_WEBHOOK_SIGNATURE',
      )
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string
      payload?: {
        payment?: { entity?: RazorpayPayment }
      }
    }

    const payment = event.payload?.payment?.entity
    if (event.event === 'payment.captured' && payment?.order_id) {
      await this.finalizeCapturedPayment(
        payment.order_id,
        payment,
        'verified-by-webhook',
      )
    }

    return { received: true }
  }
}

export const bookingService = new BookingService()
