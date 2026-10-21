import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/** Gives every request an id (or keeps the caller's) and echoes it back for tracing. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = req.header("x-request-id") || randomUUID();
    req.headers["x-request-id"] = id;
    res.setHeader("x-request-id", id);
    next();
  }
}
