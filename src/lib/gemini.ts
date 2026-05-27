import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { ChatMessage, GeminiEventData, GeminiResponse } from "../types";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

CRITICAL RULES:
- Check "Collected so far" FIRST before every response. NEVER ask for a field already listed there.
- Move to the next uncollected field only.
- Ask one field at a time. Be warm and brief.
- Confirm each value back naturally before moving on.
- If value is invalid, explain why and re-ask ONLY that field.
- If user writes in another language, respond in that language but extract values in English schema.
- When ALL 10 fields are collected, output final data as JSON inside <event_data></event_data> tags.
- After EVERY response, output 2-4 suggestion chips as JSON inside <suggestions></suggestions> tags.
- After EVERY response where at least one field is confirmed, output ALL confirmed fields so far as JSON inside <collected_state></collected_state> tags.
- Never collect data beyond the 10 fields listed.

SUGGESTION RULES:
- event_name: ["Tech Summit 2026", "Product Launch", "Team Offsite", "Workshop"]
- subheading: ["Add a subheading", "Skip this field"]
- description: ["Describe the event purpose", "Skip for now"]
- timezone: ["UTC", "Asia/Kathmandu", "America/New_York", "Europe/London"]
- status: ["Draft", "Published", "Cancelled"]
- start_date/end_date/vanish_date: ["Tomorrow", "Next week", "Next month", "Enter custom date"]
- roles: ["Organiser", "Speaker", "Attendee", "Volunteer"]
- confirmation: ["Yes, create it", "Edit something"]`;

export const sendChatMessage = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  state: Record<string, any>,
): Promise<GeminiResponse> => {
  try {
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    // FIX 2: Generate system parameters cleanly without raw JSON text dumps
    const collectedFields =
      Object.keys(state)
        .map(
          (k) =>
            `${k}: ${typeof state[k] === "object" ? JSON.stringify(state[k]) : state[k]}`,
        )
        .join("\n") || "No fields collected yet";

    const systemPromptWithContext = `${SYSTEM_PROMPT}

Collected so far:
${collectedFields}`;

    // FIX 1: Max 4 messages history context boundary to stop the Token Snowball
    const recentHistory = conversationHistory.slice(-4);

    const conversationContent = recentHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : msg.role,
      parts: [{ text: msg.content }],
    }));

    conversationContent.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    // FIX 3: Back-off recovery window spaced to clear 60-second RPM buckets
    const delays = [6000, 12000];
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
        throw err;
      }
    }

    if (!response) {
      throw new Error(
        "AI service is temporarily busy. Please try again in a minute.",
      );
    }

    const textContent = response.response.text();

    const eventDataMatch = textContent.match(
      /<event_data>([\s\S]*?)<\/event_data>/,
    );
    const suggestionsMatch = textContent.match(
      /<suggestions>([\s\S]*?)<\/suggestions>/,
    );
    const collectedStateMatch = textContent.match(
      /<collected_state>([\s\S]*?)<\/collected_state>/,
    );

    let collectedState: Record<string, any> | undefined;
    if (collectedStateMatch) {
      try {
        collectedState = JSON.parse(collectedStateMatch[1]);
      } catch (e) {
        console.error("Failed to parse collected_state JSON:", e);
      }
    }

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
      .replace(/<collected_state>[\s\S]*?<\/collected_state>/, "")
      .trim();

    return {
      reply,
      suggestions: Array.isArray(suggestions) ? suggestions : [],
      eventData,
      collectedState,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
};
