import {
  equals,
  greaterThanOrEqualTo,
  lessThanOrEqualTo,
} from "@aws/dynamodb-expressions";
import { Request, Response, NextFunction } from "express";
import { ddbmapper } from "../services/dynamodb";
import {
  showAction,
  showEscrowAction,
  publicBidAction,
  cancelPublicBidAction,
  askAction,
  cancelAskAction,
  executeAction,
} from "../helpers/actions";
import { Order } from "../ddbmodels/Order";
import { Sale } from "../ddbmodels/Sale";
import { IndexNames } from "../helpers/constants";

// TODO: ensure that before persisting Order to db, lookup auctionHouse Market db
// if Market doesn't exist, order is invalid
// this is to impose a constraint that is currently implemented via Foreign Keys in MySQL
// however ddb doesn't support the concept of Foreign Keys

export type WithdrawRequest = {
  wallet: string;
  amount: number;
};

export type OrderRequest = {
  // Buyer wallet address
  wallet: string;
  // Mint of the token to purchase
  mint: string;
  // Price you wish to purchase for
  buyPrice: number;
  // Amount of tokens you want to purchase
  tokenSize: number;
  // Transaction hash
  txHash?: string;
  // "bid" or "ask"
  side?: string;
  // seller wallet address
  sellerWallet?: string;
  // buyer wallet address
  buyerWallet?: string;
};

export type ExecuteRequest = {
  // Transaction buffer to submit to blockchain
  txBuff: Buffer;
  // id of bid order
  bidOrderId?: string;
  // id of ask order
  askOrderId?: string;
  // id of sale/auto-match
  saleId?: string;
  // type to validate against
  // exectionType: ValidExecutionType;
};

