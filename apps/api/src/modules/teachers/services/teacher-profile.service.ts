import { AppError } from '../../../shared/errors/app-error.js'
import { SubjectModel } from '../../subjects/models/subject.model.js'
import { UserModel } from '../../users/models/user.model.js'
import { TeacherProfileModel } from '../models/teacher-profile.model.js'

type TeacherDocumentInput = {
  title: string
  fileUrl: string
  fileType: string
}

type TeacherProfileUpdate = {
  name?: string
  phone?: string | null
  avatar?: string | null
  bio?: string
  teachingApproach?: string
  qualification?: string
  experienceYears?: number
  hourlyRate?: number
  timezone?: string
  subjects?: string[]
  gradeLevels?: string[]
  languages?: string[]
  documents?: TeacherDocumentInput[]
  submitForReview?: boolean
}

type PopulatedSubject = {
  _id: unknown
  name?: string
  slug?: string
  gradeLevels?: string[]
}

class TeacherProfileService {
  async getProfile(userId: string) {
    const [user, profile, activeSubjects] = await Promise.all([
      UserModel.findById(userId).lean(),
      TeacherProfileModel.findOne({ userId })
        .populate('subjects', 'name slug gradeLevels')
        .lean(),
      SubjectModel.find({ isActive: true })
        .select('name slug gradeLevels')
        .sort({ name: 1 })
        .lean(),
    ])

    if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    if (!profile) {
      throw new AppError(
        404,
        'Teacher profile not found',
        'TEACHER_PROFILE_NOT_FOUND',
      )
    }

    const completionPercent = calculateCompletion(user, profile)
    if (profile.profileCompletedPercent !== completionPercent) {
      await TeacherProfileModel.updateOne(
        { _id: profile._id },
        { $set: { profileCompletedPercent: completionPercent } },
      )
    }

    const applicationStatus = profile.isApproved
      ? 'approved'
      : profile.approvalStatus === 'rejected'
        ? 'rejected'
        : profile.submittedAt
          ? 'pending'
          : 'draft'

    return {
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        avatar: user.avatar ?? null,
        isEmailVerified: Boolean(user.isEmailVerified),
        createdAt: user.createdAt,
      },
      profile: {
        bio: profile.bio ?? '',
        teachingApproach: profile.teachingApproach ?? '',
        qualification: profile.qualification ?? '',
        experienceYears: Math.max(0, Number(profile.experienceYears) || 0),
        hourlyRate: Math.max(0, Number(profile.hourlyRate) || 0),
        timezone: profile.timezone || 'Asia/Kolkata',
        subjects: (profile.subjects ?? []).map((subject) => {
          const populated = subject as unknown as PopulatedSubject
          return {
            id: String(populated._id),
            name: populated.name || 'Subject',
            slug: populated.slug || '',
            gradeLevels: populated.gradeLevels ?? [],
          }
        }),
        gradeLevels: profile.gradeLevels ?? [],
        languages: profile.languages ?? [],
        documents: (profile.documents ?? []).map((document) => ({
          id: String(document._id),
          title: document.title,
          fileUrl: document.fileUrl,
          fileType: document.fileType,
          uploadedAt: document.uploadedAt,
          status: profile.isApproved ? 'approved' : document.status,
        })),
        applicationStatus,
        approvalStatus: profile.approvalStatus,
        isApproved: Boolean(profile.isApproved),
        rejectionReason: profile.rejectionReason ?? null,
        submittedAt: profile.submittedAt ?? null,
        approvedAt: profile.approvedAt ?? null,
        profileCompletedPercent: completionPercent,
        rating: Math.max(0, Number(profile.rating) || 0),
        totalReviews: Math.max(0, Number(profile.totalReviews) || 0),
        totalSessionsCompleted: Math.max(
          0,
          Number(profile.totalSessionsCompleted) || 0,
        ),
        totalStudentsTaught: Math.max(
          0,
          Number(profile.totalStudentsTaught) || 0,
        ),
      },
      availableSubjects: activeSubjects.map((subject) => ({
        id: String(subject._id),
        name: subject.name,
        slug: subject.slug,
        gradeLevels: subject.gradeLevels ?? [],
      })),
      options: {
        gradeLevels: Array.from({ length: 12 }, (_, index) =>
          String(index + 1),
        ),
        languages: [
          'English',
          'Hindi',
          'Malayalam',
          'Tamil',
          'Kannada',
          'Telugu',
        ],
        timezones: [
          'Asia/Kolkata',
          'Asia/Dubai',
          'Europe/London',
          'America/New_York',
        ],
      },
    }
  }

  async updateProfile(userId: string, input: TeacherProfileUpdate) {
    const profile = await TeacherProfileModel.findOne({ userId })
    if (!profile) {
      throw new AppError(
        404,
        'Teacher profile not found',
        'TEACHER_PROFILE_NOT_FOUND',
      )
    }

    if (input.subjects) {
      const subjectIds = [...new Set(input.subjects)]
      const subjectCount = await SubjectModel.countDocuments({
        _id: { $in: subjectIds },
        isActive: true,
      })
      if (subjectCount !== subjectIds.length) {
        throw new AppError(
          400,
          'One or more selected subjects are unavailable',
          'INVALID_TEACHER_SUBJECT',
        )
      }
      profile.subjects = subjectIds as never[]
    }

    const userUpdate: Record<string, unknown> = {}
    if (input.name !== undefined) userUpdate.name = input.name
    if (input.phone !== undefined) userUpdate.phone = input.phone
    if (input.avatar !== undefined) userUpdate.avatar = input.avatar

    const user =
      Object.keys(userUpdate).length > 0
        ? await UserModel.findByIdAndUpdate(
            userId,
            { $set: userUpdate },
            { new: true, runValidators: true },
          )
        : await UserModel.findById(userId)

    if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND')

    if (input.bio !== undefined) profile.bio = input.bio
    if (input.teachingApproach !== undefined) {
      profile.teachingApproach = input.teachingApproach
    }
    if (input.qualification !== undefined) {
      profile.qualification = input.qualification
    }
    if (input.experienceYears !== undefined) {
      profile.experienceYears = input.experienceYears
    }
    if (input.hourlyRate !== undefined) profile.hourlyRate = input.hourlyRate
    if (input.timezone !== undefined) profile.timezone = input.timezone
    if (input.gradeLevels !== undefined) {
      profile.gradeLevels = [...new Set(input.gradeLevels)]
    }
    if (input.languages !== undefined) {
      profile.languages = [...new Set(input.languages)]
    }

    if (input.documents !== undefined) {
      const existingByUrl = new Map(
        profile.documents.map((document) => [document.fileUrl, document]),
      )
      profile.documents = input.documents.map((document) => {
        const existing = existingByUrl.get(document.fileUrl)
        return {
          title: document.title,
          fileUrl: document.fileUrl,
          fileType: document.fileType,
          uploadedAt: existing?.uploadedAt ?? new Date(),
          status: existing?.status ?? 'pending',
        }
      }) as never
    }

    profile.profileCompletedPercent = calculateCompletion(user, profile)

    if (input.submitForReview) {
      if (profile.isApproved) {
        throw new AppError(
          409,
          'This teacher profile is already approved',
          'TEACHER_PROFILE_ALREADY_APPROVED',
        )
      }

      if (profile.profileCompletedPercent < 80) {
        throw new AppError(
          400,
          'Complete at least 80% of your profile before submitting',
          'TEACHER_PROFILE_INCOMPLETE',
        )
      }
      if (profile.documents.length === 0) {
        throw new AppError(
          400,
          'Upload at least one qualification document',
          'TEACHER_DOCUMENT_REQUIRED',
        )
      }
      if (profile.subjects.length === 0 || profile.gradeLevels.length === 0) {
        throw new AppError(
          400,
          'Select at least one subject and standard',
          'TEACHER_TEACHING_SCOPE_REQUIRED',
        )
      }

      profile.approvalStatus = 'pending'
      profile.isApproved = false
      profile.rejectionReason = null
      profile.submittedAt = new Date()
      profile.approvedAt = null
      profile.approvedBy = null
    }

    await profile.save()
    return this.getProfile(userId)
  }
}

