import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid subject ID')

const avatar = z
  .string()
  .max(500_000, 'Profile image is too large')
  .refine(
    (value) =>
      /^https?:\/\//i.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,/i.test(value),
    'Profile image must be a URL or PNG, JPEG, or WebP upload',
  )
  .nullable()
  .optional()

const supportingDocument = z.object({
  title: z.string().trim().min(2).max(120),
  fileUrl: z
    .string()
    .max(650_000, 'Document is too large')
    .refine(
      (value) =>
        /^https?:\/\//i.test(value) ||
        /^data:(application\/pdf|image\/(png|jpeg|webp));base64,/i.test(value),
      'Document must be a PDF, PNG, JPEG, WebP, or a valid URL',
    ),
  fileType: z.string().trim().min(3).max(100),
})

export const updateTeacherProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(30).nullable().optional(),
      avatar,
      bio: z.string().trim().max(1200).optional(),
      teachingApproach: z.string().trim().max(1200).optional(),
      qualification: z.string().trim().max(250).optional(),
      experienceYears: z.number().int().min(0).max(80).optional(),
      hourlyRate: z.number().min(0).max(100_000).optional(),
      timezone: z.string().trim().min(2).max(80).optional(),
      subjects: z.array(objectId).max(12).optional(),
      gradeLevels: z
        .array(z.string().trim().min(1).max(40))
        .max(20)
        .optional(),
      languages: z
        .array(z.string().trim().min(1).max(40))
        .max(12)
        .optional(),
      documents: z.array(supportingDocument).max(2).optional(),
      submitForReview: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
})
