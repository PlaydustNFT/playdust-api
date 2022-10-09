import passport from "passport";

import jwt, {
  Strategy as JwtStrategy,
  StrategyOptions as JwtStrategyOptions,
  ExtractJwt,
} from "passport-jwt";

import {
  PlaydustJwtPayload as JwtPayload,
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_ACCESS_TOKEN_SECRET,
} from "../controllers/AuthenticationController";
import { User } from "../ddbmodels/User";
import { UserRefreshTokenEntity } from "../shared/entity/UserRefreshTokenEntity";
import { EntityType } from "../shared/types";
import { buildUserRefreshTokenEntityGlobalId, extractWalletFromToken } from "../shared/util";
import { ddbmapper } from "./dynamodb";

const opts: JwtStrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_ACCESS_TOKEN_SECRET,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

passport.use(
  new JwtStrategy(opts, async (payload: JwtPayload, done) => {
    const entity = new UserRefreshTokenEntity();
    entity.globalId = buildUserRefreshTokenEntityGlobalId(EntityType.UserRefreshTokenEntity, payload.wallet);
    await ddbmapper.get(entity)
      .then((item) => {
        return done(null, payload.wallet);
      })
      .catch((err) => {
        return done(false, payload.wallet);
      })
  })
);

export default passport;
