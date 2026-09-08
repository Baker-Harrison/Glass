import { estimateTokens } from "@earendil-works/pi-coding-agent";
// Pi owns the total. Category estimates never leave the main process as text.
export function contextUsage(session) {
  const raw = session.getContextUsage();
  const usage = raw && { ...raw };
  if (!usage) return undefined;
  const streaming = session.state?.streamingMessage;
  if (usage.tokens != null && streaming?.role === "assistant") {
    usage.tokens += estimateTokens(streaming);
    usage.percent = (usage.tokens / usage.contextWindow) * 100;
  }
  const rulesChars = (
    session.resourceLoader?.getAgentsFiles().agentsFiles || []
  )
    .filter(({ content }) => content && session.systemPrompt?.includes(content))
    .reduce((sum, { content }) => sum + content.length, 0);
  const rules = Math.ceil(rulesChars / 4);
  const active = new Set(session.getActiveToolNames());
  const tools = session.getAllTools().filter((tool) => active.has(tool.name));
  const system = Math.max(
    0,
    Math.ceil((session.systemPrompt?.length || 0) / 4) - rules,
  );
  const definitions = Math.ceil(
    JSON.stringify(
      tools.map(({ name, description, parameters }) => ({
        name,
        description,
        parameters,
      })),
    ).length / 4,
  );
  // Before a provider response Pi estimates messages alone. Do not pretend that
  // this partial total includes the system prompt and tool schemas.
  const measured = session.messages.some(
    (message) =>
      message.role === "assistant" &&
      !["error", "aborted"].includes(message.stopReason) &&
      message.usage?.totalTokens > 0,
  );
  const canAllocate =
    measured &&
    usage.tokens != null &&
    usage.tokens >= system + definitions + rules;
  return {
    ...usage,
    breakdown: [
      {
        id: "system",
        label: "System prompt",
        tokens: canAllocate ? system : null,
      },
      {
        id: "tools",
        label: "Tool definitions",
        tokens: canAllocate ? definitions : null,
      },
      {
        id: "rules",
        label: "Rules",
        tokens: canAllocate && rules ? rules : null,
        applicable: rules > 0,
      },
      { id: "skills", label: "Skills", tokens: null, applicable: false },
      {
        id: "dynamic",
        label: "MCP & dynamic tools",
        tokens: null,
        applicable: false,
      },
      {
        id: "subagents",
        label: "Subagent definitions",
        tokens: null,
        applicable: false,
      },
      {
        id: "conversation",
        label: "Conversation",
        tokens: canAllocate
          ? usage.tokens - system - definitions - rules
          : null,
      },
    ],
  };
}
