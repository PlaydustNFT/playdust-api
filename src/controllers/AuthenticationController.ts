import crypto from "crypto";
import base58 from "bs58";
import { sign } from "tweetnacl";
import jwt, {
  JwtPayload,
  SignOptions as JwtSignOptions,
} from "jsonwebtoken";
import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import { User } from "../ddbmodels/User";
import { ddbmapper } from "../services/dynamodb";
import { UserRefreshTokenEntity } from "../shared/entity/UserRefreshTokenEntity";
import { EntityType, NonceEntityData, UserRefreshTokenEntityData } from "../shared/types";
import { buildNonceEntityGlobalId, buildUserRefreshTokenEntityGlobalId, extractWalletFromToken } from "../shared/util";
import { NonceEntity } from "../shared/entity/NonceEntity";

export const JWT_ISSUER = process.env.JWT_ISSUER || "api.playdust.dev";
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "playdust.dev";
export const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET || "pl@ydu$t_acc3$$_t0k3n_S3CR3T";
export const JWT_REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET || "pl@ydu$t_r3fr3$4_t0k3n_S3CR3T";

export const JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || "15m";
export const JWT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || "24h";
export const NONCE_TTL_SECONDS: number = Number(process.env.NONCE_TTL_SECONDS) || 60; // this must be a number in seconds

export const TOKEN_VERIFICATION_FAILED_PREFIX = "Token Verification Failed: ";
export const NONCE_CREATION_FAILED_PREFIX = "Nonce Creation Failed: ";

export const jwtAccessTokenSignOpts: JwtSignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: JWT_ACCESS_TOKEN_TTL,
};

export const jwtRefreshTokenSignOpts: JwtSignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: JWT_REFRESH_TOKEN_TTL,
};

export type PlaydustJwtPayload = {
  wallet: string;//TODO: rename publicKey
};

/** -- Token -- **/
export type AuthTokenCreateRequest = {
  wallet: string;//TODO: rename publicKey
  nonce?: string;
  message?: string;
};

export type AuthTokenCreateResponse = {
  accessToken?: string;
  refreshToken?: string;
};

export type AuthTokenRefreshResponse = {
  token: string;
};

/** -- Nonce -- **/
export type NonceRequest = {
  wallet: string;
};

export type NonceResponse = {
  nonce: string;
};

export default class AuthenticationController {

  /**
   * Generate Nonce
   * This method is used to generate a nonce for a wallet which acts as a random message which the wallet can sign to prove private key ownership.
   * 
   * The nonce is created with a TTL and is stored in the database.
   * 
   * Nonce can only be used once and must be used within the TTL. Nonce will be deleted from the DB upon being used.
   * 
   * @param req JSON object matching NonceRequest structure
   * @param res 417 if missing required data, otherwise NonceResponse object
   * @param next next middleware function in the processing chain
   */
  static async generateNonce(
    req: Request<Record<string, string>, Record<string, unknown>, NonceRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.body.wallet) {
        throw new createError.ExpectationFailed(NONCE_CREATION_FAILED_PREFIX+"Missing Required Data");
      }
      const generatedNonce: string = crypto.randomBytes(32).toString("hex");
      const expireTime: number = Date.now() + (1000 * NONCE_TTL_SECONDS);
      const entityData: NonceEntityData = new NonceEntityData(generatedNonce, expireTime);

      const entity: NonceEntity = new NonceEntity();
      entity.populate(entityData, req.body.wallet);
      await ddbmapper.put(entity);

      res.send({nonce: generatedNonce});
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verify Signature
   * This method is used to verify that client which generated the request has access to the private key of the associated wallet.
   * 
   * This method is the required primary gatekeeper for every login attempt and user profile modification attempt
   * 
   * @param req HTTP request including AuthRequest
   * @param res no response if signature verification successful, otherwise 401
   * @param next next middleware function in the processing chain
   */
  static async verifySignature(
    req: Request<Record<string, string>, Record<string, unknown>, AuthTokenCreateRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.body.wallet || !req.body.nonce || !req.body.message) {
        throw new createError.Unauthorized("Missing Required Data");
      }

      const walletUint8 = base58.decode(req.body.wallet);
      const signedNonceUint8 = base58.decode(req.body.message);
      const nonceUint8 = new TextEncoder().encode(req.body.nonce);

      // verify signature by decrypting signed nonce using public key
      // and comparing to plaintext nonce
      if (!sign.detached.verify(nonceUint8, signedNonceUint8, walletUint8)) {
        throw new createError.Unauthorized("Failed To Verify Signature");
      }

