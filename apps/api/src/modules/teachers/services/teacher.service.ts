import { AppError } from '../../../shared/errors/app-error.js'
import { TeacherProfileModel } from '../models/teacher-profile.model.js'

class TeacherService {
  async dashboard(userId: string) {
    const profile = await TeacherProfileModel.findOne({ userId }).populate('subjects', 'name slug').lean()
    if (!profile) throw new AppError(404, 'Teacher profile not found', 'TEACHER_PROFILE_NOT_FOUND')
    const applicationStatus = profile.isApproved
      ? 'approved'
      : profile.approvalStatus === 'rejected'
        ? 'rejected'
        : profile.submittedAt
          ? 'pending'
          : 'draft'
    return {
      profile,
      applicationStatus,
      todaySessions: [],
      upcomingSessions: [],
      pendingRequests: 0,
    }
  }
  async listPublic() {
    return TeacherProfileModel.find({ isApproved: true }).populate('userId', 'name avatar').populate('subjects', 'name slug').sort({ rating: -1 }).lean()
  }
}
export const teacherService = new TeacherService()
