import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as AiError from "effect/unstable/ai/AiError"
import * as AnthropicStructuredOutput from "effect/unstable/ai/AnthropicStructuredOutput"
import * as LanguageModel from "effect/unstable/ai/LanguageModel"
import type * as Prompt from "effect/unstable/ai/Prompt"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"
const MODEL = "claude-opus-4-6"

type AnthropicContentPart =
	| { type: "text"; text: string }
	| {
			type: "image"
			source: { type: "base64"; media_type: string; data: string }
	  }

function promptToAnthropicArgs(
	prompt: Prompt.Prompt,
	responseFormat: LanguageModel.ProviderOptions["responseFormat"],
): {
	system: string | undefined
	messages: Array<{ role: string; content: AnthropicContentPart[] | string }>
	tools?: unknown[]
	tool_choice?: unknown
} {
	let system: string | undefined
	const messages: Array<{
		role: string
		content: AnthropicContentPart[] | string
	}> = []

	for (const msg of prompt.content) {
		if (msg.role === "system") {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			system = (msg as any).content as string
		} else if (msg.role === "user") {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rawContent = (msg as any).content
			const parts: AnthropicContentPart[] = []
			for (const part of Array.isArray(rawContent) ? rawContent : [{ type: "text", text: rawContent }]) {
				const p = part as { type: string; text?: string; data?: unknown; mediaType?: string }
				if (p.type === "text") {
					parts.push({ type: "text", text: p.text ?? "" })
				} else if (p.type === "file") {
					const data = p.data
					if (typeof data === "string" && data.includes(",")) {
						const commaIdx = data.indexOf(",")
						const header = data.slice(0, commaIdx) // "data:image/jpeg;base64"
						const base64 = data.slice(commaIdx + 1)
						const mediaType = header.replace("data:", "").replace(";base64", "")
						parts.push({
							type: "image",
							source: { type: "base64", media_type: mediaType, data: base64 },
						})
					}
				}
			}
			messages.push({ role: "user", content: parts })
		} else if (msg.role === "assistant") {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rawContent = (msg as any).content
			const parts: AnthropicContentPart[] = Array.isArray(rawContent)
				? rawContent.map((p: { text?: string }) => ({
						type: "text" as const,
						text: p.text ?? "",
					}))
				: [{ type: "text" as const, text: String(rawContent) }]
			messages.push({ role: "assistant", content: parts })
		}
	}

	const result: ReturnType<typeof promptToAnthropicArgs> = {
		system,
		messages,
	}

	if (responseFormat.type === "json") {
		const { jsonSchema } = AnthropicStructuredOutput.toCodecAnthropic(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			responseFormat.schema as any,
		)
		const toolName = responseFormat.objectName ?? "result"
		result.tools = [
			{
				name: toolName,
				description: `Extract ${toolName} from the provided content.`,
				input_schema: { type: "object", ...jsonSchema },
			},
		]
		result.tool_choice = { type: "tool", name: toolName }
	}

	return result
}

export const AnthropicLanguageModelLayer = Layer.effect(
	LanguageModel.LanguageModel,
	Effect.gen(function* () {
		const apiKey = yield* Config.string("ANTHROPIC_API_KEY").asEffect()
		const client = (yield* HttpClient.HttpClient).pipe(
			HttpClient.filterStatusOk,
		)

		const call = (body: Record<string, unknown>) =>
			Effect.scoped(
				client
					.execute(
						HttpClientRequest.post(ANTHROPIC_API).pipe(
							HttpClientRequest.setHeader("x-api-key", apiKey),
							HttpClientRequest.setHeader("anthropic-version", ANTHROPIC_VERSION),
							HttpClientRequest.setHeader("content-type", "application/json"),
							HttpClientRequest.bodyJsonUnsafe(body),
						),
					)
					.pipe(Effect.andThen((r) => r.json)),
			)

		return yield* LanguageModel.make({
			codecTransformer: AnthropicStructuredOutput.toCodecAnthropic,

			generateText: (options) =>
				Effect.gen(function* () {
					const { system, messages, tools, tool_choice } = promptToAnthropicArgs(
						options.prompt,
						options.responseFormat,
					)

					const body: Record<string, unknown> = {
						model: MODEL,
						max_tokens: 4096,
						messages,
					}
					if (system) body.system = system
					if (tools) body.tools = tools
					if (tool_choice) body.tool_choice = tool_choice

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const response = (yield* call(body)) as any

					if (options.responseFormat.type === "json") {
						const toolUse = (response.content as Array<{ type: string; input?: unknown }>).find(
							(b) => b.type === "tool_use",
						)
						if (toolUse?.input !== undefined) {
							return [{ type: "text" as const, text: JSON.stringify(toolUse.input) }]
						}
					}

					const textBlock = (response.content as Array<{ type: string; text?: string }>).find(
						(b) => b.type === "text",
					)
					return [{ type: "text" as const, text: textBlock?.text ?? "" }]
				}).pipe(
					Effect.mapError((cause) =>
						AiError.make({
							module: "Anthropic",
							method: "generateText",
							reason: new AiError.UnknownError({
								description: String(cause),
							}),
						}),
					),
				),

			streamText: (_options) =>
				Stream.fail(
					AiError.make({
						module: "Anthropic",
						method: "streamText",
						reason: new AiError.UnknownError({
							description: "Streaming is not implemented",
						}),
					}),
				),
		})
	}),
)
