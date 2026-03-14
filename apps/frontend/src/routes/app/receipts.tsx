import { useState } from "react"

import * as Effect from "effect/Effect"
import * as Function from "effect/Function"

import { createFileRoute } from "@tanstack/react-router"

import type { ExtractedLineItem } from "@repo/domain/schema/receipt/index.js"
import { Button } from "@repo/ui/components/button"
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card"

import { ApiClient } from "@/lib/api-client"

export const Route = createFileRoute("/app/receipts")({
	component: ReceiptsPage,
})

// ─── types ────────────────────────────────────────────────────────────────────

type Phase =
	| { kind: "upload" }
	| { kind: "extracting" }
	| { kind: "selecting"; items: LineItemSelection[] }

type LineItemSelection = {
	item: ExtractedLineItem
	myQuantity: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function maxSelectableFor(item: ExtractedLineItem): number {
	return item.quantity ?? 1
}

function myCostFor({ item, myQuantity }: LineItemSelection): number {
	if (myQuantity === 0) return 0
	if (item.unitPrice !== null) return myQuantity * item.unitPrice
	return item.totalPrice
}

function fmt(amount: number): string {
	return new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "GBP",
	}).format(amount)
}

// ─── sub-components ───────────────────────────────────────────────────────────

function UploadZone({ onFile }: { onFile: (file: File) => void }) {
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		const file = e.dataTransfer.files[0]
		if (file?.type.startsWith("image/")) onFile(file)
	}

	return (
		<label
			className="flex flex-col items-center justify-center gap-3 w-full h-56 rounded-xl border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
			onDrop={handleDrop}
			onDragOver={(e) => e.preventDefault()}
		>
			<input
				type="file"
				accept="image/*"
				className="sr-only"
				onChange={(e) => {
					const file = e.target.files?.[0]
					if (file) onFile(file)
				}}
			/>
			<div className="text-4xl select-none">📷</div>
			<div className="text-center">
				<p className="text-sm font-medium">Drop a receipt photo here</p>
				<p className="text-xs text-muted-foreground mt-0.5">
					or click to browse
				</p>
			</div>
		</label>
	)
}

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

function LineItemRow({
	selection,
	onQuantityChange,
}: {
	selection: LineItemSelection
	onQuantityChange: (next: number) => void
}) {
	const { item, myQuantity } = selection
	const max = maxSelectableFor(item)
	const myCost = myCostFor(selection)

	return (
		<div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{item.description}</p>
				<p className="text-xs text-muted-foreground mt-0.5">
					{item.unitPrice !== null
						? `${fmt(item.unitPrice)} each · ${max} on receipt`
						: `${fmt(item.totalPrice)} total`}
				</p>
			</div>
			<QuantityStepper value={myQuantity} max={max} onChange={onQuantityChange} />
			<div className="w-16 text-right">
				<span
					className={
						myCost > 0
							? "text-sm font-semibold tabular-nums"
							: "text-sm text-muted-foreground tabular-nums"
					}
				>
					{fmt(myCost)}
				</span>
			</div>
		</div>
	)
}

// ─── page ─────────────────────────────────────────────────────────────────────

function ReceiptsPage() {
	const [phase, setPhase] = useState<Phase>({ kind: "upload" })
	const [error, setError] = useState<string | null>(null)
	const [imagePreview, setImagePreview] = useState<string | null>(null)

	const handleFile = (file: File) => {
		setError(null)
		const reader = new FileReader()
		reader.onload = (evt) => {
			const dataUrl = evt.target?.result as string
			setImagePreview(dataUrl)
			extractItems(dataUrl)
		}
		reader.readAsDataURL(file)
	}

	const extractItems = (imageDataUrl: string) => {
		setPhase({ kind: "extracting" })

		Function.pipe(
			ApiClient,
			Effect.andThen((api) =>
				api.receipt.extract({ payload: { imageDataUrl } }),
			),
			Effect.runPromise,
		)
			.then((items) =>
				setPhase({
					kind: "selecting",
					items: items.map((item) => ({ item, myQuantity: 0 })),
				}),
			)
			.catch(() => {
				setPhase({ kind: "upload" })
				setError("Failed to extract items. Please try again.")
			})
	}

	const updateQuantity = (index: number, next: number) =>
		setPhase((prev) => {
			if (prev.kind !== "selecting") return prev
			const items = prev.items.map((s, i) =>
				i === index ? { ...s, myQuantity: next } : s,
			)
			return { ...prev, items }
		})

	const reset = () => {
		setPhase({ kind: "upload" })
		setImagePreview(null)
		setError(null)
	}

	const myTotal =
		phase.kind === "selecting"
			? phase.items.reduce((sum, s) => sum + myCostFor(s), 0)
			: 0

	const receiptTotal =
		phase.kind === "selecting"
			? phase.items.reduce((sum, s) => sum + s.item.totalPrice, 0)
			: 0

	return (
		<main className="min-h-svh flex flex-col items-center py-12 px-4">
			<div className="w-full max-w-md space-y-4">
				<h1 className="text-2xl font-bold">New Receipt</h1>

				{phase.kind === "upload" && <UploadZone onFile={handleFile} />}

				{phase.kind === "extracting" && (
					<div className="flex flex-col items-center justify-center gap-3 w-full h-56 rounded-xl border border-border bg-muted/30">
						{imagePreview && (
							<img
								src={imagePreview}
								alt="Receipt preview"
								className="max-h-24 max-w-full object-contain rounded opacity-40"
							/>
						)}
						<p className="text-sm text-muted-foreground animate-pulse">
							Extracting items…
						</p>
					</div>
				)}

				{error && <p className="text-sm text-destructive">{error}</p>}

				{phase.kind === "selecting" && (
					<>
						{imagePreview && (
							<img
								src={imagePreview}
								alt="Receipt"
								className="w-full max-h-40 object-cover rounded-lg border border-border"
							/>
						)}

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">Select your items</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								{phase.items.map((selection, i) => (
									<LineItemRow
										key={i}
										selection={selection}
										onQuantityChange={(next) => updateQuantity(i, next)}
									/>
								))}
							</CardContent>
						</Card>

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

						<Button variant="outline" className="w-full" onClick={reset}>
							Start over
						</Button>
					</>
				)}
			</div>
		</main>
	)
}
