import { Router, Request, Response } from "express";

import { ErrorController } from "../controllers";

import auctionHouse from "./auction-house";
import authentication from "./authentication";
import userProfile from "./user-profile";
import trading from "./trading";
import censor from "./censor";
import userFlag from "./user-flag";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     AuctionHouse:
 *       type: object
 *       properties:
 *         treasuryMint:
 *           type: string
 *         authority:
 *           type: string
 *         creator:
 *           type: string
 *         auctionHouseFeeAccount:
 *           type: string
 *         auctionHouseTreasury:
 *           type: string
 *         feeWithdrawalDestination:
 *           type: string
 *         treasuryWithdrawalDestination:
 *           type: string
 *         sellerFeeBasisPoints:
 *           type: number
 *         canChangeSalePrice:
 *           type: boolean
 *     Escrow:
 *       type: object
 *       properties:
 *         amount:
 *           type: number
 *     ConfirmOrder:
 *       description: request body
 *       type: object
 *       properties:
 *         wallet:
 *           type: string
 *           default: 4yMfRHP8T5c54sm8NFT2euvNpir2TsSukS5GK8Y9h7wg
 *         mint:
 *           type: string
 *           default: LN1BZi5KKAhGooRa7Pjqtq7UpSVT8LK1sYT8RBEqMfB
 *         buyPrice:
 *           type: number
 *           default: 10
 *         tokenSize:
 *           type: number
 *           default: 1
 *         txHash:
 *           type: string
 *           default: x7GkNddyzwnSCwWswtZ6nDHn7AmVweDMz9PyNfwqopx5jqzkWioqXMgdnowPAfVzAowfY2QK5QR44CoZhtBk5UX
 *         side:
 *           type: string
 *           default: bid
 *     Order:
 *       description: request body
 *       type: object
 *       properties:
 *         wallet:
 *           type: string
 *           default: 4yMfRHP8T5c54sm8NFT2euvNpir2TsSukS5GK8Y9h7wg
 *         mint:
 *           type: string
 *           default: LN1BZi5KKAhGooRa7Pjqtq7UpSVT8LK1sYT8RBEqMfB
 *         buyPrice:
 *           type: number
 *           default: 10
 *         tokenSize:
 *           type: number
 *           default: 1
 *     Withdraw:
 *       description: request body
 *       type: object
 *       properties:
 *         wallet:
 *           type: string
 *           default: 4yMfRHP8T5c54sm8NFT2euvNpir2TsSukS5GK8Y9h7wg
 *         amount:
 *           type: number
 *           default: 10
 *     Market:
 *       type: object
 *       properties:
 *         auctionHouse:
 *           type: string
 *         tokenSymbol:
 *           type: string
 *     TokenSymbol:
 *       type: object
 *       properties:
 *         tokenSymbol:
 *           type: string
 *     OrderItem:
 *       type: object
 *       properties:
 *         auctionHouse:
 *           type: string
 *         wallet:
 *           type: string
 *         txHash:
 *           type: string
 *         qty:
 *           type: number
 *         price:
 *           type: number
 *         side:
 *           type: string
 *         market:
 *           $ref: '#/components/schemas/TokenSymbol'
 *     AuthTokenCreateRequest:
 *       type: object
 *       properties:
 *         wallet:
 *           type: string
 *         nonce:
 *           type: string
 *         message:
 *           type: string
 *     AuthTokenCreateResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *     AuthTokenRefreshResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *     NonceRequest:
 *       type: object
 *       properties:
 *         wallet:
 *           type: string
 *     NonceResponse:
 *       type: object
 *       properties:
 *         nonce:
 *           type: string
 *     SimpleStatusResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *     Uint8Array:
 *       type: array
 *       items:
 *         type: number
 */

/**
 * @openapi
 * /ping:
 *   get:
 *     description: Health check
 *     tags: [Ping]
 *     responses:
 *       200:
 *         description:
 */
router.get("/ping", (req: Request, res: Response) => {
  res.send();
});

// AH module
router.use("/auction-house", auctionHouse);

// Trading module
router.use("/trading", trading);

// Authentication module
router.use("/authentication", authentication);

// User profile module
router.use("/user-profile", userProfile);

// Censorship module
router.use("/censor", censor);

// User flag module
router.use("/user-flag", userFlag);

// Error handler
router.use(ErrorController.notFound);
router.use(ErrorController.handle);

export default router;
