import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import { User } from "../ddbmodels/User";
import { ddbmapper } from "../services/dynamodb";
import { attributeExists } from "@aws/dynamodb-expressions";
import {
  validateEmail,
  validateTwitterHandle,
  validateAttributeLength,
} from "../helpers/validator";
import {
  UserSizeConstraints,
  PUBLIC_USER_PROFILE_ATTRIBUTES,
} from "../helpers/constants";

export type ReadProfileRequest = {
  wallet: string;
  nonce?: string;
};

export type UpdateProfileRequest = {
  wallet: string;
  username?: string;
  email?: string;
  bio?: string;
  twitter?: string;
  pictureaddress: string;
};

export default class UserProfileController {
  /**
   *
   * This call must be gated by the verify token middleware
   * respond with user profile details for display purposes
   *
   * @param req
   * @param res
   * @param next
   */
  static async privateReadUser(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      ReadProfileRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    const user = new User();
    user.wallet = req.params.wallet;
    user.nonce = req.query.nonce as string;
    try {
      const item = await ddbmapper.get(user);
      res.send(item);
    } catch (err) {
      console.log(
        `Failed to lookup user: ${user.wallet}. Error: ${JSON.stringify(err)}`
      );
      next(createError(401, "User not found"));
    }
  }

  /**
   *
   * This returns only public user info and is not gated by authentication
   *
   * @param req
   * @param res
   * @param next
   */
  static async publicReadUser(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      ReadProfileRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    const user = new User();
    user.wallet = req.params.wallet;
    user.nonce = req.query.nonce as string;
    try {
      const item = await ddbmapper.get(user, {
        projection: PUBLIC_USER_PROFILE_ATTRIBUTES,
      });
      res.send(item);
    } catch (err) {
      console.log(
        `Failed to lookup user: ${user.wallet}. Error: ${JSON.stringify(err)}`
      );
      next(createError(401, "User not found"));
    }
  }

  /**
   *
   * update user profile details in database
   *
   * @param req
   * @param res
   * @param next
   */
  static updateUser(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      UpdateProfileRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    const user = new User();
    user.wallet = req.params.wallet;
    user.username = req.body?.username;
    user.email = req.body?.email;
    user.bio = req.body?.bio;
    user.twitter = req.body?.twitter;
    user.pictureaddress = req.body?.pictureaddress;
    user.updatedAt = new Date();

    if (!validateEmail(user?.email)) {
      // verify email formatting
      next(createError(401, "Invalid email address"));
    } else if (!validateTwitterHandle(user?.twitter)) {
      // verify twitter handle formatting
      next(createError(401, "Invalid twitter handle"));
    } else if (!validateAttributeLength(user?.bio, UserSizeConstraints.bio)) {
      next(createError(401, "Invalid bio length"));
    } else if (
      !validateAttributeLength(user?.username, UserSizeConstraints.username)
    ) {
      next(createError(401, "Invalid username length"));
    } else if (
      !validateAttributeLength(
        user?.pictureaddress,
        UserSizeConstraints.pictureaddress
      )
    ) {
      next(createError(401, "Invalid picture address length"));
    } else {
      ddbmapper
        .update(user, {
          onMissing: "skip",
          condition: {
            ...attributeExists(),
            subject: "wallet",
          },
        })
        .then((item) => {
          console.log(`item update successful: ${item}`);
          res.send({
            success: true,
          });
        })
        .catch((err) => {
          console.error(`Failed to update user profile: ${err}`);
          next(err);
        });
    }
  }
}
