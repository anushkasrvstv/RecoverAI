CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(32) NOT NULL,
	`event` varchar(120) NOT NULL,
	`details` text NOT NULL,
	`aiUsed` int NOT NULL DEFAULT 0,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(32) NOT NULL,
	`matchedRule` varchar(64) NOT NULL,
	`category` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`priority` int NOT NULL,
	`reason` text NOT NULL,
	`aiUsed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(32) NOT NULL,
	`message` text NOT NULL,
	`tone` varchar(32) NOT NULL,
	`language` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(32) NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'INR',
	`paymentMethod` varchar(100) NOT NULL,
	`failureCode` varchar(64) NOT NULL,
	`failureReason` varchar(120) NOT NULL,
	`category` varchar(64) NOT NULL,
	`priorityScore` int NOT NULL,
	`recommendedAction` varchar(64) NOT NULL,
	`status` enum('PENDING','RECOVERED','FAILED_AGAIN','REVIEWED') NOT NULL DEFAULT 'PENDING',
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
