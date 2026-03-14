import * as Schema from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"

export class ReceiptNotFoundError extends Schema.TaggedErrorClass<ReceiptNotFoundError>()(
	"ReceiptNotFoundError",
	{},
) {}

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

export type SharedReceiptLineItem = typeof SharedReceiptLineItemSchema.Type
export const SharedReceiptLineItemSchema = Schema.Struct({
	id: Schema.NonEmptyString,
	description: Schema.NonEmptyString,
	quantity: Schema.Number.pipe(Schema.NullOr),
	unitPrice: Schema.Number.pipe(Schema.NullOr),
	totalPrice: Schema.Number,
})

export type ParticipantSelections = typeof ParticipantSelectionsSchema.Type
export const ParticipantSelectionsSchema = Schema.Struct({
	userId: Schema.NonEmptyString,
	userName: Schema.NonEmptyString,
	selections: Schema.Record({ key: Schema.String, value: Schema.Number }),
})

export type SharedReceiptView = typeof SharedReceiptViewSchema.Type
export const SharedReceiptViewSchema = Schema.Struct({
	id: Schema.NonEmptyString,
	imageDataUrl: Schema.String.pipe(Schema.NullOr),
	lineItems: Schema.Array(SharedReceiptLineItemSchema),
	participants: Schema.Array(ParticipantSelectionsSchema),
	createdAt: DateFromEpochMillis,
})