      const entity: NonceEntity = new NonceEntity();
      entity.globalId = buildNonceEntityGlobalId(EntityType.NonceEntity, req.body.nonce);
      await ddbmapper.get(entity)
        .then( async (item) => {
          if (item.id !== req.body.wallet) {// verify the id against the wallet
            throw new createError.Unauthorized("Nonce Invalid For Wallet");
          }
          if (Date.now() >= item.data.expireTime) {// verify not expired
            throw new createError.Unauthorized("Nonce Expired");
          }
          // delete item from db
          await ddbmapper.delete(item);
        })
        .catch((err) => {
          throw new createError.Unauthorized("Failed To Locate Nonce");
        });

      delete req.body.message;
      delete req.body.nonce;

      /**
       * TODO: hubspot integration update required
       * 
       * const user = new User();
       * user.wallet = req.body.wallet;
       * user.updatedAt = new Date();
       * hubspot.update(user);
       */

      next();
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create Access Token Refresh Token Pair
   * This method is used to create an AccessToken and RefreshToken pair for the public key provided in the http body.
   * 
   * The RefreshToken is saved in the database and associated with the public key.
   * 
   * The AccessToken has a lifetime of JWT_ACCESS_TOKEN_LIFETIME, the RefreshToken has a lifetime of JWT_REFRESH_TOKEN_LIFETIME.
   * 
   * The AcccessToken is created using the JWT_ACCESS_TOKEN_SECRET (seed), the RefreshToken is created using the JWT_REFRESH_TOKEN_SECRET (seed)
   * 
   * This method should only be called once it's verified that the user owns the wallet (a.k.a verifySignature _must_ always be called before this method)
   * 
   * @param req HTTP request including AuthRequest
   * @param res AuthTokenPair instance
   * @param next next middleware function in the processing chain (or null)
   */
  static async createAccessTokenRefreshTokenPair(
    req: Request<Record<string, string>, Record<string, unknown>, AuthTokenCreateRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.body.wallet) {
        throw new Error("Invalid request, missing required data");
      }
      // try to find existing item in database

      let tokenPair: AuthTokenCreateResponse = {};
      tokenPair.accessToken = jwt.sign(req.body, JWT_ACCESS_TOKEN_SECRET, jwtAccessTokenSignOpts);

      const entity = new UserRefreshTokenEntity();
      entity.globalId = buildUserRefreshTokenEntityGlobalId(EntityType.UserRefreshTokenEntity, req.body.wallet);

      await ddbmapper.get(entity)
        .then(async (item) => {

          // if token is expired, update refresh token value & expiration time
          const refreshTokenExpired: boolean = Date.now() > item.data.expireTime * 1000;
          if (refreshTokenExpired) {
            console.log(`User Refresh Token Entity Expired for wallet: ${req.body.wallet}`);

            // generate new refresh token, update entity, update database
            tokenPair.refreshToken = jwt.sign(req.body, JWT_REFRESH_TOKEN_SECRET, jwtRefreshTokenSignOpts);
            const { exp } = jwt.decode(tokenPair.refreshToken) as JwtPayload;
            item.data.refreshToken = tokenPair.refreshToken;
            item.data.expireTime = exp;
            item.updatedAt = new Date();

            // update db
            await ddbmapper.update(item);
          }
          else {
            console.log(`User Refresh Token Entity Valid for wallet: ${req.body.wallet} `);
            tokenPair.refreshToken = item.data.refreshToken;
          }
        }).catch(async (err) => { // item not found
          console.log(`User Refresh Token Entity Not Found for wallet: ${req.body.wallet} `);

          // create token, data, entity, update database
          tokenPair.refreshToken = jwt.sign(req.body, JWT_REFRESH_TOKEN_SECRET, jwtRefreshTokenSignOpts);
          const { exp } = jwt.decode(tokenPair.refreshToken) as JwtPayload;
          const data = new UserRefreshTokenEntityData(tokenPair.refreshToken, exp);
          entity.populate(data, req.body.wallet);

          // update db
          await ddbmapper.put(entity);
        })

