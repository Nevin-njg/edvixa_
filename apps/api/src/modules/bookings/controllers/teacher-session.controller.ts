import type { Request, Response } from 'express'

import { teacherSessionService } from '../services/teacher-session.service.js'

export async function list(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherSessionService.list(
      req.user!.id,
      req.query as {
        status?: 'all' | 'today' | 'upcoming' | 'completed' | 'cancelled'
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
    data: await teacherSessionService.getById(
      req.user!.id,
      String(req.params.id),
    ),
  })
}

export async function updateDetails(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({
    success: true,
    data: await teacherSessionService.updateDetails(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  })
}

export async function complete(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherSessionService.complete(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  })
}
