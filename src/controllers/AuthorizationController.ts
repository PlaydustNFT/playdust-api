import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import { User } from "../ddbmodels/User";
import { ddbmapper } from "../services/dynamodb";
import { ADMIN_ROLE_NAME } from "../helpers/constants";

export type AuthorizationRequest = {
  wallet: string;
  nonce?: string;
};

export default class AuthorizationController {
  /**
   * verify admin role
   *
   * @param req
   * @param res
   * @param next
   */
  static async verifyAdminRole(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      AuthorizationRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    // verify current wallet has admin role
    const user = new User();
    user.wallet = req.body.wallet;
    user.nonce = req.body.nonce;

    ddbmapper
      .get(user)
      .then((item) => {
        console.log(`User exists ${user.wallet}`);
        const hasAdminRole = item.roles?.find(
          (element) => element.toLowerCase() === ADMIN_ROLE_NAME.toLowerCase()
        );
        if (hasAdminRole) {
          next();
        } else {
          console.log(
            `User ${req.body.wallet} does not have admin role assigned`
          );
          next(createError(401, "Unauthorized request"));
        }
      })
      .catch((err) => {
        console.log(`Invalid user ${user.wallet}; ${err}`);
        next(createError(401, "Invalid user"));
      });
  }
}
