import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, GeminiEventData } from "../types";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

interface GeminiResponse {
  reply: string;
  suggestions: string[];
  eventData?: GeminiEventData;
}

const SYSTEM_PROMPT = `You are an event creation assistant. Collect event data conversationally — never use form language.

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

Rules:
- Ask one field at a time. Be warm and brief.
- Confirm each value back naturally before moving on.
- If value is invalid, explain why and re-ask.
- If user writes in another language, respond in that language but extract values in English schema.
- When all fields are collected, output collected data as JSON inside <event_data></event_data> tags.
- After EVERY response, output 2-4 relevant suggestion chips  based on user responses as JSON array inside <suggestions></suggestions> tags.
- Never collect data beyond what is listed above.

- If collecting event_name: suggestions must be example event names like ["Tech Summit 2026", "Product Launch", "Team Offsite", "Workshop"]
- If collecting subheading: suggestions must be ["Add a subheading", "Skip this field"]
- If collecting description: suggestions must be ["Describe the event purpose", "Skip for now"]
- If collecting timezone: suggestions must ALWAYS be exactly ["UTC", "Asia/Kathmandu", "America/New_York", "Europe/London"]
- If collecting status: suggestions must ALWAYS be exactly ["Draft", "Published", "Cancelled"]
- If collecting start_date or end_date or vanish_date: suggestions must be ["Tomorrow", "Next week", "Next month", "Enter custom date"]
- If collecting roles: suggestions must be ["Organiser", "Speaker", "Attendee", "Volunteer"]
- If asking for confirmation: suggestions must be ["Yes, create it", "Edit something"]
- Output suggestions as a JSON array in <suggestions> tags. Always. Every response.`;

export const sendChatMessage = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  state: Record<string, any>,
): Promise<GeminiResponse> => {
  try {
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const collectedFields =
      Object.keys(state)
        .map((k) => `${k}: ${state[k]}`)
        .join("\n") || "No fields collected yet";

    const systemPromptWithContext = `${SYSTEM_PROMPT}

Current state: ${JSON.stringify(state)}
Collected so far:
${collectedFields}`;

    const conversationContent = conversationHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : msg.role,
      parts: [{ text: msg.content }],
    }));

    conversationContent.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const delays = [2000, 4000, 8000];
    let response: any;
    let lastErr: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await model.generateContent({
          contents: conversationContent,
          systemInstruction: systemPromptWithContext,
        });
        break;
      } catch (err) {
        lastErr = err;
        const status = (err as any)?.status || (err as any)?.code;
        const isQuota = status === 429 || /quota|429/i.test(String(err));
        if (isQuota && attempt < 2) {
          const delay = delays[attempt];
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        // Non-retryable error or no attempts left
        throw err;
      }
    }

    if (!response) {
      // All retries exhausted for quota errors
      throw new Error(
        "AI service is temporarily busy. Please wait a moment and try again."
      );
    }

    const textContent = response.response.text();

    const eventDataMatch = textContent.match(
      /<event_data>([\s\S]*?)<\/event_data>/,
    );
    const suggestionsMatch = textContent.match(
      /<suggestions>([\s\S]*?)<\/suggestions>/,
    );

    let eventData: GeminiEventData | undefined;
    let suggestions: string[] = [];

    if (eventDataMatch) {
      try {
        eventData = JSON.parse(eventDataMatch[1]);
      } catch (e) {
        console.error("Failed to parse event_data JSON:", e);
      }
    }

    if (suggestionsMatch) {
      try {
        suggestions = JSON.parse(suggestionsMatch[1]);
      } catch (e) {
        console.error("Failed to parse suggestions JSON:", e);
        suggestions = [];
      }
    }

    const reply = textContent
      .replace(/<event_data>[\s\S]*?<\/event_data>/, "")
      .replace(/<suggestions>[\s\S]*?<\/suggestions>/, "")
      .trim();

    return {
      reply,
      suggestions: Array.isArray(suggestions) ? suggestions : [],
      eventData,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      "Failed to process chat message with Gemini API: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
};
