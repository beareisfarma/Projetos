CREATE TABLE `visited_doctors` (
	`user_id` text NOT NULL,
	`doctor_name` text NOT NULL,
	PRIMARY KEY(`user_id`, `doctor_name`)
);
