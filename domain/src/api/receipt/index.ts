import * as Schema from "effect/Schema"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"

import {
	ExtractedLineItemSchema,
	ReceiptNotFoundError,
	SharedReceiptViewSchema,
} from "@/schema/receipt/index.js"
import { AuthMiddleware } from "@/services/auth/index.js"
import { ExtractionError } from "@/services/receipt/index.js"
import { DatabaseError } from "@/services/database/index.js"

export class ReceiptApiGroup extends HttpApiGroup.make("receipt")
	.add(
		HttpApiEndpoint.post("extract", "/extract", {
			success: Schema.Array(ExtractedLineItemSchema),
			error: ExtractionError,
			payload: Schema.Struct({
				imageDataUrl: Schema.NonEmptyString,
			}),
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("createSession", "/sessions", {
			success: Schema.Struct({ id: Schema.NonEmptyString }),
			error: DatabaseError,
			payload: Schema.Struct({
				imageDataUrl: Schema.String.pipe(Schema.NullOr),
				items: Schema.Array(ExtractedLineItemSchema),
			}),
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("getSession", "/sessions/:id", {
			success: SharedReceiptViewSchema,
			error: Schema.Union([DatabaseError, ReceiptNotFoundError]),
			params: {
				id: Schema.NonEmptyString,
			},
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.put("updateSelections", "/sessions/:id/selections", {
			error: Schema.Union([DatabaseError, ReceiptNotFoundError]),
			params: {
				id: Schema.NonEmptyString,
			},
			payload: Schema.Struct({
				selections: Schema.Array(
					Schema.Struct({
						lineItemId: Schema.NonEmptyString,
						quantity: Schema.Number,
					}),
				),
			}),
		}).middleware(AuthMiddleware),
	)
	.prefix("/receipts") {}
