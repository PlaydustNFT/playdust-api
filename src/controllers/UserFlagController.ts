import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import { attributeExists } from "@aws/dynamodb-expressions";

import { ddbmapper } from "../services/dynamodb";
import { NftMetadata } from "../ddbmodels/NftMetadata";
import { Collection } from "../ddbmodels/Collection";
import { UserFlagSizeConstraints } from "../helpers/constants";

import {
  prepareSetUpdateExpression,
  prepareListUpdateFunctionExpression,
  calculateListAppendFunctionExpressionType,
} from "../helpers/dbexpressions";

export type FlagRequest = {
  wallet: string;
  reason: string;
};

// TODO: Extract common logic from these functions so that there's less code repetition
export default class UserFlagController {
  /**
   * This call must be gated by the verify token middleware
   *
   * adds new entry to the mint's user flag attribute
   *
   * @param req
   * @param res
   * @param next
   */
  static updateMintUserFlagList(
    req: Request<Record<string, string>, Record<string, unknown>, FlagRequest>,
    res: Response,
    next: NextFunction
  ) {
    const mint = new NftMetadata();
    mint.mint = req.params.id;

    ddbmapper
      .get(mint)
      .then((item) => {
        console.log(`Locate mint successful for: ${req.params.id}`);
        const functionExpressionType =
          calculateListAppendFunctionExpressionType(
            item.userFlagList,
            (element) => element.wallet === req.body.wallet
          );
        if (!functionExpressionType) {
          next(
            new createError.Forbidden("User cannot flag mint more than once")
          );
          return;
        }
        const trimmedReason = req.body.reason.substring(
          0,
          Math.min(req.body.reason.length, UserFlagSizeConstraints.reason)
        );
        const data = {
          wallet: req.body.wallet,
          reason: trimmedReason,
          datetime: new Date().toISOString(),
        };
        const attributeName = "userFlagList";
        const expr = prepareSetUpdateExpression(
          attributeName,
          prepareListUpdateFunctionExpression(
            functionExpressionType,
            attributeName,
            data
          )
        );
        ddbmapper
          .executeUpdateExpression(expr, { mint: mint.mint }, NftMetadata, {
            condition: {
              ...attributeExists(),
              subject: "mint",
            },
          })
          .then(() => {
            console.log(`Update user flag list successful`);
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update user flag list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(
          `Mint does not exist: ${mint.mint}. Error: ${JSON.stringify(err)}`
        );
        next(new createError.NotFound("Mint not found"));
      });
  }

  /**
   * Adds new entry to the collection's user flag attribute.
   * This call must be gated by the verify token middleware.
   *
   * @param req
   * @param res
   * @param next
   */
  static updateCollectionUserFlagList(
    req: Request<Record<string, string>, Record<string, unknown>, FlagRequest>,
    res: Response,
    next: NextFunction
  ) {
    const collection = new Collection();
    collection.id = req.params.id;

    ddbmapper
      .get(collection)
      .then((item) => {
        console.log(`Locate collection successful for: ${req.params.id}`);
        const functionExpressionType =
          calculateListAppendFunctionExpressionType(
            item.userFlagList,
            (element) => element.wallet === req.body.wallet
          );
        if (!functionExpressionType) {
          next(
            new createError.Forbidden("User cannot flag mint more than once")
          );
          return; // no more processing required
        }

        const trimmedReason = req.body.reason.substring(
          0,
          Math.min(req.body.reason.length, UserFlagSizeConstraints.reason)
        );
        const attributeName = "userFlagList";
        const data = {
          wallet: req.body.wallet,
          reason: trimmedReason,
          datetime: new Date().toISOString(),
        };
        const expr = prepareSetUpdateExpression(
          attributeName,
          prepareListUpdateFunctionExpression(
            functionExpressionType,
            attributeName,
            data
          )
        );

        ddbmapper
          .executeUpdateExpression(expr, { id: collection.id }, Collection, {
            condition: {
              ...attributeExists(),
              subject: "id",
            },
          })
          .then(() => {
            console.log(`Update user flag list successful`);
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update user flag list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(
          `Collection does not exist: ${req.params.id}. Error: ${JSON.stringify(
            err
          )}`
        );
        next(new createError.NotFound("Collection not found"));
      });
  }

  /**
   * Adds new entry to the mint's user stale flag attribute
   * This call must be gated by the verify token middleware.
   *
   * @param req
   * @param res
   * @param next
   */
  static updateMintStaleMetadataFlagList(
    req: Request<Record<string, string>, Record<string, unknown>>,
    res: Response,
    next: NextFunction
  ) {
    const mint = new NftMetadata();
    mint.mint = req.params.id;

    ddbmapper
      .get(mint)
      .then((item) => {
        const functionExpressionType =
          calculateListAppendFunctionExpressionType(
            item.staleFlagList,
            (element) => element.wallet === req.body.wallet
          );
        if (!functionExpressionType) {
          next(
            new createError.Forbidden("User cannot flag mint more than once")
          );
          return;
        }
        const data = {
          wallet: req.body.wallet,
          datetime: new Date().toISOString(),
        };

        const attributeName = "staleFlagList";
        const expr = prepareSetUpdateExpression(
          attributeName,
          prepareListUpdateFunctionExpression(
            functionExpressionType,
            attributeName,
            data
          )
        );

        ddbmapper
          .executeUpdateExpression(expr, { mint: mint.mint }, NftMetadata, {
            condition: {
              ...attributeExists(),
              subject: "mint",
            },
          })
          .then(() => {
            console.log(`Update user flag list successful`);
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update user flag list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(
          `Mint does not exist: ${mint.mint}. Error: ${JSON.stringify(err)}`
        );
        next(new createError.NotFound("Mint not found"));
      });
  }

  /**
   * This call must be gated by the verify token middleware
   *
   * adds new entry to the collection's user flag attribute
   *
   * @param req
   * @param res
   * @param next
   */
  static updateCollectionStaleMetadataFlagList(
    req: Request<Record<string, string>, Record<string, unknown>, FlagRequest>,
    res: Response,
    next: NextFunction
  ) {
    const collection = new Collection();
    collection.id = req.params.id;

    ddbmapper
      .get(collection)
      .then((item) => {
        const functionExpressionType =
          calculateListAppendFunctionExpressionType(
            item.staleFlagList,
            (element) => element.wallet === req.body.wallet
          );
        if (!functionExpressionType) {
          next(
            new createError.Forbidden(
              "User cannot stale-flag collection more than once"
            )
          );
          return; // no more processing required
        }

        const attributeName = "staleFlagList";
        const data = {
          wallet: req.body.wallet,
          datetime: new Date().toISOString(),
        };
        const expr = prepareSetUpdateExpression(
          attributeName,
          prepareListUpdateFunctionExpression(
            functionExpressionType,
            attributeName,
            data
          )
        );

        ddbmapper
          .executeUpdateExpression(expr, { id: collection.id }, Collection, {
            condition: {
              ...attributeExists(),
              subject: "id",
            },
          })
          .then(() => {
            console.log(`Update user flag list successful`);
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update user flag list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(
          `Collection does not exist: ${req.params.id}. Error: ${JSON.stringify(
            err
          )}`
        );
        next(new createError.NotFound("Collection not found"));
      });
  }
}
