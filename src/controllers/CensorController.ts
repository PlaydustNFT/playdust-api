import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import { ddbmapper } from "../services/dynamodb";
import { attributeExists } from "@aws/dynamodb-expressions";

import { NftMetadata } from "../ddbmodels/NftMetadata";
import { Collection } from "../ddbmodels/Collection";

import { CensorDataSizeConstraints, IndexNames } from "../helpers/constants";

import {
  prepareSetUpdateExpression,
  prepareDeleteUpdateExpression,
  prepareListUpdateFunctionExpression,
  calculateListAppendFunctionExpressionType,
} from "../helpers/dbexpressions";

export type ReadCensorRequest = {
  wallet: string;
  type: string;
};

export type RemoveCensorRequest = {
  wallet: string;
  type: string;
};

export type UpdateCensorRequest = {
  wallet: string;
  type: string;
};

export default class CensorController {
  /**
   * This call must be gated by the verify token middleware
   * This call must be gated by the verify authorization middleware
   *
   * updates the mint's censorship state
   *
   * @param req
   * @param res
   * @param next
   */
  static updateMintCensor(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      UpdateCensorRequest
    >,
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
            item.censorList,
            (element) => element.type === req.body.type
          );
        if (!functionExpressionType) {
          console.log(
            `Censor [type=${req.body.type}] already exists for mint [${req.params.id}]`
          );
          next(createError(401, "Censor already exists for mint"));
          return;
        }

        const trimmedtype = req.body.type.substring(
          0,
          Math.min(req.body.type.length, CensorDataSizeConstraints.type)
        );
        const attributeName = "censorList";
        const data = {
          wallet: req.body.wallet,
          type: trimmedtype,
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
          .executeUpdateExpression(expr, { mint: mint.mint }, NftMetadata, {
            condition: {
              ...attributeExists(),
              subject: "mint",
            },
          })
          .then(() => {
            console.log(`Update censor list successful`);
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update censor list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(
          `mint does not exist: ${req.params.id}. Error: ${JSON.stringify(err)}`
        );
        next(createError(401, "Mint not found"));
      });
  }

  /**
   * This call must be gated by the verify token middleware
   * This call must be gated by the verify authorization middleware
   *
   * updates the collection's censorship state
   *
   * @param req
   * @param res
   * @param next
   */
  static updateCollectionCensor(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      UpdateCensorRequest
    >,
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
            item.censorList,
            (element) => element.type === req.body.type
          );
        if (!functionExpressionType) {
          console.log(
            `Censor [type=${req.body.type}] already exists for collection [${req.params.id}]`
          );
          next(createError(401, "Censor already exists for collection"));
          return;
        }

        const trimmedtype = req.body.type.substring(
          0,
          Math.min(req.body.type.length, CensorDataSizeConstraints.type)
        );
        const attributeName = "censorList";
        const data = {
          wallet: req.body.wallet,
          type: trimmedtype,
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
          .then(async () => {
            console.log(`Update censor list successful`);
            for await (const mint of ddbmapper.query(
              NftMetadata,
              { heuristicCollectionId: collection.id },
              { indexName: IndexNames.NftMetadata.collection }
            )) {
              if (
                mint.censorList?.find(
                  (element) => element.type === req.body.type
                )
              ) {
                continue;
              } else {
                // ideally, we should batchUpdate these items, but mapper api doesn't support batchUpdate
                const functionExpressionType =
                  calculateListAppendFunctionExpressionType(
                    mint.censorList,
                    (element) => element.type === req.body.type
                  );
                const expr = prepareSetUpdateExpression(
                  attributeName,
                  prepareListUpdateFunctionExpression(
                    functionExpressionType,
                    attributeName,
                    data
                  )
                );
                ddbmapper
                  .executeUpdateExpression(
                    expr,
                    { mint: mint.mint },
                    NftMetadata,
                    {
                      condition: {
                        ...attributeExists(),
                        subject: "mint",
                      },
                    }
                  )
                  .then(() => {
                    console.log(`Update censor list of mint successful`);
                  })
                  .catch((err) => {
                    console.error(
                      `Failed to update censor list of mint: ${err}`
                    );
                    next(err);
                  });
              }
            }
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update censor list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(
          `Collection does not exist: ${req.params.id}. Error: ${JSON.stringify(
            err
          )}`
        );
        next(createError(401, "Collection not found"));
      });
  }

