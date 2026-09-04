CREATE TABLE `assessment_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`training_task_id` text NOT NULL,
	`version` integer NOT NULL,
	`contract_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`training_task_id`) REFERENCES `training_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `capability_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`user_confirmed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `capability_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capability_projection` (
	`capability_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`reason_json` text NOT NULL,
	`last_verified_at` text,
	`rebuilt_at` text NOT NULL,
	FOREIGN KEY (`capability_id`) REFERENCES `capability_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `context_manifest_items` (
	`id` text PRIMARY KEY NOT NULL,
	`model_run_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`required` integer NOT NULL,
	`included` integer NOT NULL,
	`estimated_chars` integer NOT NULL,
	FOREIGN KEY (`model_run_id`) REFERENCES `model_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `diagnostic_hypotheses` (
	`id` text PRIMARY KEY NOT NULL,
	`review_session_id` text NOT NULL,
	`capability_id` text,
	`claim` text NOT NULL,
	`evidence_json` text NOT NULL,
	`alternatives_json` text NOT NULL,
	`confidence` text NOT NULL,
	`verification_plan` text NOT NULL,
	`resolution` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`review_session_id`) REFERENCES `review_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capability_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`capability_id` text NOT NULL,
	`interview_id` text,
	`source_type` text NOT NULL,
	`polarity` text NOT NULL,
	`strength` integer NOT NULL,
	`content_json` text NOT NULL,
	`supersedes_id` text,
	`retracts_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`capability_id`) REFERENCES `capability_nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supersedes_id`) REFERENCES `evidence_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`retracts_id`) REFERENCES `evidence_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`occurred_at` text NOT NULL,
	`round` text NOT NULL,
	`resume_snapshot_id` text NOT NULL,
	`job_description_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`resume_snapshot_id`) REFERENCES `resume_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_description_id`) REFERENCES `job_descriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_descriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text,
	`prompt_version_id` text NOT NULL,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`status` text NOT NULL,
	`request_json` text NOT NULL,
	`response_json` text,
	`result_json` text,
	`error_json` text,
	`usage_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`version` integer NOT NULL,
	`template` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resume_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`content` text NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`review_session_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_json` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`review_session_id`) REFERENCES `review_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`training_task_id` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`training_task_id`) REFERENCES `training_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text NOT NULL,
	`stage` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`draft_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_sessions_interview_id_unique` ON `review_sessions` (`interview_id`);--> statement-breakpoint
CREATE TABLE `review_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`review_session_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`source_type` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_session_id`) REFERENCES `review_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `target_capability_weights` (
	`target_profile_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`weight` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`target_profile_id`, `capability_id`),
	FOREIGN KEY (`target_profile_id`) REFERENCES `target_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capability_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `target_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`direction` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`training_task_id` text NOT NULL,
	`assessment_contract_id` text NOT NULL,
	`answer` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`training_task_id`) REFERENCES `training_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessment_contract_id`) REFERENCES `assessment_contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `training_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`capability_id` text NOT NULL,
	`interview_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`priority_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`capability_id`) REFERENCES `capability_nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE no action
);
