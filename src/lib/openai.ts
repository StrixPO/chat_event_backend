import OpenAI from "openai";
import dotenv from "dotenv";
import { ChatMessage } from "../types";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY missing");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are an event creation assistant.

Your job:
Collect event fields step-by-step.

FIELDS:
- event_name (required)
- subheading (optional)
- description (required, min 20 chars)
- banner_image (string or "PENDING_UPLOAD")
- timezone
- status (DRAFT | PUBLISHED | CANCELLED)
- start_date (ISO 8601)
- end_date (ISO 8601)
- vanish_date (ISO 8601)
- roles (array of strings)

RULES:
- Ask ONE question at a time
- Be short and natural
- Never repeat already collected fields
- Validate dates logically
- When complete, output final JSON

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "reply": "string",
  "collectedState": {},
  "eventData": null,
  "suggestions": []
}

If event is complete:
- set eventData with full object
- keep collectedState final state
`;

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  state: Record<string, any>,
) {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },

    ...history.slice(-6).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),

    {
      role: "user" as const,
      content: `
USER MESSAGE: ${userMessage}
CURRENT STATE: ${JSON.stringify(state)}
`,
    },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    temperature: 0.4,
    response_format: {
      type: "json_object",
    },
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty OpenAI response");
  }

  const parsed = JSON.parse(content);

  return {
    reply: parsed.reply ?? "",
    collectedState: parsed.collectedState ?? {},
    eventData: parsed.eventData ?? null,
    suggestions: parsed.suggestions ?? [],
  };
}
