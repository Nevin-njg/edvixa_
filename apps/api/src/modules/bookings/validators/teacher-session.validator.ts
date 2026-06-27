import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID')

export const teacherSessionListSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).optional(),
  query: z.object({
    status: z
      .enum(['all', 'today', 'upcoming', 'completed', 'cancelled'])
      .optional()
      .default('all'),
    search: z.string().trim().max(100).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(5).max(30).optional().default(10),
  }),
})

export const teacherSessionIdSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})

export const updateTeacherSessionSchema = z.object({
  body: z.object({
    meetingLink: z
      .string()
      .trim()
      .url('Enter a valid meeting URL')
      .max(500)
      .optional()
      .or(z.literal('')),
    teacherNote: z.string().trim().max(1500).optional().default(''),
  }),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})

export const completeTeacherSessionSchema = z.object({
  body: z.object({
    teacherNote: z.string().trim().max(1500).optional().default(''),
  }),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})
