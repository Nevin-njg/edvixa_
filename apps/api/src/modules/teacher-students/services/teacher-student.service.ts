import { Types } from 'mongoose'

import { AppError } from '../../../shared/errors/app-error.js'
import { BookingModel } from '../../bookings/models/booking.model.js'
import { DoubtPollModel } from '../../doubt-polls/models/doubt-poll.model.js'
import { FeeModel } from '../../fees/models/fee.model.js'
import { PracticeSessionModel } from '../../practice/models/practice-session.model.js'
import { StudentProfileModel } from '../../students/models/student-profile.model.js'
import { TeacherProfileModel } from '../../teachers/models/teacher-profile.model.js'
import { UserModel } from '../../users/models/user.model.js'
import { TeacherStudentNoteModel } from '../models/teacher-student-note.model.js'

type ListInput = {
  search?: string
  status?: 'all' | 'upcoming' | 'completed' | 'inactive'
  grade?: string
  subjectId?: string
  page?: string | number
  limit?: string | number
}

type UserRef = {
  _id: Types.ObjectId
  name: string
  email: string
  avatar?: string | null
  phone?: string | null
}

type SubjectRef = {
  _id: Types.ObjectId
  name: string
}

type DoubtRef = {
  _id: Types.ObjectId
  title: string
  description?: string
  status?: string
  voteCount?: number
  commentCount?: number
  topicName?: string
}

type BookingLean = {
  _id: Types.ObjectId
  studentId: UserRef | Types.ObjectId
  subjectId: SubjectRef | Types.ObjectId
  doubtPollId?: DoubtRef | Types.ObjectId | null
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
  meetingLink?: string | null
  createdAt: Date
}

type StudentProfileLean = {
  _id: Types.ObjectId
  userId: Types.ObjectId
  gradeLevel?: string | null
  level?: number
  xp?: number
  streak?: number
  averageScore?: number
  accuracyPercent?: number
  totalTestsTaken?: number
  totalPracticeSessions?: number
  totalPracticeTime?: number
  learningGoal?: string | null
  topicMastery?: Array<{
    topicId: Types.ObjectId
    topicName: string
    masteryScore: number
    attemptCount: number
    correctCount: number
    wrongCount: number
    lastAttemptAt?: Date | null
  }>
}

type PracticeAggregate = {
  _id: Types.ObjectId
  sessions: number
  averageAccuracy: number
  latestCompletedAt?: Date | null
  totalSeconds: number
}

type NoteLean = {
  _id: Types.ObjectId
  studentId: Types.ObjectId
  note?: string
  tags?: string[]
  updatedAt: Date
}

type FeeLean = {
  bookingId: Types.ObjectId
  totalAmount?: number
  amount?: number
  status?: string
}

const ACTIVE_STATUSES = ['accepted', 'upcoming', 'rescheduled'] as const
const BOOKING_STATUSES = [
  'accepted',
  'upcoming',
  'rescheduled',
  'completed',
  'cancelled',
  'rejected',
] as const

function userRef(value: unknown): UserRef | null {
  if (value && typeof value === 'object' && '_id' in value && 'name' in value) {
    return value as UserRef
  }
  return null
}

function subjectRef(value: unknown): SubjectRef | null {
  if (value && typeof value === 'object' && '_id' in value && 'name' in value) {
    return value as SubjectRef
  }
  return null
}

function doubtRef(value: unknown): DoubtRef | null {
  if (value && typeof value === 'object' && '_id' in value && 'title' in value) {
    return value as DoubtRef
  }
  return null
}

function isActiveStatus(status: string) {
  return (ACTIVE_STATUSES as readonly string[]).includes(status)
}

function round(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 10) / 10
}

