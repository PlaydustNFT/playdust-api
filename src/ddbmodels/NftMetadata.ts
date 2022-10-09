import {
  attribute,
  hashKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";
import { IndexNames } from "../helpers/constants";

import { UserFlag, CensorData } from "../helpers/types";

@table("api-nft-metadata")
export class NftMetadata {
  @hashKey()
  mint?: string;

  @attribute()
  isMutable?: number;

  // TODO: add data map
  // @attribute()
  // data?: Map<string, any>;
  @attribute({
    indexKeyConfigurations: {
      [IndexNames.NftMetadata.collection]: "HASH",
    },
  })
  heuristicCollectionId?: string;

  @attribute()
  updateAuthority?: string;

  @attribute()
  key?: number;

  @attribute()
  primarySaleHappened?: number;

  @attribute()
  userFlagList?: Array<UserFlag>;

  @attribute()
  staleFlagList?: Array<UserFlag>;

  @attribute()
  censorList?: Array<CensorData>;
}
