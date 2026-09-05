CREATE TABLE `messageTemplates` (
	`id` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`failureCode` varchar(64) NOT NULL,
	`tone` varchar(32) NOT NULL,
	`language` varchar(32) NOT NULL,
	`body` text NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messageTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recoveryAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(32) NOT NULL,
	`attemptNumber` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`outcome` varchar(32) NOT NULL,
	`details` text NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recoveryAttempts_id` PRIMARY KEY(`id`)
);