class TeacherStudentService {
  private async approvedTeacher(userId: string) {
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
        'Your teacher profile must be approved before viewing students',
        'TEACHER_NOT_APPROVED',
      )
    }

    return profile
  }

  async list(userId: string, input: ListInput) {
    await this.approvedTeacher(userId)

    const page = Math.max(1, Number(input.page) || 1)
    const limit = Math.min(30, Math.max(4, Number(input.limit) || 10))
    const search = String(input.search ?? '').trim().toLowerCase()
    const status = input.status ?? 'all'
    const grade = String(input.grade ?? '').trim()
    const subjectId = String(input.subjectId ?? '').trim()
    const teacherId = new Types.ObjectId(userId)
    const now = Date.now()

    const bookings = (await BookingModel.find({
      teacherId,
      status: { $in: BOOKING_STATUSES },
    })
      .populate('studentId', 'name email avatar phone')
      .populate('subjectId', 'name')
      .sort({ scheduledAt: -1 })
      .lean()) as unknown as BookingLean[]

    const studentIds = [
      ...new Set(bookings.map((booking) => String(booking.studentId instanceof Types.ObjectId ? booking.studentId : booking.studentId._id))),
    ].map((id) => new Types.ObjectId(id))

    if (studentIds.length === 0) {
      return {
        summary: {
          totalStudents: 0,
          activeStudents: 0,
          upcomingLessons: 0,
          completedLessons: 0,
          averagePracticeScore: 0,
        },
        filters: { grades: [], subjects: [] },
        items: [],
        pagination: { page, limit, total: 0, pages: 1 },
      }
    }

    const [profiles, practice, notes] = await Promise.all([
      StudentProfileModel.find({ userId: { $in: studentIds } }).lean(),
      PracticeSessionModel.aggregate<PracticeAggregate>([
        {
          $match: {
            studentId: { $in: studentIds },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$studentId',
            sessions: { $sum: 1 },
            averageAccuracy: { $avg: '$accuracyPercent' },
            latestCompletedAt: { $max: '$completedAt' },
            totalSeconds: { $sum: '$timeTakenSeconds' },
          },
        },
      ]),
      TeacherStudentNoteModel.find({
        teacherId,
        studentId: { $in: studentIds },
      }).lean(),
    ])

    const profileByStudent = new Map(
      (profiles as unknown as StudentProfileLean[]).map((profile) => [
        String(profile.userId),
        profile,
      ]),
    )
    const practiceByStudent = new Map(
      practice.map((entry) => [String(entry._id), entry]),
    )
    const noteByStudent = new Map(
      (notes as unknown as NoteLean[]).map((note) => [
        String(note.studentId),
        note,
      ]),
    )

    const grouped = new Map<string, BookingLean[]>()
    for (const booking of bookings) {
      const student = userRef(booking.studentId)
      const key = String(student?._id ?? booking.studentId)
      const current = grouped.get(key) ?? []
      current.push(booking)
      grouped.set(key, current)
    }

    const items = [...grouped.entries()].map(([studentId, studentBookings]) => {
      const first = studentBookings[0]!
      const student = userRef(first.studentId)
      const profile = profileByStudent.get(studentId)
      const practiceStats = practiceByStudent.get(studentId)
      const note = noteByStudent.get(studentId)
      const subjects = new Map<string, string>()

      for (const booking of studentBookings) {
        const subject = subjectRef(booking.subjectId)
        subjects.set(
          String(subject?._id ?? booking.subjectId),
          subject?.name ?? 'Subject',
        )
      }

      const active = studentBookings
        .filter(
          (booking) =>
            isActiveStatus(booking.status) &&
            booking.endAt.getTime() >= now,
        )
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      const completed = studentBookings
        .filter((booking) => booking.status === 'completed')
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
      const cancelled = studentBookings.filter((booking) =>
        ['cancelled', 'rejected'].includes(booking.status),
      )
      const latestGrade =
        studentBookings.find((booking) => booking.studentGrade)?.studentGrade ??
        profile?.gradeLevel ??
        null
      const weakTopics = [...(profile?.topicMastery ?? [])]
        .filter((topic) => Number(topic.attemptCount) > 0)
        .sort(
          (left, right) =>
            Number(left.masteryScore) - Number(right.masteryScore),
        )
        .slice(0, 3)
        .map((topic) => ({
          name: topic.topicName,
          mastery: round(Number(topic.masteryScore)),
        }))

      return {
        id: studentId,
        name: student?.name ?? 'Student',
        email: student?.email ?? '',
        avatar: student?.avatar ?? null,
        phone: student?.phone ?? null,
        grade: latestGrade,
        subjects: [...subjects.entries()].map(([id, name]) => ({ id, name })),
        engagement:
          active.length > 0
            ? ('upcoming' as const)
            : completed.length > 0
              ? ('completed' as const)
              : ('inactive' as const),
        sessions: {
          total: studentBookings.length,
          upcoming: active.length,
          completed: completed.length,
          cancelled: cancelled.length,
          nextAt: active[0]?.scheduledAt.toISOString() ?? null,
          lastAt: completed[0]?.scheduledAt.toISOString() ?? null,
        },
        practice: {
          sessions:
            Number(practiceStats?.sessions) ||
            Number(profile?.totalPracticeSessions) ||
            0,
          averageScore: round(
            Number(practiceStats?.averageAccuracy) ||
              Number(profile?.averageScore) ||
              0,
          ),
          latestAt:
            practiceStats?.latestCompletedAt?.toISOString?.() ?? null,
        },
        weakTopics,
        note: {
          text: note?.note ?? '',
          tags: note?.tags ?? [],
          updatedAt: note?.updatedAt?.toISOString?.() ?? null,
        },
      }
    })

    const gradeOptions = [...new Set(items.map((item) => item.grade).filter(Boolean))]
      .map(String)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const subjectOptions = new Map<string, string>()
    for (const item of items) {
      for (const subject of item.subjects) subjectOptions.set(subject.id, subject.name)
    }

    const filtered = items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.email.toLowerCase().includes(search) ||
        String(item.grade ?? '').toLowerCase().includes(search) ||
        item.subjects.some((subject) => subject.name.toLowerCase().includes(search))
      const matchesStatus = status === 'all' || item.engagement === status
      const matchesGrade = !grade || item.grade === grade
      const matchesSubject =
        !subjectId || item.subjects.some((subject) => subject.id === subjectId)
      return matchesSearch && matchesStatus && matchesGrade && matchesSubject
    })

    filtered.sort((left, right) => {
      if (left.sessions.nextAt && right.sessions.nextAt) {
        return (
          new Date(left.sessions.nextAt).getTime() -
          new Date(right.sessions.nextAt).getTime()
        )
      }
      if (left.sessions.nextAt) return -1
      if (right.sessions.nextAt) return 1
      return left.name.localeCompare(right.name)
    })

    const total = filtered.length
    const paginated = filtered.slice((page - 1) * limit, page * limit)
    const scores = items
      .map((item) => item.practice.averageScore)
      .filter((score) => score > 0)

    return {
      summary: {
        totalStudents: items.length,
        activeStudents: items.filter((item) => item.sessions.upcoming > 0).length,
        upcomingLessons: items.reduce(
          (sum, item) => sum + item.sessions.upcoming,
          0,
        ),
        completedLessons: items.reduce(
          (sum, item) => sum + item.sessions.completed,
          0,
        ),
        averagePracticeScore: round(
          scores.length
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : 0,
        ),
      },
      filters: {
        grades: gradeOptions,
        subjects: [...subjectOptions.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
      items: paginated,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    }
  }

  async details(userId: string, studentId: string) {
    await this.approvedTeacher(userId)

    const teacherObjectId = new Types.ObjectId(userId)
    const studentObjectId = new Types.ObjectId(studentId)
    const bookingExists = await BookingModel.exists({
      teacherId: teacherObjectId,
      studentId: studentObjectId,
      status: { $in: BOOKING_STATUSES },
    })

    if (!bookingExists) {
      throw new AppError(
        404,
        'This student has no teaching history with you',
        'TEACHER_STUDENT_NOT_FOUND',
      )
    }

    const [student, profile, bookings, practiceSessions, note] =
      await Promise.all([
        UserModel.findOne({
          _id: studentObjectId,
          role: 'student',
          isActive: true,
        })
          .select('name email avatar phone')
          .lean(),
        StudentProfileModel.findOne({ userId: studentObjectId }).lean(),
        BookingModel.find({
          teacherId: teacherObjectId,
          studentId: studentObjectId,
          status: { $in: BOOKING_STATUSES },
        })
          .populate('subjectId', 'name')
          .populate(
            'doubtPollId',
            'title description status voteCount commentCount topicName',
          )
          .sort({ scheduledAt: -1 })
          .lean(),
        PracticeSessionModel.find({
          studentId: studentObjectId,
          status: 'completed',
        })
          .populate('subjectId', 'name')
          .sort({ completedAt: -1 })
          .limit(20)
          .lean(),
        TeacherStudentNoteModel.findOne({
          teacherId: teacherObjectId,
          studentId: studentObjectId,
        }).lean(),
      ])

    if (!student) {
      throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND')
    }

    const typedProfile = profile as unknown as StudentProfileLean | null
    const typedBookings = bookings as unknown as BookingLean[]
    const bookingIds = typedBookings.map((booking) => booking._id)
    const fees = (await FeeModel.find({ bookingId: { $in: bookingIds } })
      .select('bookingId totalAmount amount status')
      .lean()) as unknown as FeeLean[]
    const feeByBooking = new Map(
      fees.map((fee) => [String(fee.bookingId), fee]),
    )

    const linkedDoubtIds = typedBookings
      .map((booking) => doubtRef(booking.doubtPollId)?._id)
      .filter((value): value is Types.ObjectId => Boolean(value))
    const createdDoubts = (await DoubtPollModel.find({
      $or: [
        { creatorStudentId: studentObjectId },
        { _id: { $in: linkedDoubtIds } },
      ],
    })
      .sort({ voteCount: -1, createdAt: -1 })
      .limit(20)
      .lean()) as unknown as Array<{
      _id: Types.ObjectId
      subjectName: string
      topicName: string
      title: string
      description?: string
      status: string
      voteCount?: number
      commentCount?: number
      createdAt: Date
    }>

    const sessionItems = typedBookings.map((booking) => {
      const subject = subjectRef(booking.subjectId)
      const doubt = doubtRef(booking.doubtPollId)
      const fee = feeByBooking.get(String(booking._id))
      return {
        id: String(booking._id),
        subject: subject?.name ?? 'Subject',
        chapter: booking.topicName,
        scheduledAt: booking.scheduledAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        durationMinutes: booking.durationMinutes,
        timezone: booking.timezone,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        meetingLink: booking.meetingLink ?? null,
        studentNote: booking.studentNote ?? '',
        teacherNote: booking.teacherNote ?? '',
        doubtTitle: doubt?.title ?? booking.doubtText ?? '',
        amount: Number(fee?.totalAmount ?? fee?.amount ?? 0),
      }
    })

    const practiceItems = (practiceSessions as unknown as Array<{
      _id: Types.ObjectId
      subjectId: SubjectRef | Types.ObjectId
      accuracyPercent?: number
      score?: number
      questionCount?: number
      timeTakenSeconds?: number
      completedAt?: Date | null
    }>).map((session) => {
      const subject = subjectRef(session.subjectId)
      return {
        id: String(session._id),
        subject: subject?.name ?? 'Subject',
        accuracy: round(Number(session.accuracyPercent)),
        score: round(Number(session.score)),
        questionCount: Number(session.questionCount) || 0,
        timeTakenSeconds: Number(session.timeTakenSeconds) || 0,
        completedAt: session.completedAt?.toISOString?.() ?? null,
      }
    })

    const grade =
      typedBookings.find((booking) => booking.studentGrade)?.studentGrade ??
      typedProfile?.gradeLevel ??
      null
    const subjects = new Map<string, string>()
    for (const booking of typedBookings) {
      const subject = subjectRef(booking.subjectId)
      subjects.set(
        String(subject?._id ?? booking.subjectId),
        subject?.name ?? 'Subject',
      )
    }

    return {
      student: {
        id: String(student._id),
        name: student.name,
        email: student.email,
        avatar: student.avatar ?? null,
        phone: student.phone ?? null,
        grade,
        subjects: [...subjects.entries()].map(([id, name]) => ({ id, name })),
      },
      progress: {
        level: Number(typedProfile?.level) || 1,
        xp: Number(typedProfile?.xp) || 0,
        streak: Number(typedProfile?.streak) || 0,
        averageScore: round(Number(typedProfile?.averageScore)),
        accuracy: round(Number(typedProfile?.accuracyPercent)),
        totalTests: Number(typedProfile?.totalTestsTaken) || 0,
        practiceSessions:
          Number(typedProfile?.totalPracticeSessions) || practiceItems.length,
        practiceMinutes: round(
          Number(typedProfile?.totalPracticeTime) ||
            practiceItems.reduce(
              (sum, session) => sum + session.timeTakenSeconds / 60,
              0,
            ),
        ),
        learningGoal: typedProfile?.learningGoal ?? '',
        topicMastery: [...(typedProfile?.topicMastery ?? [])]
          .sort(
            (left, right) =>
              Number(right.masteryScore) - Number(left.masteryScore),
          )
          .map((topic) => ({
            id: String(topic.topicId),
            name: topic.topicName,
            mastery: round(Number(topic.masteryScore)),
            attempts: Number(topic.attemptCount) || 0,
            correct: Number(topic.correctCount) || 0,
            wrong: Number(topic.wrongCount) || 0,
            lastAttemptAt: topic.lastAttemptAt?.toISOString?.() ?? null,
          })),
      },
      sessionSummary: {
        total: sessionItems.length,
        upcoming: sessionItems.filter(
          (session) =>
            isActiveStatus(session.status) &&
            new Date(session.endAt).getTime() >= Date.now(),
        ).length,
        completed: sessionItems.filter(
          (session) => session.status === 'completed',
        ).length,
        cancelled: sessionItems.filter((session) =>
          ['cancelled', 'rejected'].includes(session.status),
        ).length,
        totalPaid: round(
          fees
            .filter((fee) => fee.status === 'paid')
            .reduce(
              (sum, fee) => sum + Number(fee.totalAmount ?? fee.amount ?? 0),
              0,
            ),
        ),
      },
      sessions: sessionItems,
      practiceHistory: practiceItems,
      doubts: createdDoubts.map((doubt) => ({
        id: String(doubt._id),
        subject: doubt.subjectName,
        chapter: doubt.topicName,
        title: doubt.title,
        description: doubt.description ?? '',
        status: doubt.status,
        votes: Number(doubt.voteCount) || 0,
        comments: Number(doubt.commentCount) || 0,
        createdAt: doubt.createdAt.toISOString(),
      })),
      privateNote: {
        text: (note as unknown as NoteLean | null)?.note ?? '',
        tags: (note as unknown as NoteLean | null)?.tags ?? [],
        updatedAt:
          (note as unknown as NoteLean | null)?.updatedAt?.toISOString?.() ??
          null,
      },
    }
  }

  async updateNote(
    userId: string,
    studentId: string,
    input: { note: string; tags: string[] },
  ) {
    await this.approvedTeacher(userId)

    const hasRelationship = await BookingModel.exists({
      teacherId: userId,
      studentId,
      status: { $in: BOOKING_STATUSES },
    })

    if (!hasRelationship) {
      throw new AppError(
        404,
        'This student has no teaching history with you',
        'TEACHER_STUDENT_NOT_FOUND',
      )
    }

    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))]
    const note = await TeacherStudentNoteModel.findOneAndUpdate(
      { teacherId: userId, studentId },
      { $set: { note: input.note.trim(), tags } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean()

    return {
      text: note?.note ?? '',
      tags: note?.tags ?? [],
      updatedAt: note?.updatedAt?.toISOString?.() ?? null,
    }
  }
}

export const teacherStudentService = new TeacherStudentService()
