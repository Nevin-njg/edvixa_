import { Router } from 'express'

import { authenticate } from '../../../middlewares/auth.middleware.js'
import { authorizeRoles } from '../../../middlewares/role.middleware.js'
import { validate } from '../../../middlewares/validate.middleware.js'
import { asyncHandler } from '../../../shared/http/async-handler.js'
import * as controller from '../controllers/teacher-earnings.controller.js'
import {
  teacherEarningsListSchema,
  teacherEarningsStatementSchema,
} from '../validators/teacher-earnings.validator.js'

export const teacherEarningsRouter = Router()

teacherEarningsRouter.use(authenticate, authorizeRoles('teacher'))

teacherEarningsRouter.get(
  '/statement',
  validate(teacherEarningsStatementSchema),
  asyncHandler(controller.statement),
)

teacherEarningsRouter.get(
  '/',
  validate(teacherEarningsListSchema),
  asyncHandler(controller.list),
)