  /**
   * This call must be gated by the verify token middleware
   * This call must be gated by the verify authorization middleware
   *
   * removes the mint's censorship state for a given censorship type
   *
   * @param req
   * @param res
   * @param next
   */
  static removeMintCensor(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      RemoveCensorRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    const mint = new NftMetadata();
    mint.mint = req.params.id;

    ddbmapper
      .get(mint)
      .then((item) => {
        console.log(`Locate mint successful for: ${req.params.id}`);
        const censorIndex = item?.censorList.findIndex(
          (element) => element.type === req.body.type
        );
        if (censorIndex === -1) {
          console.log(
            `Censor [type=${req.body.type}] does not exist for mint [${req.params.id}] | censorIndex==> ${censorIndex}`
          );
          next(createError(401, "Censor does not exist for mint"));
          return;
        }

        const toDelete = "censorList[" + censorIndex + "]";
        const expr = prepareDeleteUpdateExpression(toDelete);
        ddbmapper
          .executeUpdateExpression(expr, { mint: mint.mint }, NftMetadata, {
            condition: {
              ...attributeExists(),
              subject: "mint",
            },
          })
          .then(() => {
            console.log(`Update censor list successful`);
            res.send({
              success: true,
            });
          })
          .catch((err) => {
            console.error(`Failed to update censor list: ${err}`);
            next(err);
          });
      })
      .catch((err) => {
        console.log(`mint does not exist: ${req.params.id}`);
        next(createError(401, err));
      });
  }

  /**
   * This call must be gated by the verify token middleware
   * This call must be gated by the verify authorization middleware
   *
   * removes the collection's censorship state for a given censorship type
   *
   * @param req
   * @param res
   * @param next
   */
  static removeCollectionCensor(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      RemoveCensorRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    // TODO implement function
    // requires censor removal to be propogated to all mints of collection, similar to update logic
    next();
  }

  /**
   * This call must be gated by the verify token middleware
   * This call must be gated by the verify authorization middleware
   *
   * reads / responds with the mint's censorship state
   *
   * @param req
   * @param res
   * @param next
   */
  static readMintCensor(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      ReadCensorRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    const mint = new NftMetadata();
    mint.mint = req.params.id;

    ddbmapper
      .get(mint)
      .then((item) => {
        console.log(`Locate mint successful for: ${req.params.id}`);
        const response = {
          censorList: item?.censorList,
        };
        res.send(response);
      })
      .catch((err) => {
        console.log(
          `Mint does not exist: ${req.params.id}. Error: ${JSON.stringify(err)}`
        );
        next(createError(404, "Mint not found"));
      });
  }

  /**
   * This call must be gated by the verify token middleware
   * This call must be gated by the verify authorization middleware
   *
   * reads / responds with the collection's censorship state
   *
   * @param req
   * @param res
   * @param next
   */
  static readCollectionCensor(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      ReadCensorRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    const collection = new Collection();
    collection.id = req.params.id;

    ddbmapper
      .get(collection)
      .then((item) => {
        console.log(`Locate collection successful for: ${collection.id}`);
        const response = {
          censorList: item.censorList,
        };
        res.send(response);
      })
      .catch((err) => {
        console.log(
          `Collection does not exist: ${req.params.id}. Error: ${JSON.stringify(
            err
          )}`
        );
        next(createError(401, "Collection not found"));
      });
  }
}
