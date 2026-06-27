import { Router } from 'express'

import { authenticate } from '../../../middlewares/auth.middleware.js'
import { authorizeRoles } from '../../../middlewares/role.middleware.js'
import { validate } from '../../../middlewares/validate.middleware.js'
import { asyncHandler } from '../../../shared/http/async-handler.js'
import * as controller from '../controllers/teacher-booking.controller.js'
import {
  teacherBookingAcceptSchema,
  teacherBookingDeclineSchema,
  teacherBookingIdSchema,
  teacherBookingListSchema,
  teacherBookingSuggestSlotSchema,
} from '../validators/teacher-booking.validator.js'

export const teacherBookingRouter = Router()

teacherBookingRouter.use(authenticate, authorizeRoles('teacher'))

teacherBookingRouter.get(
  '/',
  validate(teacherBookingListSchema),
  asyncHandler(controller.list),
)

teacherBookingRouter.get(
  '/:id',
  validate(teacherBookingIdSchema),
  asyncHandler(controller.getById),
)

teacherBookingRouter.patch(
  '/:id/accept',
  validate(teacherBookingAcceptSchema),
  asyncHandler(controller.accept),
)

teacherBookingRouter.patch(
  '/:id/decline',
  validate(teacherBookingDeclineSchema),
  asyncHandler(controller.decline),
)

teacherBookingRouter.patch(
  '/:id/suggest-slot',
  validate(teacherBookingSuggestSlotSchema),
  asyncHandler(controller.suggestSlot),
)
