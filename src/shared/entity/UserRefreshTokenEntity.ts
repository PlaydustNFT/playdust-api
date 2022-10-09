/**
 * TODO move this to shared once we combine the playdust-api with playdust-parrotfish
 * 
 * Merge copied versions of consts, types, util into the shared repository
 */
import {
  attribute,
  hashKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";

import { TableNames } from "../consts";
import { Entity, EntityType, UserRefreshTokenEntityData, PipelineConfig } from "../types";
import { buildUserRefreshTokenEntityGlobalId } from "../util";

type MintAddress = string;

// TODO: table name should be read from environment var rather than defined in consts
@table(TableNames.Entity)
export class UserRefreshTokenEntity implements Entity {
  @hashKey()
  globalId: string;

  @attribute()
  id: string;

  @attribute()
  blockchainAddress: null;

  @attribute()
  type: EntityType.UserRefreshTokenEntity;

  @attribute()
  createdAt: Date;

  @attribute()
  updatedAt: Date;

  @attribute()
  pipelines: PipelineConfig;

  @attribute()
  data: UserRefreshTokenEntityData;

  /**
   * 
   * The blockchain address is empty for this object
   * 
   * @param data UserRefreshTokenEntityData
   * @param wallet 
   */
  populate = (data: UserRefreshTokenEntityData, wallet: string) => {
    this.data = data;
    this.id = wallet;
    this.type = EntityType.UserRefreshTokenEntity;
    this.globalId = buildUserRefreshTokenEntityGlobalId(this.type, wallet);
    const now = new Date();
    this.createdAt = now; 
    this.updatedAt = now; 
  }
}
