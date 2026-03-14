import * as Schema from "effect/Schema"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"

import { ExtractedLineItemSchema } from "@/schema/receipt/index.js"
import { AuthMiddleware } from "@/services/auth/index.js"
import { ExtractionError } from "@/services/receipt/index.js"

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
	.prefix("/receipts") {}
