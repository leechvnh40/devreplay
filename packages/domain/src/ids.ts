export type InterviewId = string
export type ResumeSnapshotId = string
export type JobDescriptionSnapshotId = string
export type ReviewSessionId = string

export function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${field} 不能为空`)
  return normalized
}
