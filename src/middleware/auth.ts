import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { AuthenticatedRequest, JWTPayload } from "../types";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

export const verifyJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET! as string
    ) as JWTPayload;

    req.userId = decoded.userId;
    req.email = decoded.email;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
    } else {
      res.status(500).json({ error: "Authentication error" });
    }
  }
};

export const generateAccessToken = (
  userId: string,
  email: string,
  expiresIn: string = "15m"
): string => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET! as string,
    { expiresIn: '15m' } as jwt.SignOptions
  );
};

export const generateRefreshToken = (
  userId: string,
  email: string,
  expiresIn: string = "7d"
): string => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET environment variable is not set");
  }

  return jwt.sign(
    { userId, email },
    process.env.JWT_REFRESH_SECRET! as string,
    { expiresIn: '7d' } as jwt.SignOptions
  );
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET environment variable is not set");
  }

  return jwt.verify(token, process.env.JWT_REFRESH_SECRET! as string) as JWTPayload;
};
