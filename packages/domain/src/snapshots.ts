import { requireNonEmpty, type JobDescriptionSnapshotId, type ResumeSnapshotId } from './ids'

export interface ResumeSnapshot {
  readonly id: ResumeSnapshotId
  readonly label: string
  readonly content: string
  readonly capturedAt: string
}

export interface JobDescriptionSnapshot {
  readonly id: JobDescriptionSnapshotId
  readonly content: string
  readonly capturedAt: string
}

export function createResumeSnapshot(input: ResumeSnapshot): ResumeSnapshot {
  return Object.freeze({
    id: requireNonEmpty(input.id, '简历快照 ID'),
    label: requireNonEmpty(input.label, '简历名称'),
    content: requireNonEmpty(input.content, '简历内容'),
    capturedAt: requireNonEmpty(input.capturedAt, '简历快照时间')
  })
}

export function createJobDescriptionSnapshot(
  input: JobDescriptionSnapshot
): JobDescriptionSnapshot {
  return Object.freeze({
    id: requireNonEmpty(input.id, 'JD 快照 ID'),
    content: requireNonEmpty(input.content, 'JD 内容'),
    capturedAt: requireNonEmpty(input.capturedAt, 'JD 快照时间')
  })
}
