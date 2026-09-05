import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}

export const resumeSnapshots = sqliteTable('resume_snapshots', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  content: text('content').notNull(),
  capturedAt: text('captured_at').notNull()
})

export const jobDescriptions = sqliteTable('job_descriptions', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  capturedAt: text('captured_at').notNull()
})

export const targetProfiles = sqliteTable('target_profiles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  direction: text('direction').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  ...timestamps
})

export const capabilityNodes = sqliteTable('capability_nodes', {
  id: text('id').primaryKey(),
  parentId: text('parent_id').references((): AnySQLiteColumn => capabilityNodes.id),
  name: text('name').notNull(),
  category: text('category').notNull(),
  userConfirmed: integer('user_confirmed', { mode: 'boolean' }).notNull().default(false),
  ...timestamps
})

export const targetCapabilityWeights = sqliteTable(
  'target_capability_weights',
  {
    targetProfileId: text('target_profile_id')
      .notNull()
      .references(() => targetProfiles.id, { onDelete: 'cascade' }),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilityNodes.id, { onDelete: 'cascade' }),
    weight: integer('weight').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [primaryKey({ columns: [table.targetProfileId, table.capabilityId] })]
)

export const interviews = sqliteTable('interviews', {
  id: text('id').primaryKey(),
  company: text('company').notNull(),
  role: text('role').notNull(),
  occurredAt: text('occurred_at').notNull(),
  round: text('round').notNull(),
  resumeSnapshotId: text('resume_snapshot_id')
    .notNull()
    .references(() => resumeSnapshots.id),
  jobDescriptionId: text('job_description_id').references(() => jobDescriptions.id),
  ...timestamps
})

export const reviewSessions = sqliteTable('review_sessions', {
  id: text('id').primaryKey(),
  interviewId: text('interview_id')
    .notNull()
    .unique()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  revision: integer('revision').notNull().default(0),
  draftJson: text('draft_json').notNull().default('{}'),
  ...timestamps
})

