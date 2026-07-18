CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scenario` text NOT NULL,
	`focus_tags` text NOT NULL,
	`focus_note` text NOT NULL,
	`target_phrases` text NOT NULL,
	`micro_goal` text NOT NULL,
	`created_at` integer NOT NULL,
	`session_id` integer,
	`focus_result` text,
	`goal_achieved` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
