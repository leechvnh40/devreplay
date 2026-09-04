export type ContextFragmentKind =
  | 'current_recall'
  | 'interview_context'
  | 'resume_excerpt'
  | 'job_description'
  | 'historical_evidence'

export interface ContextFragmentInput {
  readonly id: string
  readonly kind: ContextFragmentKind
  readonly sourceId: string
  readonly label: string
  readonly content: string
  readonly required: boolean
  readonly included?: boolean
}

export interface ContextManifestItem {
  readonly id: string
  readonly kind: ContextFragmentKind
  readonly sourceId: string
  readonly label: string
  readonly content: string
  readonly required: boolean
  readonly included: boolean
  readonly estimatedChars: number
  readonly estimatedTokens: number
}

export interface ContextManifest {
  readonly items: readonly ContextManifestItem[]
  readonly includedChars: number
  readonly includedTokens: number
}

export function createContextManifest(fragments: readonly ContextFragmentInput[]): ContextManifest {
  const ids = new Set<string>()
  const items = fragments.map((fragment) => {
    if (ids.has(fragment.id)) throw new Error(`上下文片段 ID 重复：${fragment.id}`)
    ids.add(fragment.id)

    const estimatedChars = fragment.content.length
    return Object.freeze({
      ...fragment,
      included: fragment.required || fragment.included !== false,
      estimatedChars,
      estimatedTokens: estimateTokens(estimatedChars)
    })
  })
  return summarize(items)
}

export function setContextItemIncluded(
  manifest: ContextManifest,
  itemId: string,
  included: boolean
): ContextManifest {
  const target = manifest.items.find((item) => item.id === itemId)
  if (!target) throw new Error(`上下文片段不存在：${itemId}`)
  if (target.required && !included) throw new Error(`必需上下文不可移除：${itemId}`)

  return summarize(
    manifest.items.map((item) => (item.id === itemId ? Object.freeze({ ...item, included }) : item))
  )
}

export function buildIncludedContext(manifest: ContextManifest): string {
  return manifest.items
    .filter((item) => item.included)
    .map((item) => `## ${item.label}\n${item.content}`)
    .join('\n\n')
}

function summarize(items: readonly ContextManifestItem[]): ContextManifest {
  const included = items.filter((item) => item.included)
  return Object.freeze({
    items: Object.freeze([...items]),
    includedChars: included.reduce((total, item) => total + item.estimatedChars, 0),
    includedTokens: included.reduce((total, item) => total + item.estimatedTokens, 0)
  })
}

function estimateTokens(characters: number): number {
  return Math.ceil(characters / 4)
}
