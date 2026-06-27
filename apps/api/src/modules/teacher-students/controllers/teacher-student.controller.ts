import type { Request, Response } from 'express'

import { teacherStudentService } from '../services/teacher-student.service.js'

export async function list(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherStudentService.list(req.user!.id, req.query),
  })
}

export async function details(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherStudentService.details(
      req.user!.id,
      String(req.params.studentId),
    ),
  })
}

export async function updateNote(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherStudentService.updateNote(
      req.user!.id,
      String(req.params.studentId),
      req.body,
    ),
  })
}
