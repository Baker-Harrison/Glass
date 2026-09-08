// UI-only timing metadata. Never modify the provider's message content.
export class MessageTimings {
  constructor(records = []) {
    this.records = new Map(
      records
        .filter((record) => record && Number.isFinite(record.timestamp))
        .map((record) => [record.timestamp, record]),
    );
  }
  decorate(message) {
    const timing =
      message.role === "assistant" && this.records.get(message.timestamp);
    return timing
      ? { ...message, glassTiming: structuredClone(timing) }
      : message;
  }
  track(event, now = Date.now()) {
    const message = event.message;
    if (message?.role !== "assistant" || !Number.isFinite(message.timestamp))
      return event;
    let record = this.records.get(message.timestamp);
    if (!record) {
      record = { timestamp: message.timestamp, startedAt: now, thinking: {} };
      this.records.set(message.timestamp, record);
    }
    const detail = event.assistantMessageEvent;
    if (detail && /^thinking_(start|delta|end)$/.test(detail.type)) {
      const item = (record.thinking[detail.contentIndex] ??= {
        startedAt: now,
      });
      if (detail.type === "thinking_end") item.endedAt = now;
    }
    if (event.type === "message_end") {
      record.endedAt = now;
      for (const item of Object.values(record.thinking)) item.endedAt ??= now;
    }
    return { ...event, message: this.decorate(message) };
  }
}