function calculateCompletion(
  user: {
    name?: string
    phone?: string | null
    avatar?: string | null
  },
  profile: {
    bio?: string
    teachingApproach?: string
    qualification?: string
    experienceYears?: number
    hourlyRate?: number
    subjects?: unknown[]
    gradeLevels?: string[]
    languages?: string[]
    documents?: unknown[]
  },
) {
  const checks: Array<[boolean, number]> = [
    [Boolean(user.name?.trim()), 8],
    [Boolean(user.phone?.trim()), 7],
    [Boolean(user.avatar), 5],
    [Boolean(profile.qualification?.trim()), 12],
    [Boolean(profile.bio?.trim()), 10],
    [Boolean(profile.teachingApproach?.trim()), 10],
    [(Number(profile.experienceYears) || 0) > 0, 8],
    [(Number(profile.hourlyRate) || 0) >= 100, 8],
    [(profile.subjects?.length ?? 0) > 0, 10],
    [(profile.gradeLevels?.length ?? 0) > 0, 8],
    [(profile.languages?.length ?? 0) > 0, 5],
    [(profile.documents?.length ?? 0) > 0, 9],
  ]
  return Math.min(
    100,
    checks.reduce((total, [complete, weight]) => total + (complete ? weight : 0), 0),
  )
}

export const teacherProfileService = new TeacherProfileService()
