import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Fail closed: a part of the request with no schema must be empty. Forgetting a schema then
// rejects unexpected input instead of letting it through unvalidated.
const NO_BODY = z.strictObject({}).optional(); // Express 5 leaves req.body undefined if none was sent
const NO_PARAMS = z.strictObject({});
const NO_QUERY = z.strictObject({});

/**
 * Validates body, params, and query with Zod and replaces them with the parsed values (trimmed,
 * coerced, defaults applied). A ZodError becomes a 400 VALIDATION_ERROR in the error handler.
 * Every route must use this (enforced by tests/security.test.ts).
 */
export function validate(schemas: Schemas = {}): RequestHandler {
  const body = schemas.body ?? NO_BODY;
  const params = schemas.params ?? NO_PARAMS;
  const query = schemas.query ?? NO_QUERY;

  // Named so tests can find it on every route's middleware stack.
  return function validateRequest(req: Request, _res: Response, next: NextFunction): void {
    req.body = body.parse(req.body);
    req.params = params.parse(req.params) as typeof req.params;
    // req.query is a getter in Express 5, so it has to be redefined rather than assigned.
    Object.defineProperty(req, 'query', {
      value: query.parse(req.query),
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
