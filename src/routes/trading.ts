import { Router } from "express";

import { TradingController } from "../controllers";

const router = Router();

/**
 * @openapi
 * /trading/markets:
 *   get:
 *     description: list all auction house addresses with token symbol
 *     tags: [Trading]
 *     responses:
 *       200:
 *         description:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Market'
 */
router.get("/markets", TradingController.markets);

/**
 * @openapi
 * /trading/{mint}/orders:
 *   get:
 *     description: get active orders (asks/bids) for given NFT
 *     tags: [Trading]
 *     parameters:
 *       - name: mint
 *         description: NFT mint address
 *         default: LN1BZi5KKAhGooRa7Pjqtq7UpSVT8LK1sYT8RBEqMfB
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OrderItem'
 */
router.get("/:mint/orders", TradingController.orders);

export default router;
