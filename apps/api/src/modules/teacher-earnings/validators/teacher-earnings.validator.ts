import { z } from 'zod'

const period = z
  .enum(['7d', '30d', '90d', 'year', 'all'])
  .optional()
  .default('30d')

const paymentStatus = z
  .enum(['all', 'paid', 'pending', 'failed', 'refunded'])
  .optional()
  .default('all')

const payoutStatus = z
  .enum(['all', 'pending', 'approved', 'paid', 'failed'])
  .optional()
  .default('all')

const filters = {
  period,
  status: paymentStatus,
  payoutStatus,
  search: z.string().trim().max(100).optional().default(''),
}

export const teacherEarningsListSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).optional(),
  query: z.object({
    ...filters,
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(5).max(30).optional().default(10),
  }),
})

export const teacherEarningsStatementSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).optional(),
  query: z.object(filters),
})
