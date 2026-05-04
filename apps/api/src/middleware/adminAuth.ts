import type { RequestHandler } from "express";
import { config } from "../config";

/**
 * Compares `x-api-key` header to configured admin key (constant-time not required for demo scope).
 */
export const requireAdminKey: RequestHandler = (req, res, next) => {
  const key = req.header("x-api-key");
  if (!key || key !== config.adminApiKey) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or missing x-api-key" });
    return;
  }
  next();
};
