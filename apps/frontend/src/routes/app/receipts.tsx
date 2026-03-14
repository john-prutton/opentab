import { useState } from "react"

import * as Effect from "effect/Effect"
import * as Function from "effect/Function"

import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@repo/ui/components/button"

import { ApiClient } from "@/lib/api-client"

export const Route = createFileRoute("/app/receipts")({
	component: ReceiptsPage,
})

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

// ─── page ─────────────────────────────────────────────────────────────────────

function ReceiptsPage() {
	const navigate = useNavigate()
	const [extracting, setExtracting] = useState(false)
	const [imagePreview, setImagePreview] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const handleFile = (file: File) => {
		setError(null)
		const reader = new FileReader()
		reader.onload = (evt) => {
			const dataUrl = evt.target?.result as string
			setImagePreview(dataUrl)
			extractAndCreate(dataUrl)
		}
		reader.readAsDataURL(file)
	}

	const extractAndCreate = (imageDataUrl: string) => {
		setExtracting(true)

		Function.pipe(
			ApiClient,
			Effect.andThen((api) =>
				Effect.gen(function* () {
					const items = yield* api.receipt.extract({
						payload: { imageDataUrl },
					})
					const { id } = yield* api.receipt.createSession({
						payload: { imageDataUrl, items },
					})
					return id
				}),
			),
			Effect.runPromise,
		)
			.then((id) => {
				navigate({ to: "/app/receipts/$receiptId", params: { receiptId: id } })
			})
			.catch(() => {
				setExtracting(false)
				setError("Failed to process receipt. Please try again.")
			})
	}

	return (
		<main className="min-h-svh flex flex-col items-center py-12 px-4">
			<div className="w-full max-w-md space-y-4">
				<h1 className="text-2xl font-bold">New Receipt</h1>

				{!extracting && <UploadZone onFile={handleFile} />}

				{extracting && (
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

				{error && (
					<Button
						variant="outline"
						className="w-full"
						onClick={() => {
							setError(null)
							setImagePreview(null)
						}}
					>
						Try again
					</Button>
				)}
			</div>
		</main>
	)
}
