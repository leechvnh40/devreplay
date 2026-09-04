import { INITIAL_CAPABILITY_SKELETON, type CapabilityNode } from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'

export interface ProposedCapabilityNode {
  readonly name: string
  readonly parentId: string
  readonly reason: string
}

export class CapabilityCatalogService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {}

  ensureInitialSkeleton(): void {
    runInTransaction(this.database.sqlite, () => {
      for (const node of INITIAL_CAPABILITY_SKELETON) this.insert(node)
    })
  }

  proposeNewNode(input: ProposedCapabilityNode): ProposedCapabilityNode {
    if (!input.name.trim() || !input.reason.trim())
      throw new PreconditionError('新增能力需包含名称与理由')
    this.requireParent(input.parentId)
    return Object.freeze({ ...input })
  }

  confirmNewNode(proposal: ProposedCapabilityNode): CapabilityNode {
    const parent = this.requireParent(proposal.parentId)
    const node: CapabilityNode = {
      id: this.nextId(),
      parentId: parent.id,
      name: proposal.name.trim(),
      category: parent.category,
      userConfirmed: true
    }
    this.insert(node)
    return Object.freeze(node)
  }

  list(): readonly CapabilityNode[] {
    return this.database.sqlite
      .prepare(
        'SELECT id, parent_id, name, category, user_confirmed FROM capability_nodes ORDER BY created_at, id'
      )
      .all()
      .map((row) => {
        const item = row as {
          id: string
          parent_id: string | null
          name: string
          category: CapabilityNode['category']
          user_confirmed: number
        }
        return Object.freeze({
          id: item.id,
          ...(item.parent_id ? { parentId: item.parent_id } : {}),
          name: item.name,
          category: item.category,
          userConfirmed: Boolean(item.user_confirmed)
        })
      })
  }

  private requireParent(id: string): CapabilityNode {
    const parent = this.list().find((node) => node.id === id)
    if (!parent) throw new PreconditionError('父能力节点不存在')
    return parent
  }

  private insert(node: CapabilityNode): void {
    const timestamp = this.now()
    this.database.sqlite
      .prepare(
        `INSERT OR IGNORE INTO capability_nodes
         (id, parent_id, name, category, user_confirmed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        node.id,
        node.parentId ?? null,
        node.name,
        node.category,
        node.userConfirmed ? 1 : 0,
        timestamp,
        timestamp
      )
  }
}
