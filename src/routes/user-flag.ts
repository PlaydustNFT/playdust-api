import { Router } from "express";

import { UserFlagController } from "../controllers";
import passport from "../services/passport";

const router = Router();

/**
 *
 * Routes protected by authentication
 *
 **/
router.use(passport.authenticate("jwt", { session: false }));

/**
 * Endpoint for authenticated users to stale-flag an NFT.
 */
router.post(
  "/mint/:id/stale",
  UserFlagController.updateMintStaleMetadataFlagList
);

/**
 * Endpoint for authenticated users to stale-flag a collection.
 */
router.post(
  "/collection/:id/stale",
  UserFlagController.updateCollectionStaleMetadataFlagList
);

/**
 * Endpoint for authenticated users to flag a mint.
 **/
router.post("/mint/:id", UserFlagController.updateMintUserFlagList);

/**
 * Endpoint for authenticated users to flag a collection.
 **/
router.post("/collection/:id", UserFlagController.updateCollectionUserFlagList);

export default router;