export default class AuctionHouseController {
  /**
   * Prints the balances of the fee and treasury wallets configured for the auction house and its current settings options
   *
   * DOC: https://docs.metaplex.com/auction-house/cli#show
   */
  static async show(req: Request, res: Response, next: NextFunction) {
    try {
      const auction = await showAction(req.params.treasuryMint);

      res.send(auction);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Print out the balance of an auction house escrow account for a given wallet.
   *
   * DOC: https://docs.metaplex.com/auction-house/cli#other-actions
   */
  static async showEscrow(req: Request, res: Response, next: NextFunction) {
    try {
      const amount = await showEscrowAction(
        req.params.wallet,
        req.params.treasuryMint
      );

      res.send({ amount });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Place and NFT UP for sale
   *
   * DOC: https://docs.metaplex.com/auction-house/cli#sell
   */
  static async ask(
    req: Request<Record<string, string>, Record<string, unknown>, OrderRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      // TODO: reject if seller has already listed NFT

      const requestPrice = Number(req.body.buyPrice);
      const tokenSize = Number(req.body.tokenSize);

      // check if there is matched bid
      const matchingOrders = [];
      for await (const order of ddbmapper.query(
        Order,
        { mint: req.body.mint },
        {
          filter: {
            type: "And",
            conditions: [
              { ...equals(true), subject: "isActive" },
              { ...equals(Order.BID), subject: "side" },
              { ...equals(req.params.treasuryMint), subject: "treasuryMint" },
              { ...greaterThanOrEqualTo(req.body.tokenSize), subject: "qty" },
              { ...greaterThanOrEqualTo(req.body.buyPrice), subject: "price" },
            ],
          },
          indexName: IndexNames.Order.mint,
        }
      )) {
        if (order) {
          matchingOrders.push(order);
          break;
        }
      }
      const autoMatchedOrder = matchingOrders?.at(0);
      const orderToCreate = new Order();
      orderToCreate.wallet = req.body.wallet;
      orderToCreate.mint = req.body.mint;
      orderToCreate.treasuryMint = req.params.treasuryMint;
      orderToCreate.qty = tokenSize;
      orderToCreate.price = requestPrice;
      orderToCreate.side = Order.ASK;
      orderToCreate.isActive = false;

      const [buff, createdOrder] = await Promise.all([
        // transaction to list NFT
        askAction(
          req.params.treasuryMint,
          // seller wallet
          req.body.wallet,
          req.body.mint,
          Number(autoMatchedOrder?.price || requestPrice),
          tokenSize,
          // buyer wallet
          autoMatchedOrder?.wallet
        ),
        // create order tracking
        ddbmapper.put(orderToCreate),
      ]);

      const isAutoMatched = matchingOrders?.length > 0;
      const bidOrderId = autoMatchedOrder?.id;
      const askOrderId = createdOrder.id;
      let saleId = "";
      if (isAutoMatched) {
        const sale = new Sale();
        sale.askId = askOrderId;
        sale.bidId = bidOrderId;
        sale.isActive = false;
        const creationTime = new Date();
        sale.createdAt = creationTime;
        sale.updatedAt = creationTime;

        const createdSale = await ddbmapper.put(sale);
        saleId = createdSale.id;
      }

      res.send({
        txBuff: [...new Uint8Array(buff)],
        isAutoMatched,
        bidOrderId,
        askOrderId,
        saleId,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Potential seller revokes their list.
   *
   * DOC: https://docs.metaplex.com/auction-house/cli#other-actions
   */
  static async cancelAsk(
    req: Request<Record<string, string>, Record<string, unknown>, OrderRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const buyPrice = Number(req.body.buyPrice);
      const tokenSize = Number(req.body.tokenSize);

      const [buff] = await Promise.all([
        cancelAskAction(
          req.params.treasuryMint,
          req.body.wallet,
          req.body.mint,
          buyPrice,
          tokenSize
        ),
      ]);

      const asks = [];
      for await (const order of ddbmapper.query(
        Order,
        { mint: req.body.mint },
        {
          filter: {
            type: "And",
            conditions: [
              { ...equals(true), subject: "isActive" },
              { ...equals(req.body.wallet), subject: "wallet" },
              { ...equals(Order.ASK), subject: "side" },
              { ...equals(req.params.treasuryMint), subject: "treasuryMint" },
            ],
          },
          indexName: IndexNames.Order.mint,
        }
      )) {
        if (order) {
          asks.push(order);
          break;
        }
      }
      const ask = asks.at(0);

      res.send({
        txBuff: [...new Uint8Array(buff)],
        askOrderId: ask?.id,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Place an offer on an NFT by its mint address
   *
   * DOC: https://docs.metaplex.com/auction-house/cli#buy
   */
  static async bid(
    req: Request<Record<string, string>, Record<string, unknown>, OrderRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      // TODO: reject if buyer has already have the same offer

      const requestPrice = Number(req.body.buyPrice);
      const tokenSize = Number(req.body.tokenSize);

      const walletBids = [];
      for await (const bid of ddbmapper.query(
        Order,
        { mint: req.body.mint },
        {
          filter: {
            type: "And",
            conditions: [
              { ...equals(true), subject: "isActive" },
              { ...equals(Order.BID), subject: "side" },
              { ...equals(req.params.treasuryMint), subject: "treasuryMint" },
              { ...equals(req.body.wallet), subject: "wallet" },
            ],
          },
          indexName: IndexNames.Order.mint,
          // TODO
          // projection: {
          //   [Order.qty, Order.price]
          // }
        }
      )) {
        walletBids.push(bid);
      }

      const notionalAmountOfExistingBids = walletBids
        .map((bid) => bid.qty * bid.price)
        .reduce((acc, amount) => acc + amount, 0);
      const matchingOrders = [];
      for await (const order of ddbmapper.query(
        Order,
        { mint: req.body.mint },
        {
          filter: {
            type: "And",
            conditions: [
              { ...equals(true), subject: "isActive" },
              { ...equals(Order.ASK), subject: "side" },
              { ...equals(req.params.treasuryMint), subject: "treasuryMint" },
              { ...greaterThanOrEqualTo(req.body.tokenSize), subject: "qty" },
              { ...lessThanOrEqualTo(req.body.buyPrice), subject: "price" },
            ],
          },
          indexName: IndexNames.Order.mint,
        }
      )) {
        if (order) {
          matchingOrders.push(order);
          break;
        }
      }
      const autoMatchedOrder = matchingOrders?.at(0);
      const escrowAmount = Number(notionalAmountOfExistingBids);
      // FYI - if escrowAmount = 0, buyPrice will be sent to escrow account
      // if escrowAmount > 0, only Max(0, buyPrice - escrowAmount) will be sent to escrow account
      const depositAmount =
        escrowAmount > 0
          ? escrowAmount >= requestPrice
            ? requestPrice
            : escrowAmount
          : 0;

      const orderToCreate = new Order();
      orderToCreate.wallet = req.body.wallet;
      orderToCreate.mint = req.body.mint;
      orderToCreate.treasuryMint = req.params.treasuryMint;
      orderToCreate.qty = tokenSize;
      orderToCreate.price = requestPrice;
      orderToCreate.side = Order.BID;
      orderToCreate.isActive = false;

      const [buff, createdOrder] = await Promise.all([
        // transaction to make an offer
        publicBidAction(
          req.params.treasuryMint,
          req.body.wallet,
          req.body.mint,
          depositAmount,
          requestPrice,
          tokenSize,
          autoMatchedOrder?.wallet
        ),
        ddbmapper.put(orderToCreate),
      ]);

      const isAutoMatched = matchingOrders?.length > 0;
      const bidOrderId = createdOrder.id;
      const askOrderId = autoMatchedOrder?.id;
      let saleId = "";
      if (isAutoMatched) {
        const sale = new Sale();
        sale.askId = askOrderId;
        sale.bidId = bidOrderId;
        sale.isActive = false;
        const creationTime = new Date();
        sale.createdAt = creationTime;
        sale.updatedAt = creationTime;

        const createdSale = await ddbmapper.put(sale);
        saleId = createdSale.id;
      }

      res.send({
        txBuff: [...new Uint8Array(buff)],
        isAutoMatched,
        bidOrderId,
        askOrderId,
        saleId,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Potential buyer revokes their offer.
   *
   * DOC: https://docs.metaplex.com/auction-house/cli#other-actions
   */
  static async cancelBid(
    req: Request<Record<string, string>, Record<string, unknown>, OrderRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const buyPrice = Number(req.body.buyPrice);
      const tokenSize = Number(req.body.tokenSize);

      const [buff] = await Promise.all([
        cancelPublicBidAction(
          req.params.treasuryMint,
          req.body.wallet,
          req.body.mint,
          buyPrice,
          tokenSize
        ),
      ]);

      const bids = [];
      for await (const order of ddbmapper.query(
        Order,
        { mint: req.body.mint },
        {
          filter: {
            type: "And",
            conditions: [
              { ...equals(true), subject: "isActive" },
              { ...equals(req.body.wallet), subject: "wallet" },
              { ...equals(Order.BID), subject: "side" },
              { ...equals(req.params.treasuryMint), subject: "treasuryMint" },
            ],
          },
          indexName: IndexNames.Order.mint,
        }
      )) {
        if (order) {
          bids.push(order);
          break;
        }
      }
      const bid = bids.at(0);

      res.send({
        txBuff: [...new Uint8Array(buff)],
        bidOrderId: bid?.id,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Execute auction house transactions
   */
  static async execute(
    req: Request<
      Record<string, string>,
      Record<string, unknown>,
      ExecuteRequest
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      // execute transaction
      const [txHash] = await Promise.all([executeAction(req.body.txBuff)]);

      // tx included ask order update
      if (req.body.askOrderId) {
        const asks = [];
        for await (const ask of ddbmapper.query(
          Order,
          { id: req.body.askOrderId },
          { limit: 1 }
        )) {
          if (ask) {
            asks.push(ask);
            break;
          }
        }
        const ask = asks?.at(0);

        // sync order database
        if (ask.txHash || req.body.saleId) {
          // inactive order when ask or bid is canceled, or if auto-matched
          // if txHash is not null, it means it's cancel ask
          ask.isActive = false;
        } else {
          // active order when ask or bid is created & not auto-matched
          ask.isActive = true;
        }
        ask.txHash = txHash;

        // TODO: inactive when ask and bid is matched & sale executed
        await ddbmapper.put(ask);
      }

      // tx included bid order update
      if (req.body.bidOrderId) {
        const bids = [];
        for await (const bid of ddbmapper.query(
          Order,
          { id: req.body.bidOrderId },
          { limit: 1 }
        )) {
          if (bid) {
            bids.push(bid);
            break;
          }
        }
        const bid = bids?.at(0);

        // sync order database
        if (bid.txHash || req.body.saleId) {
          // inactive order when ask or bid is canceled, or if auto-matched
          // if txHash is not null, it means it's cancel bid
          bid.isActive = false;
        } else {
          // active order when ask or bid is created & not auto-matched
          bid.isActive = true;
        }
        bid.txHash = txHash;

        // TODO: inactive when ask and bid is matched & sale executed
        await ddbmapper.put(bid);
      }

      // was an auto-match
      if (req.body.saleId) {
        const sales = [];
        for await (const sale of ddbmapper.query(
          Sale,
          { id: req.body.saleId },
          { limit: 1 }
        )) {
          if (sale) {
            sales.push(sale);
            break;
          }
        }
        const sale = sales?.at(0);
        sale.txHash = txHash;
        sale.isActive = true;
        sale.updatedAt = new Date();

        await ddbmapper.put(sale);
      }
      res.send({ txHash });
    } catch (err) {
      next(err);
    }
  }
}
