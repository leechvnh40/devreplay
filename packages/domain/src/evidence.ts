import type { SourceType } from './provenance'

export const CAPABILITY_STATES = ['unknown', 'pending', 'weak', 'basic', 'stable'] as const
export type CapabilityState = (typeof CAPABILITY_STATES)[number]

export interface EvidenceEntry {
  readonly id: string
  readonly capabilityId: string
  readonly sourceType: SourceType | 'confirmed_diagnosis'
  readonly polarity: 'positive' | 'negative' | 'neutral'
  readonly strength: 1 | 2 | 3
  readonly content: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly interviewId?: string
  readonly supersedesId?: string
  readonly retractsId?: string
}

export interface CapabilityProjection {
  readonly capabilityId: string
  readonly state: CapabilityState
  readonly supportingEvidenceIds: readonly string[]
  readonly challengingEvidenceIds: readonly string[]
  readonly activeEvidenceIds: readonly string[]
  readonly lastVerifiedAt?: string
  readonly history: readonly EvidenceEntry[]
}

export function createEvidenceEntry(input: EvidenceEntry): EvidenceEntry {
  if (input.supersedesId && input.retractsId) {
    throw new Error('一条证据不能同时修正和撤销其他证据')
  }
  if (input.strength < 1 || input.strength > 3) throw new Error('证据强度必须为 1 到 3')
  return Object.freeze({ ...input, content: Object.freeze({ ...input.content }) })
}

export function rebuildCapabilityProjection(
  capabilityId: string,
  history: readonly EvidenceEntry[]
): CapabilityProjection {
  const relevant = history.filter((entry) => entry.capabilityId === capabilityId)
  const invalidated = new Set(
    relevant.flatMap((entry) => [entry.supersedesId, entry.retractsId]).filter(Boolean) as string[]
  )
  const active = relevant.filter(
    (entry) => !invalidated.has(entry.id) && entry.polarity !== 'neutral'
  )
  const supporting = active.filter((entry) => entry.polarity === 'positive')
  const challenging = active.filter((entry) => entry.polarity === 'negative')
  const stableEligibleSupporting = supporting.filter(
    (entry) => entry.sourceType === 'spaced_retest' || entry.sourceType === 'real_interview'
  )
  const score =
    supporting.reduce((sum, entry) => sum + entry.strength, 0) -
    challenging.reduce((sum, entry) => sum + entry.strength, 0)
  const state: CapabilityState =
    active.length === 0
      ? 'unknown'
      : score >= 5 && supporting.length >= 2 && stableEligibleSupporting.length > 0
        ? 'stable'
        : score >= 2
          ? 'basic'
          : score <= -2
            ? 'weak'
            : 'pending'
  const lastVerifiedAt = active
    .map((entry) => entry.createdAt)
    .sort()
    .at(-1)

  return Object.freeze({
    capabilityId,
    state,
    supportingEvidenceIds: Object.freeze(supporting.map((entry) => entry.id)),
    challengingEvidenceIds: Object.freeze(challenging.map((entry) => entry.id)),
    activeEvidenceIds: Object.freeze(active.map((entry) => entry.id)),
    ...(lastVerifiedAt ? { lastVerifiedAt } : {}),
    history: Object.freeze([...relevant])
  })
}

export function appendToCapabilityProjection(
  projection: CapabilityProjection,
  entry: EvidenceEntry
): CapabilityProjection {
  if (projection.capabilityId !== entry.capabilityId) throw new Error('证据与能力节点不匹配')
  return rebuildCapabilityProjection(projection.capabilityId, [...projection.history, entry])
}

export function emptyCapabilityProjection(capabilityId: string): CapabilityProjection {
  return rebuildCapabilityProjection(capabilityId, [])
}
