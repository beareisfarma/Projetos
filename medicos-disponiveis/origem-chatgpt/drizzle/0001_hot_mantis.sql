CREATE TABLE `itinerary_entries` (
	`user_id` text NOT NULL,
	`doctor_name` text NOT NULL,
	`day` text NOT NULL,
	`shift` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	PRIMARY KEY(`user_id`, `doctor_name`, `day`, `shift`)
);
