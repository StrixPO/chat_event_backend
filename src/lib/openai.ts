import OpenAI from "openai";
import dotenv from "dotenv";
import { ChatMessage, GeminiEventData, GeminiResponse } from "../types";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are an event creation assistant. Collect event data conversationally — never use form language.

Fields to collect in order:
1. event_name (string, required)
2. subheading (string, optional — accept "skip")
3. description (string, required, min 20 chars)
4. banner_image (tell user to upload, set field to "PENDING_UPLOAD")
5. timezone (IANA string)
6. status (DRAFT | PUBLISHED | CANCELLED, default DRAFT)
7. start_date (ISO 8601)
8. end_date (ISO 8601, must be after start_date)
9. vanish_date (ISO 8601, must be after end_date)
10. roles (array of strings)

CRITICAL RULES:
- Check "Collected so far" FIRST before every response.
- NEVER ask for a field already listed there.
- Move only to next uncollected field.
- Ask one field at a time.
- Be warm and brief.
- Confirm values naturally.
- If invalid, explain and ask only that field again.
- If user uses another language, reply in that language but convert extracted values into English schema.
- When all fields collected output final JSON inside:
<event_data></event_data>

- After EVERY response output suggestions:
<suggestions></suggestions>

- After EVERY response where fields were confirmed output:
<collected_state></collected_state>

Never collect anything outside these fields.

SUGGESTION RULES:
event_name:
["Tech Summit 2026","Product Launch","Team Offsite","Workshop"]

subheading:
["Add a subheading","Skip this field"]

description:
["Describe the event purpose"]

timezone:
["UTC","Asia/Kathmandu","America/New_York"]

status:
["Draft","Published","Cancelled"]

date fields:
["Tomorrow","Next week","Enter custom date"]

roles:
["Organiser","Speaker","Attendee"]

confirmation:
["Yes, create it","Edit something"]
`;

export const sendChatMessage = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  state: Record<string, any>,
): Promise<GeminiResponse> => {
  try {
    const collectedFields =
      Object.keys(state)
        .map((k) => {
          const value =
            typeof state[k] === "object" ? JSON.stringify(state[k]) : state[k];

          return `${k}: ${value}`;
        })
        .join("\n") || "No fields collected yet";

    const systemPromptWithContext = `
${SYSTEM_PROMPT}

Collected so far:
${collectedFields}
`;

    const recentHistory = conversationHistory.slice(-4);

    const messages = [
      {
        role: "system" as const,
        content: systemPromptWithContext,
      },

      ...recentHistory.map((msg) => ({
        role:
          msg.role === "assistant" ? ("assistant" as const) : ("user" as const),

        content: msg.content,
      })),

      {
        role: "user" as const,
        content: userMessage,
      },
    ];

    let response: any;
    const delays = [1000, 3000];
    let lastErr: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await client.chat.completions.create({
          model: "gpt-5-nano",

          messages,

          max_completion_tokens: 500,
        });

        break;
      } catch (err) {
        lastErr = err;

        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, delays[attempt]));

          continue;
        }

        throw err;
      }
    }

    if (!response) {
      throw new Error("AI service temporarily unavailable");
    }

    const textContent = response.choices?.[0]?.message?.content || "";

    const eventDataMatch = textContent.match(
      /<event_data>([\s\S]*?)<\/event_data>/,
    );

    const suggestionsMatch = textContent.match(
      /<suggestions>([\s\S]*?)<\/suggestions>/,
    );

    const collectedStateMatch = textContent.match(
      /<collected_state>([\s\S]*?)<\/collected_state>/,
    );

    let eventData: GeminiEventData | undefined;

    let suggestions: string[] = [];

    let collectedState: Record<string, any> | undefined;

    if (eventDataMatch) {
      try {
        eventData = JSON.parse(eventDataMatch[1]);
      } catch (e) {
        console.error("event_data parse error:", e);
      }
    }

    if (suggestionsMatch) {
      try {
        suggestions = JSON.parse(suggestionsMatch[1]);
      } catch (e) {
        console.error("suggestions parse error:", e);
      }
    }

    if (collectedStateMatch) {
      try {
        collectedState = JSON.parse(collectedStateMatch[1]);
      } catch (e) {
        console.error("collected_state parse error:", e);
      }
    }

    const reply = textContent
      .replace(/<event_data>[\s\S]*?<\/event_data>/, "")
      .replace(/<suggestions>[\s\S]*?<\/suggestions>/, "")
      .replace(/<collected_state>[\s\S]*?<\/collected_state>/, "")
      .trim();

    return {
      reply,

      suggestions: Array.isArray(suggestions) ? suggestions : [],

      eventData,

      collectedState,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);

    throw error;
  }
};
