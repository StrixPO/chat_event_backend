import { Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AuthenticatedRequest } from "../types";

export const validateRequest =
  (schema: ZodSchema, source: "body" | "query" | "params" = "body") =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const data = source === "body" ? req.body : source === "query" ? req.query : req.params;

      const validated = schema.parse(data);

      if (source === "body") {
        req.body = validated;
      } else if (source === "query") {
        req.query = validated;
      } else {
        req.params = validated;
      }

      next();
    } catch (error: any) {
      const statusCode = 400;
      const message = error.errors?.[0]?.message || "Validation error";

      res.status(statusCode).json({
        error: "Validation failed",
        details: message,
      });
    }
  };
