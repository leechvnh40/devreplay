export const SOURCE_TYPES = [
  'user_statement',
  'pasted_source',
  'agent_summary',
  'agent_inference',
  'training_verification',
  'user_revision'
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export interface Provenance {
  readonly sourceType: SourceType
  readonly sourceId: string
  readonly derivedFromIds: readonly string[]
}

export function createProvenance(input: {
  sourceType: SourceType
  sourceId: string
  derivedFromIds?: readonly string[]
}): Provenance {
  return Object.freeze({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    derivedFromIds: Object.freeze([...(input.derivedFromIds ?? [])])
  })
}
