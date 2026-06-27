import { Router } from 'express'

import { authenticate } from '../../../middlewares/auth.middleware.js'
import { authorizeRoles } from '../../../middlewares/role.middleware.js'
import { validate } from '../../../middlewares/validate.middleware.js'
import { asyncHandler } from '../../../shared/http/async-handler.js'
import * as controller from '../controllers/teacher-session.controller.js'
import {
  completeTeacherSessionSchema,
  teacherSessionIdSchema,
  teacherSessionListSchema,
  updateTeacherSessionSchema,
} from '../validators/teacher-session.validator.js'

export const teacherSessionRouter = Router()

teacherSessionRouter.use(authenticate, authorizeRoles('teacher'))

teacherSessionRouter.get(
  '/',
  validate(teacherSessionListSchema),
  asyncHandler(controller.list),
)

teacherSessionRouter.get(
  '/:id',
  validate(teacherSessionIdSchema),
  asyncHandler(controller.getById),
)

teacherSessionRouter.patch(
  '/:id/details',
  validate(updateTeacherSessionSchema),
  asyncHandler(controller.updateDetails),
)

teacherSessionRouter.patch(
  '/:id/complete',
  validate(completeTeacherSessionSchema),
  asyncHandler(controller.complete),
)
