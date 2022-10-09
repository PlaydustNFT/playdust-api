import { Router } from "express";

import { AuctionHouseController } from "../controllers";

const router = Router();

/**
 * @openapi
 * /auction-house/{treasuryMint}:
 *   get:
 *     description: Prints the balances of the fee and treasury wallets configured for the auction house and its current settings options
 *     tags: [Auction House]
 *     parameters:
 *       - name: treasuryMint
 *         description: treasury mint address
 *         default: TcfSV5uuBmndLK17vv3z5PicQqKVLZ3RDyj7Y6DyppE
 *         in: path
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: Auction House settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuctionHouse'
 */
router.get("/:treasuryMint?", AuctionHouseController.show);

/**
 * @openapi
 * /auction-house/{treasuryMint}/escrow/{wallet}:
 *   get:
 *     description: Print out the balance of an auction house escrow account for a given wallet.
 *     tags: [Auction House]
 *     parameters:
 *       - name: treasuryMint
 *         description: treasury mint address
 *         default: TcfSV5uuBmndLK17vv3z5PicQqKVLZ3RDyj7Y6DyppE
 *         in: path
 *         required: true
 *         type: string
 *       - name: wallet
 *         description: connected wallet address
 *         default: 4yMfRHP8T5c54sm8NFT2euvNpir2TsSukS5GK8Y9h7wg
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Escrow amount
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escrow'
 */
router.get("/:treasuryMint/escrow/:wallet", AuctionHouseController.showEscrow);

/**
 * @openapi
 * /auction-house/{treasuryMint}/ask:
 *   post:
 *     description: Place and NFT UP for sale
 *     tags: [Auction House]
 *     parameters:
 *       - name: treasuryMint
 *         description: treasury mint address
 *         default: TcfSV5uuBmndLK17vv3z5PicQqKVLZ3RDyj7Y6DyppE
 *         in: path
 *         required: true
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Sell transaction buffer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Uint8Array'
 */
router.post("/:treasuryMint/ask", AuctionHouseController.ask);

/**
 * @openapi
 * /auction-house/{treasuryMint}/cancel-ask:
 *   post:
 *     description: Potential buyer revokes their offer.
 *     tags: [Auction House]
 *     parameters:
 *       - name: treasuryMint
 *         description: treasury mint address
 *         default: TcfSV5uuBmndLK17vv3z5PicQqKVLZ3RDyj7Y6DyppE
 *         in: path
 *         required: true
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Cancel transaction buffer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Uint8Array'
 */
router.post("/:treasuryMint/cancel-ask", AuctionHouseController.cancelAsk);

/**
 * @openapi
 * /auction-house/{treasuryMint}/bid:
 *   post:
 *     description: Transaction to buy NFT
 *     tags: [Auction House]
 *     parameters:
 *       - name: treasuryMint
 *         description: treasury mint address
 *         default: TcfSV5uuBmndLK17vv3z5PicQqKVLZ3RDyj7Y6DyppE
 *         in: path
 *         required: true
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Buy transaction buffer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Uint8Array'
 */
router.post("/:treasuryMint/bid", AuctionHouseController.bid);

/**
 * @openapi
 * /auction-house/{treasuryMint}/cancel-bid:
 *   post:
 *     description: Potential buyer revokes their offer.
 *     tags: [Auction House]
 *     parameters:
 *       - name: treasuryMint
 *         description: treasury mint address
 *         default: TcfSV5uuBmndLK17vv3z5PicQqKVLZ3RDyj7Y6DyppE
 *         in: path
 *         required: true
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Cancel transaction buffer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Uint8Array'
 */
router.post("/:treasuryMint/cancel-bid", AuctionHouseController.cancelBid);

/**
 *
 */
router.post("/:treasuryMint/execute", AuctionHouseController.execute);

export default router;
