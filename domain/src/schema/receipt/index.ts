import * as Schema from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"

export type ReceiptStatus = typeof ReceiptStatusSchema.Type
export const ReceiptStatusSchema = Schema.Literal(
	"pending",
	"processing",
	"complete",
	"failed",
)

export type ExtractedLineItem = typeof ExtractedLineItemSchema.Type
export const ExtractedLineItemSchema = Schema.Struct({
	description: Schema.NonEmptyString,
	quantity: Schema.Number.pipe(Schema.NullOr),
	unitPrice: Schema.Number.pipe(Schema.NullOr),
	totalPrice: Schema.Number,
})

const DateFromEpochMillis = Schema.Date.pipe(
	Schema.encodeTo(
		Schema.Number,
		SchemaTransformation.transform({
			decode: (epochMillis) => new Date(epochMillis),
			encode: (date) => date.getTime(),
		}),
	),
)

export type Receipt = typeof ReceiptSchema.Type
export const ReceiptSchema = Schema.Struct({
	id: Schema.NonEmptyString,
	userId: Schema.NonEmptyString,
	imageUrl: Schema.NonEmptyString,
	status: ReceiptStatusSchema,
	createdAt: DateFromEpochMillis,
})

export type ReceiptLineItem = typeof ReceiptLineItemSchema.Type
export const ReceiptLineItemSchema = Schema.Struct({
	id: Schema.NonEmptyString,
	receiptId: Schema.NonEmptyString,
	description: Schema.NonEmptyString,
	quantity: Schema.Number.pipe(Schema.NullOr),
	unitPrice: Schema.Number.pipe(Schema.NullOr),
	totalPrice: Schema.Number,
	createdAt: DateFromEpochMillis,
})
