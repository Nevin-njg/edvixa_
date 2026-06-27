import type { Request, Response } from 'express'

import { teacherBookingService } from '../services/teacher-booking.service.js'

export async function list(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherBookingService.list(
      req.user!.id,
      req.query as {
        status?: 'all' | 'pending' | 'upcoming' | 'completed' | 'rejected' | 'cancelled'
        search?: string
        page?: string
        limit?: string
      },
    ),
  })
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherBookingService.getById(
      req.user!.id,
      String(req.params.id),
    ),
  })
}

export async function accept(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherBookingService.accept(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  })
}

export async function decline(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherBookingService.decline(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  })
}

export async function suggestSlot(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherBookingService.suggestSlot(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  })
}