      console.log(`Sending token pair response: ${JSON.stringify(tokenPair)}`);
      res.send(tokenPair);

    }
    catch (err) {
      next(new createError.InternalServerError("Failed to generate tokens: "+err.message));
    }
  }

  /**
   * Verify Refresh Token Validity
   * This method is used to verify that the Refresh Token submitted is valid.
   * 
   * The following criteria must be met for this method to succeed
   * - non-empty Refresh Token (in the headers)
   * - Refresh Token can be decoded without error & user can be extracted
   * - Refresh Token exists in the Entity DB for this user
   * - Refresh Token is not expired
   * 
   * The RefreshToken is saved in the database and associated with the public key.
   * 
   * This method should only be called once it's verified that the user owns the wallet (a.k.a verifySignature _must_ always be called before this method)
   * 
   * @param req HTTP request including AuthRequest
   * @param res none if verification successful, otherwise 401 or 403
   * @param next next middleware function in the processing chain (or null)
   */
  static async verifyRefreshTokenValidity(
    req: Request<Record<string, string>, Record<string, unknown>>,
    res: Response,
    next: NextFunction
  ) {
    try {
      // authorization header format: `Bearer <refreshToken>`
      const refreshToken: string = req.headers.authorization.split(" ")[1];
      jwt.verify(refreshToken, JWT_REFRESH_TOKEN_SECRET, // throws a 400 if verification fails
        { 
          issuer: JWT_ISSUER, 
          audience: JWT_AUDIENCE
        });

      const wallet:string = extractWalletFromToken(refreshToken);
      if (!wallet) {
        console.log(`Token Decode Failed`);
        throw new createError.FailedDependency(TOKEN_VERIFICATION_FAILED_PREFIX+"Token Decode Failed");
      }

      const entity = new UserRefreshTokenEntity();
      entity.globalId = buildUserRefreshTokenEntityGlobalId(EntityType.UserRefreshTokenEntity, wallet);
      await ddbmapper.get(entity)
        .then((item) => {
          const refreshTokenExpired: boolean = Date.now() > item.data.expireTime * 1000;
          if (refreshTokenExpired) {
            // TODO this can probably be removed (superfluous since we have jwt.verify above)
            console.log(`Token Expired for wallet: ${wallet}`);
            throw new createError.Unauthorized(TOKEN_VERIFICATION_FAILED_PREFIX+"Expired Token");
          }
          if (item.data.refreshToken !== refreshToken) {
            console.log(`Incorrect Token for wallet: ${wallet}`);
            throw new createError.Unauthorized(TOKEN_VERIFICATION_FAILED_PREFIX+"Incorrect Token");
          }
          // all checks were successful
          req.body.wallet = wallet;
        })
        .catch((err) => {
          console.log(`Token does not exist for wallet: ${wallet}`);
          throw new createError.NotFound(TOKEN_VERIFICATION_FAILED_PREFIX+"Token Does Not Exist");
        })

      next();
    }
    catch (err) {
      next(err);
    }
  }

  /**
   * Refresh Access Token
   * This method is used to generate a new access token for a client which has successfully verified 
   * it has a valid refresh token per our records for the wallet public key.
   * 
   * This method _must_ be called only after verifyRefreshTokenValidity has executed successfully!
   * 
   * @param req HTTP request 
   * @param res AccessTokenResponse instance
   * @param next next middleware function in the processing chain (or null)
   */
  static async refreshAccessToken(
    req: Request<Record<string, string>, Record<string, unknown>>,
    res: Response,
    next: NextFunction
  ) {
    try {
      let token: AuthTokenRefreshResponse = {} as AuthTokenRefreshResponse;
      token.token = jwt.sign({ wallet: req.body.wallet }, JWT_ACCESS_TOKEN_SECRET, jwtAccessTokenSignOpts);
      res.send(token);
    }
    catch (err) {
      next(new createError.InternalServerError("Token Creation Failed: "+err.message));
    }
  }

  /**
   * Delete Refresh Token
   * This method is used to delete the refresh token for a given wallet from our records
   * 
   * @param req HTTP request 
   * @param res {} if successful, otherwise error
   * @param next next middleware function in the processing chain (or null)
   */
  static async deleteRefreshToken(
    req: Request<Record<string, string>, Record<string, unknown>>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const token: string = req.headers.authorization.split(" ")[1];
      jwt.verify(token, JWT_REFRESH_TOKEN_SECRET, // throws a 400 if verification fails
        { 
          issuer: JWT_ISSUER, 
          audience: JWT_AUDIENCE
        });

      const wallet: string = extractWalletFromToken(token);
      const entity = new UserRefreshTokenEntity();
      entity.globalId = buildUserRefreshTokenEntityGlobalId(EntityType.UserRefreshTokenEntity, wallet);
      // TODO should we ensure the user's token matches what was sent in?
      await ddbmapper.delete(entity);
      res.send({ success: true});
    }
    catch (err) {
      next(new createError.NotFound("Token Deletion Failed: "+err.message));
    }
  }
}
