ALTER TABLE `conversations` ADD `product_scope` text DEFAULT 'legacy_medical' NOT NULL;--> statement-breakpoint
UPDATE `conversations` SET `product_scope` = 'lifestyle' WHERE `risk_level` IN ('lifestyle', 'recommendation', 'boundary_refusal', 'safety_stop');--> statement-breakpoint
CREATE INDEX `idx_conversations_owner_scope_updated` ON `conversations` (`owner_user_id`,`product_scope`,`updated_at`);
