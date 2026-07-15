ALTER TABLE "email_accounts" ADD COLUMN "imap_host" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "imap_port" integer;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "imap_password_enc" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "last_uid" integer;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "uid_validity" text;