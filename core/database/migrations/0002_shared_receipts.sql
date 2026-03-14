CREATE TABLE "shared_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"image_data_url" text,
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "receipt_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"quantity" numeric,
	"unit_price" numeric,
	"total_price" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_selections" (
	"receipt_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"line_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL DEFAULT 0,
	CONSTRAINT "receipt_user_line_item_pk" PRIMARY KEY("receipt_id","user_id","line_item_id")
);
--> statement-breakpoint
ALTER TABLE "shared_receipts" ADD CONSTRAINT "shared_receipts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receipt_line_items" ADD CONSTRAINT "receipt_line_items_receipt_id_shared_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."shared_receipts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receipt_selections" ADD CONSTRAINT "receipt_selections_receipt_id_shared_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."shared_receipts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receipt_selections" ADD CONSTRAINT "receipt_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receipt_selections" ADD CONSTRAINT "receipt_selections_line_item_id_receipt_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."receipt_line_items"("id") ON DELETE cascade ON UPDATE no action;
