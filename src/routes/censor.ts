import { Router } from "express";

import { AuthorizationController, CensorController } from "../controllers";
import passport from "../services/passport";

const router = Router();

/**
 * endpoint to read censor state of mint
 **/

router.get("/mint/:id", CensorController.readMintCensor);

/**
 * endpoint to read censor state of collection
 **/

router.get("/collection/:id", CensorController.readCollectionCensor);

/**
 *
 * Routes protected by authentication
 *
 **/
router.use(passport.authenticate("jwt", { session: false }));

/**
 * endpoint for authenticated & authorized admins to censor a mint
 **/

router.post(
  "/mint/:id",
  AuthorizationController.verifyAdminRole,
  CensorController.updateMintCensor
);

/**
 * endpoint for authenticated & authorized admins to censor a collection
 **/

router.post(
  "/collection/:id",
  AuthorizationController.verifyAdminRole,
  CensorController.updateCollectionCensor
);

/**
 * endpoint for authenticated & authorized admins to censor a mint
 **/

router.post(
  "/mint/:id/remove",
  AuthorizationController.verifyAdminRole,
  CensorController.removeMintCensor
);

/**
 * endpoint for authenticated & authorized admins to censor a collection
 **/

router.post(
  "/collection/:id/remove",
  AuthorizationController.verifyAdminRole,
  CensorController.removeCollectionCensor
);

export default router;