export const reviewTurns = sqliteTable('review_turns', {
  id: text('id').primaryKey(),
  reviewSessionId: text('review_session_id')
    .notNull()
    .references(() => reviewSessions.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  content: text('content').notNull(),
  sourceType: text('source_type').notNull(),
  createdAt: text('created_at').notNull()
})

export const reviewItems = sqliteTable('review_items', {
  id: text('id').primaryKey(),
  reviewSessionId: text('review_session_id')
    .notNull()
    .references(() => reviewSessions.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  contentJson: text('content_json').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  status: text('status').notNull(),
  ...timestamps
})

export const diagnosticHypotheses = sqliteTable('diagnostic_hypotheses', {
  id: text('id').primaryKey(),
  reviewSessionId: text('review_session_id')
    .notNull()
    .references(() => reviewSessions.id, { onDelete: 'cascade' }),
  capabilityId: text('capability_id').references(() => capabilityNodes.id),
  claim: text('claim').notNull(),
  evidenceJson: text('evidence_json').notNull(),
  alternativesJson: text('alternatives_json').notNull(),
  confidence: text('confidence').notNull(),
  verificationPlan: text('verification_plan').notNull(),
  resolution: text('resolution').notNull().default('pending'),
  ...timestamps
})

export const evidenceEntries = sqliteTable('evidence_entries', {
  id: text('id').primaryKey(),
  capabilityId: text('capability_id')
    .notNull()
    .references(() => capabilityNodes.id),
  interviewId: text('interview_id').references(() => interviews.id),
  sourceType: text('source_type').notNull(),
  polarity: text('polarity').notNull(),
  strength: integer('strength').notNull(),
  contentJson: text('content_json').notNull(),
  supersedesId: text('supersedes_id').references((): AnySQLiteColumn => evidenceEntries.id),
  retractsId: text('retracts_id').references((): AnySQLiteColumn => evidenceEntries.id),
  createdAt: text('created_at').notNull()
})

export const capabilityProjection = sqliteTable('capability_projection', {
  capabilityId: text('capability_id')
    .primaryKey()
    .references(() => capabilityNodes.id, { onDelete: 'cascade' }),
  state: text('state').notNull(),
  reasonJson: text('reason_json').notNull(),
  lastVerifiedAt: text('last_verified_at'),
  rebuiltAt: text('rebuilt_at').notNull()
})

export const trainingTasks = sqliteTable('training_tasks', {
  id: text('id').primaryKey(),
  capabilityId: text('capability_id')
    .notNull()
    .references(() => capabilityNodes.id),
  interviewId: text('interview_id').references(() => interviews.id),
  type: text('type').notNull(),
  status: text('status').notNull(),
  priorityJson: text('priority_json').notNull(),
  ...timestamps
})

export const assessmentContracts = sqliteTable('assessment_contracts', {
  id: text('id').primaryKey(),
  trainingTaskId: text('training_task_id')
    .notNull()
    .references(() => trainingTasks.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  contractJson: text('contract_json').notNull(),
  createdAt: text('created_at').notNull()
})

export const trainingAttempts = sqliteTable('training_attempts', {
  id: text('id').primaryKey(),
  trainingTaskId: text('training_task_id')
    .notNull()
    .references(() => trainingTasks.id, { onDelete: 'cascade' }),
  assessmentContractId: text('assessment_contract_id')
    .notNull()
    .references(() => assessmentContracts.id),
  answer: text('answer').notNull(),
  resultJson: text('result_json').notNull(),
  createdAt: text('created_at').notNull()
})

export const reviewSchedules = sqliteTable('review_schedules', {
  id: text('id').primaryKey(),
  trainingTaskId: text('training_task_id')
    .notNull()
    .references(() => trainingTasks.id, { onDelete: 'cascade' }),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull()
})

export const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey(),
  purpose: text('purpose').notNull(),
  version: integer('version').notNull(),
  template: text('template').notNull(),
  createdAt: text('created_at').notNull()
})

export const modelRuns = sqliteTable('model_runs', {
  id: text('id').primaryKey(),
  interviewId: text('interview_id').references(() => interviews.id),
  promptVersionId: text('prompt_version_id')
    .notNull()
    .references(() => promptVersions.id),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  status: text('status').notNull(),
  requestJson: text('request_json').notNull(),
  responseJson: text('response_json'),
  resultJson: text('result_json'),
  errorJson: text('error_json'),
  usageJson: text('usage_json'),
  ...timestamps
})

export const contextManifestItems = sqliteTable('context_manifest_items', {
  id: text('id').primaryKey(),
  modelRunId: text('model_run_id')
    .notNull()
    .references(() => modelRuns.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  sourceId: text('source_id').notNull(),
  required: integer('required', { mode: 'boolean' }).notNull(),
  included: integer('included', { mode: 'boolean' }).notNull(),
  estimatedChars: integer('estimated_chars').notNull()
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const datasets = sqliteTable('datasets', {
  id: text('id').primaryKey(),
  datasetKind: text('dataset_kind').notNull(),
  createdAt: text('created_at').notNull()
})

export const datasetRecords = sqliteTable(
  'dataset_records',
  {
    datasetId: text('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull()
  },
  (table) => [primaryKey({ columns: [table.datasetId, table.tableName, table.recordId] })]
)

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: integer('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: text('applied_at').notNull()
})

export const schema = {
  assessmentContracts,
  capabilityNodes,
  capabilityProjection,
  contextManifestItems,
  datasetRecords,
  datasets,
  diagnosticHypotheses,
  evidenceEntries,
  interviews,
  jobDescriptions,
  modelRuns,
  promptVersions,
  resumeSnapshots,
  reviewItems,
  reviewSchedules,
  reviewSessions,
  reviewTurns,
  schemaMigrations,
  settings,
  targetCapabilityWeights,
  targetProfiles,
  trainingAttempts,
  trainingTasks
}
