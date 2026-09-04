import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  appendToCapabilityProjection,
  createEvidenceEntry,
  emptyCapabilityProjection,
  rebuildCapabilityProjection,
  type EvidenceEntry
} from './index'

describe('append-only evidence projection', () => {
  it('keeps corrected and retracted history while excluding invalidated evidence', () => {
    const original = entry('e-1', 'negative', 2)
    const correction = entry('e-2', 'positive', 2, { supersedesId: original.id })
    const retraction = entry('e-3', 'neutral', 1, { retractsId: correction.id })
    const projection = rebuildCapabilityProjection('javascript', [original, correction, retraction])

    expect(projection.history.map(({ id }) => id)).toEqual(['e-1', 'e-2', 'e-3'])
    expect(projection.activeEvidenceIds).toEqual([])
    expect(projection.state).toBe('unknown')
  })

  it('matches incremental projection to a full rebuild for generated evidence streams', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            polarity: fc.constantFrom('positive' as const, 'negative' as const),
            strength: fc.constantFrom(1 as const, 2 as const, 3 as const)
          }),
          { maxLength: 60 }
        ),
        (values) => {
          const history = values.map((value, index) =>
            entry(`generated-${index}`, value.polarity, value.strength)
          )
          const incremental = history.reduce(
            appendToCapabilityProjection,
            emptyCapabilityProjection('javascript')
          )
          expect(stripHistory(incremental)).toEqual(
            stripHistory(rebuildCapabilityProjection('javascript', history))
          )
        }
      )
    )
  })
})

function entry(
  id: string,
  polarity: EvidenceEntry['polarity'],
  strength: EvidenceEntry['strength'],
  relation: Pick<EvidenceEntry, 'supersedesId' | 'retractsId'> = {}
): EvidenceEntry {
  return createEvidenceEntry({
    id,
    capabilityId: 'javascript',
    sourceType: 'user_statement',
    polarity,
    strength,
    content: { summary: id },
    createdAt: `2026-09-04T00:00:${id.padStart(2, '0')}.000Z`,
    ...relation
  })
}

function stripHistory(projection: ReturnType<typeof rebuildCapabilityProjection>): unknown {
  return {
    capabilityId: projection.capabilityId,
    state: projection.state,
    supportingEvidenceIds: projection.supportingEvidenceIds,
    challengingEvidenceIds: projection.challengingEvidenceIds,
    activeEvidenceIds: projection.activeEvidenceIds,
    ...(projection.lastVerifiedAt ? { lastVerifiedAt: projection.lastVerifiedAt } : {})
  }
}
