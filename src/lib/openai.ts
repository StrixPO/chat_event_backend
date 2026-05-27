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

Your job is to collect event fields step-by-step conversationally.

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
- Be natural, short, conversational
- Never repeat already collected fields
- Infer next missing field from state

OUTPUT RULES:
- MOST responses must be plain conversational text only
- ONLY output JSON when ALL fields are complete

FINAL JSON FORMAT:
{
  "event_name": "",
  "subheading": "",
  "description": "",
  "banner_image": "",
  "timezone": "",
  "status": "",
  "start_date": "",
  "end_date": "",
  "vanish_date": "",
  "roles": []
}
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
User message: ${userMessage}
Collected state: ${JSON.stringify(state)}
      `.trim(),
    },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini", // keep this for stability
    messages,
    temperature: 0.4,
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    return {
      reply: "I didn't get a response. Try again.",
      collectedState: state,
      eventData: null,
      suggestions: [],
    };
  }

  // Try to detect JSON final output
  let parsed: any = null;

  try {
    parsed = JSON.parse(content);
  } catch {
    // Not JSON → normal chat response
    return {
      reply: content,
      collectedState: state,
      eventData: null,
      suggestions: [],
    };
  }

  // If JSON exists, treat as completion
  return {
    reply: "Event created successfully.",
    collectedState: parsed,
    eventData: parsed,
    suggestions: [],
  };
}
