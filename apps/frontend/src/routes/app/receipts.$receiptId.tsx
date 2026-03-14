import { useEffect, useMemo, useRef, useState } from "react"

import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { useAtomValue } from "@effect/atom-react"

import { createFileRoute } from "@tanstack/react-router"

import type { SharedReceiptView, SharedReceiptLineItem } from "@repo/domain/schema/receipt/index.js"
import { Button } from "@repo/ui/components/button"
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card"

import { ApiClient } from "@/lib/api-client"
import { authAtom } from "@/lib/auth/atoms"
import { makeReceiptAtom } from "@/lib/receipt/atoms"

export const Route = createFileRoute("/app/receipts/$receiptId")({
	component: SharedReceiptPage,
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function maxSelectableFor(item: SharedReceiptLineItem): number {
	return item.quantity ?? 1
}

function myCostFor(
	item: SharedReceiptLineItem,
	qty: number,
): number {
	if (qty === 0) return 0
	if (item.unitPrice !== null) return qty * item.unitPrice
	return item.totalPrice
}

function fmt(amount: number): string {
	return new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "GBP",
	}).format(amount)
}

function totalForParticipant(
	receipt: SharedReceiptView,
	userId: string,
	overrideSelections?: Record<string, number>,
): number {
	const participant = receipt.participants.find((p) => p.userId === userId)
	const selections = overrideSelections ?? participant?.selections ?? {}
	return receipt.lineItems.reduce((sum, item) => {
		const qty = selections[item.id] ?? 0
		return sum + myCostFor(item, qty)
	}, 0)
}

// ─── sub-components ───────────────────────────────────────────────────────────

function QuantityStepper({
	value,
	max,
	onChange,
}: {
	value: number
	max: number
	onChange: (next: number) => void
}) {
	return (
		<div className="flex items-center gap-1">
			<Button
				variant="outline"
				size="icon-sm"
				onClick={() => onChange(Math.max(0, value - 1))}
				disabled={value === 0}
				aria-label="Decrease quantity"
			>
				−
			</Button>
			<span className="w-7 text-center tabular-nums text-sm font-medium">
				{value}
			</span>
			<Button
				variant="outline"
				size="icon-sm"
				onClick={() => onChange(Math.min(max, value + 1))}
				disabled={value === max}
				aria-label="Increase quantity"
			>
				+
			</Button>
		</div>
	)
}

