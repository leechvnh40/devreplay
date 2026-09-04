import {
  createEvidenceEntry,
  rebuildCapabilityProjection,
  type CapabilityProjection,
  type EvidenceEntry
} from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'

interface EvidenceRow {
  id: string
  capability_id: string
  interview_id: string | null
  source_type: EvidenceEntry['sourceType']
  polarity: EvidenceEntry['polarity']
  strength: EvidenceEntry['strength']
  content_json: string
  supersedes_id: string | null
  retracts_id: string | null
  created_at: string
}

export class SqliteEvidenceRepository {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  append(entry: EvidenceEntry): CapabilityProjection {
    return runInTransaction(this.database.sqlite, () => {
      this.validateRelation(entry)
      this.database.sqlite
        .prepare(
          `INSERT INTO evidence_entries
           (id, capability_id, interview_id, source_type, polarity, strength, content_json,
            supersedes_id, retracts_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          entry.id,
          entry.capabilityId,
          entry.interviewId ?? null,
          entry.sourceType,
          entry.polarity,
          entry.strength,
          JSON.stringify(entry.content),
          entry.supersedesId ?? null,
          entry.retractsId ?? null,
          entry.createdAt
        )
      return this.rebuild(entry.capabilityId)
    })
  }

  rebuild(capabilityId: string): CapabilityProjection {
    const entries = (
      this.database.sqlite
        .prepare('SELECT * FROM evidence_entries WHERE capability_id = ? ORDER BY created_at, id')
        .all(capabilityId) as EvidenceRow[]
    ).map((row) => this.toDomain(row))
    const projection = rebuildCapabilityProjection(capabilityId, entries)
    this.database.sqlite
      .prepare(
        `INSERT INTO capability_projection
         (capability_id, state, reason_json, last_verified_at, rebuilt_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(capability_id) DO UPDATE SET
           state = excluded.state,
           reason_json = excluded.reason_json,
           last_verified_at = excluded.last_verified_at,
           rebuilt_at = excluded.rebuilt_at`
      )
      .run(
        capabilityId,
        projection.state,
        JSON.stringify({
          supportingEvidenceIds: projection.supportingEvidenceIds,
          challengingEvidenceIds: projection.challengingEvidenceIds,
          activeEvidenceIds: projection.activeEvidenceIds
        }),
        projection.lastVerifiedAt ?? null,
        this.now()
      )
    return projection
  }

  list(capabilityId: string): readonly EvidenceEntry[] {
    return (
      this.database.sqlite
        .prepare('SELECT * FROM evidence_entries WHERE capability_id = ? ORDER BY created_at, id')
        .all(capabilityId) as EvidenceRow[]
    ).map((row) => this.toDomain(row))
  }

  private validateRelation(entry: EvidenceEntry): void {
    const relationId = entry.supersedesId ?? entry.retractsId
    if (!relationId) return
    const target = this.database.sqlite
      .prepare('SELECT capability_id FROM evidence_entries WHERE id = ?')
      .get(relationId) as { capability_id: string } | undefined
    if (!target || target.capability_id !== entry.capabilityId) {
      throw new Error('修正或撤销只能引用同一能力节点的既有证据')
    }
  }

  private toDomain(row: EvidenceRow): EvidenceEntry {
    return createEvidenceEntry({
      id: row.id,
      capabilityId: row.capability_id,
      sourceType: row.source_type,
      polarity: row.polarity,
      strength: row.strength,
      content: JSON.parse(row.content_json) as Record<string, unknown>,
      createdAt: row.created_at,
      ...(row.interview_id ? { interviewId: row.interview_id } : {}),
      ...(row.supersedes_id ? { supersedesId: row.supersedes_id } : {}),
      ...(row.retracts_id ? { retractsId: row.retracts_id } : {})
    })
  }
}
