import { GlobalIdDelimiter } from "./consts";
import jwt, {
  JwtPayload,
} from "jsonwebtoken";
import { EntityType, Marketplace, MarketplaceInstructionType } from "./types";

export const buildOrderEntityGlobalId = (type: EntityType.AskEntity | EntityType.BidEntity, wallet: string, mint: string, marketplace: Marketplace): string => {
    return type+GlobalIdDelimiter+wallet+GlobalIdDelimiter+mint+GlobalIdDelimiter+marketplace;
}

type MarketplaceTransactionEntityTypes = EntityType.MarketplaceTransaction | EntityType.MarketplaceTransactionForNFT | EntityType.MarketplaceTransactionForWallet;
export const buildMarketplaceTransactionEntityGlobalId = (type: MarketplaceTransactionEntityTypes, instructionType: MarketplaceInstructionType, signature: string): string => {
    return type+GlobalIdDelimiter+instructionType+GlobalIdDelimiter+signature;
}

export const buildUserRefreshTokenEntityGlobalId = (type: EntityType.UserRefreshTokenEntity, wallet: string): string => {
    return type+GlobalIdDelimiter+wallet;
}

export const buildNonceEntityGlobalId = (type: EntityType.NonceEntity, nonce: string): string => {
    return type+GlobalIdDelimiter+nonce;
}

 export const extractWalletFromToken = (token: string): string => {
      if (!token) {
        console.log(`Invalid Header`);
        throw new Error("Invalid Header");
      }
      return (jwt.decode(token) as JwtPayload).wallet;
};
