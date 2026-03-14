import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"

import type { ExtractedLineItem } from "@/schema/receipt/index.js"

export class ExtractionError extends Schema.TaggedErrorClass<ExtractionError>()(
	"ExtractionError",
	{
		message: Schema.String,
		error: Schema.String,
	},
) {}

export class ReceiptExtraction extends ServiceMap.Service<
	ReceiptExtraction,
	{
		readonly extractLineItems: (
			imageUrl: string,
		) => Effect.Effect<ExtractedLineItem[], ExtractionError>
	}
>()("ReceiptExtraction") {}
