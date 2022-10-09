import { Keypair } from "@solana/web3.js";

// auction house authority keypair
export const AUCTION_HOUSE_AUTHORITY_KEYPAIR = Keypair.fromSecretKey(
  new Uint8Array(
    (
      (process.env.AH_AUTH_KEY as string) ||
      // 2iWiYia5q5tFaiubDPH1JvXtDe7XHbEdxXNayBh7D4k8
      "235,159,53,225,32,242,232,36,39,123,191,33,133,97,98,30,253,210,33,164,118,247,146,200,228,101,163,130,167,18,211,84,25,126,25,183,91,11,29,37,27,60,45,230,51,174,40,42,48,35,176,156,51,19,58,28,147,250,126,128,37,56,151,241"
    )
      .split(",")
      .map((item) => parseInt(item))
  )
);

export const PUBLIC_USER_PROFILE_ATTRIBUTES = [
  "username",
  "bio",
  "wallet",
  "pictureaddress",
];

export const CensorDataSizeConstraints = {
  type: 30,
};

export const UserFlagSizeConstraints = {
  reason: 200, // characters
};

export const UserSizeConstraints = {
  bio: 200,
  username: 40,
  pictureaddress: 44,
};

export const IndexNames = {
  Order: {
    mint: "mintIndex",
  },
  NftMetadata: {
    collection: "heuristicCollectionIdIndex",
  },
};
export const ADMIN_ROLE_NAME = "admin";
