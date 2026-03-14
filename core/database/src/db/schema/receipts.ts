import {
	integer,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core"

import { usersTable } from "./index.js"

export const sharedReceiptsTable = pgTable("shared_receipts", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerId: uuid("owner_id")
		.references(() => usersTable.id, { onDelete: "cascade" })
		.notNull(),
	imageDataUrl: text("image_data_url"),
	createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const receiptLineItemsTable = pgTable("receipt_line_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	receiptId: uuid("receipt_id")
		.references(() => sharedReceiptsTable.id, { onDelete: "cascade" })
		.notNull(),
	description: varchar("description", { length: 255 }).notNull(),
	quantity: numeric("quantity"),
	unitPrice: numeric("unit_price"),
	totalPrice: numeric("total_price").notNull(),
})

export const receiptSelectionsTable = pgTable(
	"receipt_selections",
	{
		receiptId: uuid("receipt_id")
			.references(() => sharedReceiptsTable.id, { onDelete: "cascade" })
			.notNull(),
		userId: uuid("user_id")
			.references(() => usersTable.id, { onDelete: "cascade" })
			.notNull(),
		lineItemId: uuid("line_item_id")
			.references(() => receiptLineItemsTable.id, { onDelete: "cascade" })
			.notNull(),
		quantity: integer("quantity").notNull().default(0),
	},
	({ receiptId, userId, lineItemId }) => [
		primaryKey({
			name: "receipt_user_line_item_pk",
			columns: [receiptId, userId, lineItemId],
		}),
	],
)
