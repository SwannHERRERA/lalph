import type { OutputTransformer } from "../domain/CliAgent.ts"
import { Schema, Stream } from "effect"
import { ansiColors } from "../shared/ansi-colors.ts"
import { streamFilterJson } from "../shared/stream.ts"

export const piOutputTransformer: OutputTransformer = (stream) =>
  stream.pipe(
    streamFilterJson(PiJsonEvent),
    Stream.map((event) => event.format()),
  )

class PiJsonEvent extends Schema.Class<PiJsonEvent>("pi/PiJsonEvent")({
  type: Schema.String,
  assistantMessageEvent: Schema.optional(Schema.Unknown),
  toolName: Schema.optional(Schema.String),
  args: Schema.optional(Schema.Unknown),
  result: Schema.optional(Schema.Unknown),
  isError: Schema.optional(Schema.Boolean),
  attempt: Schema.optional(Schema.Number),
  maxAttempts: Schema.optional(Schema.Number),
  delayMs: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(Schema.String),
  finalError: Schema.optional(Schema.String),
  event: Schema.optional(Schema.String),
  extensionPath: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
}) {
  format(): string {
    switch (this.type) {
      case "session":
        return dim("[Session started]") + "\n"
      case "message_update":
        return formatAssistantMessageEvent(this.assistantMessageEvent)
      case "tool_execution_start":
        return formatToolStart(this.toolName, this.args)
      case "tool_execution_end":
        return formatToolEnd(this.toolName, this.result, this.isError)
      case "compaction_start":
        return "\n" + dim("[Compacting context]") + "\n"
      case "auto_retry_start":
        return (
          "\n" +
          yellow(
            `↻ Retrying${this.attempt ? ` ${this.attempt}/${this.maxAttempts ?? "?"}` : ""}`,
          ) +
          (this.errorMessage
            ? dim(` ${truncate(this.errorMessage, 100)}`)
            : "") +
          "\n"
        )
      case "auto_retry_end":
        return this.finalError
          ? yellow(`✗ Retry failed: ${truncate(this.finalError, 120)}`) + "\n"
          : ""
      case "extension_error":
        return (
          yellow("✗ Extension error") +
          (this.event ? dim(` during ${this.event}`) : "") +
          (this.error ? `: ${truncate(this.error, 120)}` : "") +
          "\n"
        )
      case "agent_end":
        return "\n" + green("✓ Done") + "\n"
      default:
        return ""
    }
  }
}

const dim = (s: string) => ansiColors.dim + s + ansiColors.reset
const cyan = (s: string) => ansiColors.cyan + s + ansiColors.reset
const yellow = (s: string) => ansiColors.yellow + s + ansiColors.reset
const green = (s: string) => ansiColors.green + s + ansiColors.reset

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "..." : s

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringField = (value: Record<string, unknown>, field: string) => {
  const fieldValue = value[field]
  return typeof fieldValue === "string" ? fieldValue : undefined
}

const formatAssistantMessageEvent = (event: unknown): string => {
  if (!isRecord(event)) return ""
  const type = stringField(event, "type")
  switch (type) {
    case "text_delta":
      return stringField(event, "delta") ?? ""
    case "error": {
      const reason = stringField(event, "reason")
      return "\n" + yellow(`✗ ${reason ?? "Error"}`) + "\n"
    }
    default:
      return ""
  }
}

const formatToolStart = (toolName: string | undefined, args: unknown) => {
  const name = toolName ?? "tool"
  return "\n" + cyan("▶ " + name) + "\n" + formatToolArgs(name, args)
}

const formatToolArgs = (toolName: string, args: unknown): string => {
  if (!isRecord(args)) return ""
  if (toolName === "bash") {
    const command = stringField(args, "command")
    return command ? dim("$ " + truncate(command, 100)) + "\n" : ""
  }
  const path = stringField(args, "path") ?? stringField(args, "filePath")
  if (path) return dim(path) + "\n"
  const pattern = stringField(args, "pattern")
  if (pattern) return dim(pattern) + "\n"
  const json = JSON.stringify(args)
  return json ? dim(truncate(json, 100)) + "\n" : ""
}

const formatToolEnd = (
  toolName: string | undefined,
  result: unknown,
  isError: boolean | undefined,
) => {
  let output = ""
  if (isError) output += yellow(`✗ ${toolName ?? "Tool"} failed`) + "\n"
  const text = extractResultText(result).trim()
  if (text.length > 0) output += formatLongOutput(text)
  return output
}

const extractResultText = (value: unknown): string => {
  if (!isRecord(value)) return ""
  const content = value.content
  if (!Array.isArray(content)) return ""
  return content
    .flatMap((item) => {
      if (!isRecord(item)) return []
      if (item.type !== "text") return []
      const text = stringField(item, "text")
      return text ? [text] : []
    })
    .join("\n")
}

const formatLongOutput = (text: string): string => {
  const lines = text.split("\n")
  if (lines.length > 8) {
    const preview = [
      ...lines.slice(0, 4),
      `... (${lines.length - 7} more lines)`,
      ...lines.slice(-3),
    ].join("\n")
    return dim(preview) + "\n"
  }
  return text.length > 500 ? dim(truncate(text, 500)) + "\n" : dim(text) + "\n"
}
