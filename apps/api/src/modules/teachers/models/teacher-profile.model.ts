import { Schema, model } from 'mongoose'

const documentSchema = new Schema(
  {
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { _id: true },
)

const teacherProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    bio: { type: String, default: '' },
    teachingApproach: { type: String, default: '' },
    subjects: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
    qualification: { type: String, default: '' },
    experienceYears: { type: Number, default: 0, min: 0 },
    languages: { type: [String], default: [] },
    gradeLevels: { type: [String], default: [] },
    hourlyRate: { type: Number, default: 0, min: 0 },
    timezone: { type: String, default: 'Asia/Kolkata' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalSessionsCompleted: { type: Number, default: 0 },
    totalStudentsTaught: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    pendingPayout: { type: Number, default: 0 },
    bankDetails: { type: Schema.Types.Mixed, default: null, select: false },
    documents: { type: [documentSchema], default: [] },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    isApproved: { type: Boolean, default: false, index: true },
    rejectionReason: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    profileCompletedPercent: { type: Number, default: 0, min: 0, max: 100 },
    averageResponseTimeMinutes: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const TeacherProfileModel = model('TeacherProfile', teacherProfileSchema)
