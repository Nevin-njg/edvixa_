import { Router } from 'express'

import { authenticate } from '../../../middlewares/auth.middleware.js'
import { authorizeRoles } from '../../../middlewares/role.middleware.js'
import { validate } from '../../../middlewares/validate.middleware.js'
import { asyncHandler } from '../../../shared/http/async-handler.js'
import * as controller from '../controllers/teacher.controller.js'
import {
  publicTeacherProfileParamsSchema,
  teacherDiscoveryQuerySchema,
} from '../validators/teacher-discovery.validator.js'
import { updateTeacherProfileSchema } from '../validators/teacher-profile.validator.js'
import {
  availabilityListSchema,
  blockAvailabilityDateSchema,
  copyAvailabilityWeekSchema,
  createAvailabilitySchema,
  createRecurringAvailabilitySchema,
  deleteAvailabilitySchema,
  updateAvailabilitySchema,
} from '../validators/teacher-availability.validator.js'

export const teacherRouter = Router()

teacherRouter.get(
  '/',
  validate(teacherDiscoveryQuerySchema),
  asyncHandler(controller.listPublic),
)

teacherRouter.get(
  '/dashboard',
  authenticate,
  authorizeRoles('teacher'),
  asyncHandler(controller.dashboard),
)


teacherRouter.get(
  '/profile',
  authenticate,
  authorizeRoles('teacher'),
  asyncHandler(controller.getProfile),
)

teacherRouter.patch(
  '/profile',
  authenticate,
  authorizeRoles('teacher'),
  validate(updateTeacherProfileSchema),
  asyncHandler(controller.updateProfile),
)


teacherRouter.get(
  '/availability',
  authenticate,
  authorizeRoles('teacher'),
  validate(availabilityListSchema),
  asyncHandler(controller.listAvailability),
)

teacherRouter.post(
  '/availability',
  authenticate,
  authorizeRoles('teacher'),
  validate(createAvailabilitySchema),
  asyncHandler(controller.createAvailability),
)

teacherRouter.post(
  '/availability/recurring',
  authenticate,
  authorizeRoles('teacher'),
  validate(createRecurringAvailabilitySchema),
  asyncHandler(controller.createRecurringAvailability),
)

teacherRouter.post(
  '/availability/block-date',
  authenticate,
  authorizeRoles('teacher'),
  validate(blockAvailabilityDateSchema),
  asyncHandler(controller.blockAvailabilityDate),
)

teacherRouter.post(
  '/availability/copy-week',
  authenticate,
  authorizeRoles('teacher'),
  validate(copyAvailabilityWeekSchema),
  asyncHandler(controller.copyAvailabilityWeek),
)

teacherRouter.patch(
  '/availability/:id',
  authenticate,
  authorizeRoles('teacher'),
  validate(updateAvailabilitySchema),
  asyncHandler(controller.updateAvailability),
)

teacherRouter.delete(
  '/availability/:id',
  authenticate,
  authorizeRoles('teacher'),
  validate(deleteAvailabilitySchema),
  asyncHandler(controller.deleteAvailability),
)

teacherRouter.get(
  '/:id',
  validate(publicTeacherProfileParamsSchema),
  asyncHandler(controller.getPublicProfile),
)
