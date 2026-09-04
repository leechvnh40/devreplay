import {
  createDiagnosticHypothesis,
  createEvidenceEntry,
  resolveDiagnosticHypothesis,
  type DiagnosticHypothesis,
  type DiagnosisResolution
} from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { SqliteEvidenceRepository } from '../repositories/sqlite-evidence-repository'
import { PreconditionError } from './onboarding-service'

interface StoredDiagnosisRow {
  id: string
  review_session_id: string
  capability_id: string
  claim: string
  evidence_json: string
  alternatives_json: string
  confidence: DiagnosticHypothesis['confidence']
  verification_plan: string
  resolution: DiagnosisResolution
}

export class DiagnosticService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {}

  propose(
    reviewSessionId: string,
    input: Omit<DiagnosticHypothesis, 'id' | 'resolution'>
  ): DiagnosticHypothesis {
    const hypothesis = createDiagnosticHypothesis({ ...input, id: this.nextId() })
    const timestamp = this.now()
    this.database.sqlite
      .prepare(
        `INSERT INTO diagnostic_hypotheses
         (id, review_session_id, capability_id, claim, evidence_json, alternatives_json,
          confidence, verification_plan, resolution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        hypothesis.id,
        reviewSessionId,
        hypothesis.capabilityId,
        hypothesis.claim,
        JSON.stringify(hypothesis.evidence),
        JSON.stringify(hypothesis.alternativeExplanations),
        hypothesis.confidence,
        hypothesis.verificationPlan,
        hypothesis.resolution,
        timestamp,
        timestamp
      )
    return hypothesis
  }

  resolve(
    id: string,
    resolution: Exclude<DiagnosisResolution, 'unresolved'>
  ): DiagnosticHypothesis {
    return runInTransaction(this.database.sqlite, () => {
      const row = this.database.sqlite
        .prepare('SELECT * FROM diagnostic_hypotheses WHERE id = ?')
        .get(id) as StoredDiagnosisRow | undefined
      if (!row) throw new PreconditionError('诊断假设不存在')

      const hypothesis = this.toDomain(row)
      const resolved = resolveDiagnosticHypothesis(hypothesis, resolution)
      const timestamp = this.now()
      this.database.sqlite
        .prepare('UPDATE diagnostic_hypotheses SET resolution = ?, updated_at = ? WHERE id = ?')
        .run(resolution, timestamp, id)

      if (resolution === 'confirmed') {
        const session = this.database.sqlite
          .prepare('SELECT interview_id FROM review_sessions WHERE id = ?')
          .get(row.review_session_id) as { interview_id: string }
        new SqliteEvidenceRepository(this.database, this.now).append(
          createEvidenceEntry({
            id: this.nextId(),
            capabilityId: row.capability_id,
            interviewId: session.interview_id,
            sourceType: 'confirmed_diagnosis',
            polarity: 'negative',
            strength: this.strengthFor(row.confidence),
            content: { diagnosisId: id, claim: row.claim },
            createdAt: timestamp
          })
        )
      }
      return resolved
    })
  }

  private toDomain(row: StoredDiagnosisRow): DiagnosticHypothesis {
    return {
      id: row.id,
      capabilityId: row.capability_id,
      claim: row.claim,
      evidence: JSON.parse(row.evidence_json) as DiagnosticHypothesis['evidence'],
      alternativeExplanations: JSON.parse(
        row.alternatives_json
      ) as DiagnosticHypothesis['alternativeExplanations'],
      confidence: row.confidence,
      verificationPlan: row.verification_plan,
      resolution: row.resolution
    }
  }

  private strengthFor(confidence: DiagnosticHypothesis['confidence']): 1 | 2 | 3 {
    return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1
  }
}
