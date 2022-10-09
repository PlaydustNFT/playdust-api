import createError, { HttpError } from "http-errors";
import { Request, Response, NextFunction } from "express";

export default class ErrorController {
  /**
   * Catch `Not Found` endpoints
   */
  static notFound(req: Request, res: Response, next: NextFunction) {
    next(createError(404, "API endpoint not found"));
  }

  /**
   * Handle application errors
   */
  static handle(
    error: HttpError | Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).send(error);
    } else {
      res.status(400).send({ message: error.message });
    }
  }
}
