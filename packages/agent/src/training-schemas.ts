import { z } from 'zod'

const commonTrainingSchema = z
  .object({
    capabilityId: z.string().min(1),
    title: z.string().min(1),
    objective: z.string().min(1),
    estimatedMinutes: z.number().int().min(15).max(30),
    retestAfterDays: z.number().int().min(1).max(90)
  })
  .strict()

const explanationContractSchema = z
  .object({
    requiredPoints: z.array(z.string().min(1)).min(1),
    allowedVariants: z.array(z.string().min(1)),
    commonMisconceptions: z.array(z.string().min(1)),
    passRule: z.string().min(1),
    maxFollowUps: z.literal(2)
  })
  .strict()

const testCaseSchema = z
  .object({
    name: z.string().min(1),
    args: z.array(z.unknown()),
    expected: z.unknown()
  })
  .strict()

const codeContractSchema = z
  .object({
    functionName: z.string().regex(/^[A-Za-z_$][\w$]*$/),
    language: z.enum(['javascript', 'typescript']),
    publicTests: z.array(testCaseSchema).min(1),
    hiddenTests: z.array(testCaseSchema).min(1),
    requiresDom: z.literal(false),
    requiresNode: z.literal(false),
    externalDependencies: z.array(z.string()).max(0),
    passRule: z.literal('all_tests')
  })
  .strict()

export const explanationTrainingSchema = commonTrainingSchema
  .extend({
    type: z.literal('explanation'),
    prompt: z.string().min(1),
    contract: explanationContractSchema
  })
  .strict()

export const codeTrainingSchema = commonTrainingSchema
  .extend({
    type: z.literal('code'),
    prompt: z.string().min(1),
    starterCode: z.string(),
    contract: codeContractSchema
  })
  .strict()

export const generatedTrainingSchema = z
  .discriminatedUnion('type', [explanationTrainingSchema, codeTrainingSchema])
  .superRefine((training, context) => {
    if (training.type !== 'code') return
    const definition = `${training.prompt}\n${training.starterCode}`
    if (
      /\b(document|window|fetch|XMLHttpRequest|process|require)\b|node:|from\s+['"]/i.test(
        definition
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: '代码训练不得依赖 DOM、Node.js、网络或外部模块'
      })
    }
  })

export type GeneratedTraining = z.infer<typeof generatedTrainingSchema>
export type ExplanationTraining = z.infer<typeof explanationTrainingSchema>
export type CodeTraining = z.infer<typeof codeTrainingSchema>
export type CodeTrainingTestCase = z.infer<typeof testCaseSchema>
