import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

import { ReceiptExtraction } from "@/services/receipt/index.js"

export const ReceiptExtractionFake = Layer.succeed(
	ReceiptExtraction,
	ReceiptExtraction.of({
		extractLineItems: (_imageUrl) =>
			Effect.succeed([
				{
					description: "Coffee",
					quantity: 2,
					unitPrice: 3.5,
					totalPrice: 7.0,
				},
				{
					description: "Croissant",
					quantity: 1,
					unitPrice: 4.25,
					totalPrice: 4.25,
				},
				{
					description: "Orange Juice",
					quantity: null,
					unitPrice: null,
					totalPrice: 5.0,
				},
			]),
	}),
)
