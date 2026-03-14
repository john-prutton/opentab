import * as Effect from "effect/Effect"
import * as Atom from "effect/unstable/reactivity/Atom"

import { ApiClient } from "../api-client"

export const makeReceiptAtom = (receiptId: string) =>
	Atom.make(
		Effect.gen(function* () {
			const api = yield* ApiClient
			return yield* api.receipt.getSession({ path: { id: receiptId } })
		}),
	).pipe(Atom.withRefresh("2 seconds"))
