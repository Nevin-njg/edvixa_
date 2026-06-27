import type { Request, Response } from 'express'

import { teacherEarningsService } from '../services/teacher-earnings.service.js'

type EarningsQuery = {
  period?: '7d' | '30d' | '90d' | 'year' | 'all'
  status?: 'all' | 'paid' | 'pending' | 'failed' | 'refunded'
  payoutStatus?: 'all' | 'pending' | 'approved' | 'paid' | 'failed'
  search?: string
  page?: string | number
  limit?: string | number
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherEarningsService.list(
      req.user!.id,
      req.query as EarningsQuery,
    ),
  })
}

export async function statement(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherEarningsService.statement(
      req.user!.id,
      req.query as EarningsQuery,
    ),
  })
}
