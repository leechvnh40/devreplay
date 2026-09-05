CREATE TABLE `datasets` (
  `id` text PRIMARY KEY NOT NULL,
  `dataset_kind` text NOT NULL CHECK (`dataset_kind` IN ('demo')),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dataset_records` (
  `dataset_id` text NOT NULL,
  `table_name` text NOT NULL,
  `record_id` text NOT NULL,
  PRIMARY KEY (`dataset_id`, `table_name`, `record_id`),
  FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON UPDATE no action ON DELETE CASCADE
);
