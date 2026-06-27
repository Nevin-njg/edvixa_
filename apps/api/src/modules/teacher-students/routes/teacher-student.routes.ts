import { Router } from 'express'

import { authenticate } from '../../../middlewares/auth.middleware.js'
import { authorizeRoles } from '../../../middlewares/role.middleware.js'
import { validate } from '../../../middlewares/validate.middleware.js'
import { asyncHandler } from '../../../shared/http/async-handler.js'
import * as controller from '../controllers/teacher-student.controller.js'
import {
  listTeacherStudentsSchema,
  teacherStudentDetailsSchema,
  updateTeacherStudentNoteSchema,
} from '../validators/teacher-student.validator.js'

export const teacherStudentRouter = Router()

teacherStudentRouter.use(authenticate, authorizeRoles('teacher'))
teacherStudentRouter.get(
  '/',
  validate(listTeacherStudentsSchema),
  asyncHandler(controller.list),
)
teacherStudentRouter.get(
  '/:studentId',
  validate(teacherStudentDetailsSchema),
  asyncHandler(controller.details),
)
teacherStudentRouter.patch(
  '/:studentId/note',
  validate(updateTeacherStudentNoteSchema),
  asyncHandler(controller.updateNote),
)
