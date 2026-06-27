import { AppError } from '../../../shared/errors/app-error.js'
import { StudentProfileModel } from '../../students/models/student-profile.model.js'
import { SubjectModel } from '../../subjects/models/subject.model.js'
import { TeacherProfileModel } from '../../teachers/models/teacher-profile.model.js'
import { UserModel } from '../../users/models/user.model.js'

class AdminService {
  async dashboard() {
    const [students, teachers, pendingTeachers, subjects] = await Promise.all([UserModel.countDocuments({ role: 'student', deletedAt: null }), UserModel.countDocuments({ role: 'teacher', deletedAt: null }), TeacherProfileModel.countDocuments({ approvalStatus: 'pending', submittedAt: { $ne: null } }), SubjectModel.countDocuments({ isActive: true })])
    return { students, teachers, pendingTeachers, subjects, activeBookings: 0, revenue: 0 }
  }
  pendingTeachers() { return TeacherProfileModel.find({ approvalStatus: 'pending', submittedAt: { $ne: null } }).populate('userId', 'name email avatar').populate('subjects', 'name').sort({ createdAt: 1 }).lean() }
  async decideTeacher(profileId: string, adminId: string, decision: 'approved' | 'rejected', reason?: string) {
    const profile = await TeacherProfileModel.findById(profileId)
    if (!profile) throw new AppError(404, 'Teacher profile not found', 'TEACHER_PROFILE_NOT_FOUND')
    profile.approvalStatus = decision
    profile.isApproved = decision === 'approved'
    profile.rejectionReason = decision === 'rejected' ? reason ?? 'Application rejected' : null
    profile.approvedAt = decision === 'approved' ? new Date() : null
    profile.approvedBy = decision === 'approved' ? adminId as never : null
    await profile.save()
    return profile
  }
  async userDetails(userId: string) {
    const user = await UserModel.findById(userId).lean()
    if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    const profile = user.role === 'student' ? await StudentProfileModel.findOne({ userId }).lean() : user.role === 'teacher' ? await TeacherProfileModel.findOne({ userId }).lean() : null
    return { user, profile }
  }
}
export const adminService = new AdminService()
