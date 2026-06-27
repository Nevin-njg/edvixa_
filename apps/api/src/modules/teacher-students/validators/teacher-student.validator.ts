import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID')

export const listTeacherStudentsSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    status: z
      .enum(['all', 'upcoming', 'completed', 'inactive'])
      .optional()
      .default('all'),
    grade: z.string().trim().max(30).optional(),
    subjectId: objectId.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(4).max(30).optional().default(10),
  }),
})

export const teacherStudentDetailsSchema = z.object({
  params: z.object({ studentId: objectId }),
})

export const updateTeacherStudentNoteSchema = z.object({
  params: z.object({ studentId: objectId }),
  body: z.object({
    note: z.string().trim().max(2000).default(''),
    tags: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
  }),
})
