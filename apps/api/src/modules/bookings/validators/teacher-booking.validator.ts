import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID')

export const teacherBookingListSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).optional(),
  query: z.object({
    status: z
      .enum(['all', 'pending', 'upcoming', 'completed', 'rejected', 'cancelled'])
      .optional()
      .default('all'),
    search: z.string().trim().max(100).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(5).max(30).optional().default(10),
  }),
})

export const teacherBookingIdSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})

export const teacherBookingAcceptSchema = z.object({
  body: z.object({
    note: z.string().trim().max(1000).optional().default(''),
    meetingLink: z
      .string()
      .trim()
      .url('Enter a valid meeting URL')
      .max(500)
      .optional()
      .or(z.literal('')),
  }),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})

export const teacherBookingDeclineSchema = z.object({
  body: z.object({
    note: z.string().trim().min(3).max(500),
  }),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})

export const teacherBookingSuggestSlotSchema = z.object({
  body: z.object({
    slotId: objectId,
    note: z.string().trim().max(500).optional().default(''),
  }),
  params: z.object({ id: objectId }),
  query: z.object({}).optional(),
})
