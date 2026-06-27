import { Schema, model } from 'mongoose'

const teacherStudentNoteSchema = new Schema(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    note: { type: String, default: '', trim: true, maxlength: 2000 },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (values: string[]) => values.length <= 6,
        message: 'A maximum of 6 tags is allowed',
      },
    },
  },
  { timestamps: true },
)

teacherStudentNoteSchema.index(
  { teacherId: 1, studentId: 1 },
  { unique: true },
)

export const TeacherStudentNoteModel = model(
  'TeacherStudentNote',
  teacherStudentNoteSchema,
)