function ShareBanner({ receiptId }: { receiptId: string }) {
	const [copied, setCopied] = useState(false)
	const url = `${window.location.origin}/app/receipts/${receiptId}`

	const copy = () => {
		navigator.clipboard.writeText(url).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}

	return (
		<Card>
			<CardContent className="pt-4">
				<p className="text-xs text-muted-foreground mb-2">
					Share this link with friends to split the bill
				</p>
				<div className="flex gap-2 items-center">
					<code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate">
						{url}
					</code>
					<Button variant="outline" size="sm" onClick={copy}>
						{copied ? "Copied!" : "Copy"}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}

// ─── page ─────────────────────────────────────────────────────────────────────

function SharedReceiptPage() {
	const { receiptId } = Route.useParams()
	const auth = useAtomValue(authAtom)

	// stable atom reference per receiptId
	const receiptAtom = useMemo(
		() => makeReceiptAtom(receiptId),
		[receiptId],
	)
	const receiptResult = useAtomValue(receiptAtom)

	// my local selections (optimistic)
	const [mySelections, setMySelections] = useState<Record<string, number>>({})
	const initializedRef = useRef(false)

	const myUserId =
		auth.state === "authenticated" || (auth.state === "loading" && auth.user)
			? auth.user!.id
			: null

	// initialize mySelections from server on first successful load
	useEffect(() => {
		if (initializedRef.current) return
		if (!AsyncResult.isSuccess(receiptResult)) return
		if (!myUserId) return

		const receipt = AsyncResult.getOrThrow(receiptResult)
		const me = receipt.participants.find((p) => p.userId === myUserId)
		if (me) {
			setMySelections(me.selections)
		}
		initializedRef.current = true
	}, [receiptResult, myUserId])

	const updateQuantity = (lineItemId: string, qty: number) => {
		const next = { ...mySelections, [lineItemId]: qty }
		setMySelections(next)

		if (!myUserId) return

		// persist to server
		Function.pipe(
			ApiClient,
			Effect.andThen((api) =>
				api.receipt.updateSelections({
					path: { id: receiptId },
					payload: {
						selections: Object.entries(next).map(([lineItemId, quantity]) => ({
							lineItemId,
							quantity,
						})),
					},
				}),
			),
			Effect.runPromise,
		).catch(() => {
			// silently ignore — polling will reconcile
		})
	}

	if (AsyncResult.isWaiting(receiptResult)) {
		return (
			<main className="min-h-svh flex items-center justify-center">
				<p className="text-sm text-muted-foreground animate-pulse">
					Loading receipt…
				</p>
			</main>
		)
	}

	if (AsyncResult.isFailure(receiptResult)) {
		return (
			<main className="min-h-svh flex items-center justify-center">
				<p className="text-sm text-destructive">
					Could not load this receipt. It may not exist.
				</p>
			</main>
		)
	}

	const receipt = AsyncResult.getOrThrow(receiptResult)
	const receiptTotal = receipt.lineItems.reduce(
		(sum, item) => sum + item.totalPrice,
		0,
	)
	const myTotal = myUserId
		? totalForParticipant(receipt, myUserId, mySelections)
		: 0

	// build a "who claims what" lookup: lineItemId → list of (userName, qty)
	const claimsByItem: Record<string, Array<{ name: string; qty: number }>> = {}
	for (const participant of receipt.participants) {
		if (participant.userId === myUserId) continue
		for (const [itemId, qty] of Object.entries(participant.selections)) {
			if (qty > 0) {
				claimsByItem[itemId] ??= []
				claimsByItem[itemId]!.push({ name: participant.userName, qty })
			}
		}
	}

	return (
		<main className="min-h-svh flex flex-col items-center py-12 px-4">
			<div className="w-full max-w-md space-y-4">
				<h1 className="text-2xl font-bold">Split the bill</h1>

				<ShareBanner receiptId={receiptId} />

				{receipt.imageDataUrl && (
					<img
						src={receipt.imageDataUrl}
						alt="Receipt"
						className="w-full max-h-40 object-cover rounded-lg border border-border"
					/>
				)}

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Select your items</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						{receipt.lineItems.map((item) => {
							const qty = mySelections[item.id] ?? 0
							const max = maxSelectableFor(item)
							const cost = myCostFor(item, qty)
							const others = claimsByItem[item.id] ?? []

							return (
								<div
									key={item.id}
									className="flex items-start gap-3 py-3 border-b border-border last:border-0"
								>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">
											{item.description}
										</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{item.unitPrice !== null
												? `${fmt(item.unitPrice)} each · ${max} on receipt`
												: `${fmt(item.totalPrice)} total`}
										</p>
										{others.length > 0 && (
											<p className="text-xs text-muted-foreground mt-0.5">
												{others
													.map((o) => `${o.name} ×${o.qty}`)
													.join(", ")}
											</p>
										)}
									</div>
									<div className="flex flex-col items-end gap-1">
										<QuantityStepper
											value={qty}
											max={max}
											onChange={(next) => updateQuantity(item.id, next)}
										/>
										<span
											className={
												cost > 0
													? "text-sm font-semibold tabular-nums"
													: "text-sm text-muted-foreground tabular-nums"
											}
										>
											{fmt(cost)}
										</span>
									</div>
								</div>
							)
						})}
					</CardContent>
				</Card>

				{receipt.participants.length > 1 && (
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">Everyone's totals</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 space-y-1">
							{receipt.participants.map((p) => {
								const isMe = p.userId === myUserId
								const total = isMe
									? myTotal
									: totalForParticipant(receipt, p.userId)
								return (
									<div
										key={p.userId}
										className="flex justify-between text-sm"
									>
										<span className={isMe ? "font-semibold" : ""}>
											{isMe ? "You" : p.userName}
										</span>
										<span className="tabular-nums">{fmt(total)}</span>
									</div>
								)
							})}
						</CardContent>
					</Card>
				)}

				<Card>
					<CardContent className="pt-4 space-y-2">
						<div className="flex justify-between text-sm text-muted-foreground">
							<span>Receipt total</span>
							<span className="tabular-nums">{fmt(receiptTotal)}</span>
						</div>
						<div className="flex justify-between text-base font-bold">
							<span>Your bill</span>
							<span className="tabular-nums">{fmt(myTotal)}</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
