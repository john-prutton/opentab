import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as LanguageModel from "effect/unstable/ai/LanguageModel"
import * as Prompt from "effect/unstable/ai/Prompt"

import {
	ExtractedLineItemSchema,
} from "@repo/domain/schema/receipt/index.js"
import {
	ExtractionError,
	ReceiptExtraction,
} from "@repo/domain/services/receipt/index.js"

const LineItemsSchema = Schema.Struct({
	items: Schema.Array(ExtractedLineItemSchema),
})

export const ReceiptExtractionLive = Layer.effect(
	ReceiptExtraction,
	Effect.gen(function* () {
		const model = yield* LanguageModel.LanguageModel

		return ReceiptExtraction.of({
			extractLineItems: (imageDataUrl) =>
				model
					.generateObject({
						objectName: "lineItems",
						schema: LineItemsSchema,
						prompt: Prompt.make([
							Prompt.systemMessage({
								content:
									"You are a receipt OCR expert. Extract every line item from the receipt image. " +
									"For each item include its description, quantity (if shown), unit price (if shown), " +
									"and the line total price. Use null for quantity and unitPrice when not shown. " +
									"All prices must be numbers (not strings).",
							}),
							Prompt.userMessage({
								content: [
									Prompt.textPart({
										text: "Extract all line items from this receipt image.",
									}),
									Prompt.filePart({
										mediaType: imageDataUrl.startsWith("data:")
											? imageDataUrl.slice(5, imageDataUrl.indexOf(";"))
											: "image/jpeg",
										data: imageDataUrl,
									}),
								],
							}),
						]),
					})
					.pipe(
						Effect.map((r) => Array.from(r.value.items)),
						Effect.catchTag("AiError", (e) =>
							Effect.fail(
								new ExtractionError({
									message: e.message,
									error: e.reason._tag,
								}),
							),
						),
					),
		})
	}),
)
