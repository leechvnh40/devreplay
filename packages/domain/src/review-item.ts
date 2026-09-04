import { createProvenance, type Provenance } from './provenance'

export interface ReviewItemRevision {
  readonly id: string
  readonly content: string
  readonly provenance: Provenance
  readonly createdAt: string
}

export interface ReviewItem {
  readonly id: string
  readonly kind: 'question' | 'answer' | 'impression' | 'uncertainty'
  readonly original: ReviewItemRevision
  readonly revisions: readonly ReviewItemRevision[]
}

export function createReviewItem(input: {
  id: string
  kind: ReviewItem['kind']
  content: string
  sourceId: string
  createdAt: string
}): ReviewItem {
  const original = Object.freeze({
    id: `${input.id}:original`,
    content: input.content,
    provenance: createProvenance({
      sourceType: 'agent_summary',
      sourceId: input.sourceId,
      derivedFromIds: [input.sourceId]
    }),
    createdAt: input.createdAt
  })
  return Object.freeze({ id: input.id, kind: input.kind, original, revisions: Object.freeze([]) })
}

export function reviseReviewItem(
  item: ReviewItem,
  input: { id: string; content: string; createdAt: string }
): ReviewItem {
  const previous = currentReviewItemRevision(item)
  const revision = Object.freeze({
    id: input.id,
    content: input.content,
    provenance: createProvenance({
      sourceType: 'user_revision',
      sourceId: input.id,
      derivedFromIds: [previous.id]
    }),
    createdAt: input.createdAt
  })
  return Object.freeze({ ...item, revisions: Object.freeze([...item.revisions, revision]) })
}

export function currentReviewItemRevision(item: ReviewItem): ReviewItemRevision {
  return item.revisions.at(-1) ?? item.original
}

export function reviewItemContentForNextStage(item: ReviewItem): string {
  return currentReviewItemRevision(item).content
}
