import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  email?: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  consent_given_at: Date | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface Event {
  id: string;
  user_id: string;
  event_name: string;
  subheading: string | null;
  description: string;
  banner_image_url: string | null;
  timezone: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  start_date: Date | null;
  end_date: Date | null;
  vanish_date: Date | null;
  roles: string[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ChatSession {
  id: string;
  user_id: string;
  event_id: string | null;
  messages: ChatMessage[];
  state: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GeminiEventData {
  event_name: string;
  subheading?: string;
  description: string;
  banner_image?: string;
  timezone: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  start_date: string;
  end_date: string;
  vanish_date: string;
  roles: string[];
}

export interface ChatResponse {
  reply: string;
  suggestions: string[];
  eventCreated: boolean;
  eventId?: string;
}
