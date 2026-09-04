import { z } from 'zod'

const knownTextSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('known'), value: z.string().min(1) }).strict(),
  z.object({ status: z.literal('unknown') }).strict()
])

export const reviewExtractionSchema = z
  .object({
    questions: z.array(
      z
        .object({
          id: z.string().min(1),
          question: z.string().min(1),
          answer: knownTextSchema,
          interviewerFollowUp: knownTextSchema,
          sourceQuote: z.string().min(1)
        })
        .strict()
    ),
    overallImpression: knownTextSchema,
    uncertainties: z.array(z.string().min(1))
  })
  .strict()

export const targetedQuestionsSchema = z
  .object({
    questions: z.array(
      z
        .object({
          id: z.string().min(1),
          prompt: z.string().min(1),
          targetField: z.string().min(1),
          reason: z.string().min(1),
          stopWhenUserCannotRecall: z.literal(true)
        })
        .strict()
    )
  })
  .strict()

export type ReviewExtraction = z.infer<typeof reviewExtractionSchema>
export type TargetedQuestions = z.infer<typeof targetedQuestionsSchema>
