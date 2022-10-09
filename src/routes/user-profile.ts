import { Router } from "express";

import { UserProfileController } from "../controllers";

import passport from "../services/passport";

const router = Router();

/**
 *
 * Read user profile
 *
 **/
router.get("/public/:wallet", UserProfileController.publicReadUser);

/**
 *
 * Routes protected by authentication
 *
 **/
router.use(passport.authenticate("jwt", { session: false }));

router.get("/:wallet", UserProfileController.privateReadUser);

/**
 *
 * Update user profile
 *
 **/

router.post("/:wallet", UserProfileController.updateUser);

export default router;
