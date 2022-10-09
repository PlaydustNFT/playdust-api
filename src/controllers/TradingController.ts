import { AuctionHouseProgram } from "@metaplex-foundation/mpl-auction-house";
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

import { Request, Response, NextFunction } from "express";
import { equals } from "@aws/dynamodb-expressions";
import { ddbmapper } from "../services/dynamodb";
import { Order } from "../ddbmodels/Order";
import { Market } from "../ddbmodels/Market";
import { getTokenAmount } from "../helpers/utils";
import { connection } from "../helpers/actions";

export default class TradingController {
  /**
   * list available markets (token list)
   *
   * @param req
   * @param res
   * @param next
   */
  static async markets(req: Request, res: Response, next: NextFunction) {
    try {
      const markets = [];
      for await (const market of ddbmapper.scan(Market)) {
        markets.push(market);
      }
      res.send(markets);
    } catch (err) {
      next(err);
    }
  }

  /**
   * list orders for NFT
   *
   * @param req
   * @param res
   * @param next
   */
  static async orders(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      // scan is a very slow, expensive operation
      // TODO: create a GSI for the orders table to enable "query" of active orders
      const orders = [];
      for await (const order of ddbmapper.scan(Order, {
        filter: {
          type: "And",
          conditions: [
            { ...equals(true), subject: "isActive" },
            { ...equals(req.params.mint), subject: "mint" },
          ],
        },
      })) {
        orders.push(order);
      }

      const result: { asks: Order[]; bids: Order[] } = {
        asks: orders.filter((order: Order) => order.side === Order.ASK),
        bids: orders.filter((order: Order) => order.side === Order.BID),
      };

      // seller validation
      if (result.asks.length > 0) {
        const ask = result.asks[0];
        const wallet = new PublicKey(ask.wallet);
        const mint = new PublicKey(ask.mint);
        const isNative = mint.equals(NATIVE_MINT);

        const tokenAmount = await getTokenAmount(
          connection,
          isNative
            ? wallet
            : (
                await AuctionHouseProgram.findAssociatedTokenAccountAddress(
                  mint,
                  wallet
                )
              )[0],
          mint
        );

        // if seller is not owner of NFT, set asks in off-chain database inactive
        if (!tokenAmount) {
          // update all in parallel
          await Promise.all(
            result.asks.map((order) => {
              order.isActive = false;
              return ddbmapper.update(order);
            })
          );

          // remove invalid asks from result
          result.asks = [];
        }
      }

      res.send(result);
    } catch (err) {
      next(err);
    }
  }
}
