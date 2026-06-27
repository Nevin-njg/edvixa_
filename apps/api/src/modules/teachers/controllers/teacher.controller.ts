import type { Request, Response } from 'express'

import { teacherAvailabilityService } from '../services/teacher-availability.service.js'
import { teacherDashboardService } from '../services/teacher-dashboard.service.js'
import { teacherDiscoveryService } from '../services/teacher-discovery.service.js'
import { teacherProfileService } from '../services/teacher-profile.service.js'

export async function dashboard(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherDashboardService.getDashboard(req.user!.id),
  })
}


export async function getProfile(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherProfileService.getProfile(req.user!.id),
  })
}

export async function updateProfile(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({
    success: true,
    message: req.body.submitForReview
      ? 'Teacher profile submitted for review'
      : 'Teacher profile updated successfully',
    data: await teacherProfileService.updateProfile(req.user!.id, req.body),
  })
}

export async function listPublic(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await teacherDiscoveryService.list(
      req.query as Record<string, string | undefined>,
    ),
  })
}

export async function getPublicProfile(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({
    success: true,
    data: await teacherDiscoveryService.getPublicProfile(String(req.params.id)),
  })
}

export async function listAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({
    success: true,
    data: await teacherAvailabilityService.list(
      req.user!.id,
      req.query as { start?: string; end?: string },
    ),
  })
}

export async function createAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await teacherAvailabilityService.create(req.user!.id, req.body)
  res.status(201).json({ success: true, data })
}

export async function createRecurringAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await teacherAvailabilityService.createRecurring(
    req.user!.id,
    req.body,
  )
  res.status(201).json({ success: true, data })
}

export async function updateAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({
    success: true,
    data: await teacherAvailabilityService.update(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  })
}

export async function deleteAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({
    success: true,
    data: await teacherAvailabilityService.remove(
      req.user!.id,
      String(req.params.id),
    ),
  })
}

export async function blockAvailabilityDate(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await teacherAvailabilityService.blockDate(
    req.user!.id,
    req.body,
  )
  res.status(201).json({ success: true, data })
}

export async function copyAvailabilityWeek(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await teacherAvailabilityService.copyWeek(req.user!.id, req.body)
  res.status(201).json({ success: true, data })
}
