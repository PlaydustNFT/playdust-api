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
import { Entity, EntityType, NonceEntityData, PipelineConfig } from "../types";
import { buildNonceEntityGlobalId } from "../util";

type MintAddress = string;

// TODO: table name should be read from environment var rather than defined in consts
@table(TableNames.Entity)
export class NonceEntity implements Entity {
  @hashKey()
  globalId: string;

  @attribute()
  id: string;

  @attribute()
  blockchainAddress: null;

  @attribute()
  type: EntityType.NonceEntity;

  @attribute()
  createdAt: Date;

  @attribute()
  updatedAt: Date;

  @attribute()
  pipelines: PipelineConfig;

  @attribute()
  data: NonceEntityData;

  /**
   * 
   * The blockchain address is empty for this object
   * 
   * @param data NonceEntityData
   * @param wallet 
   */
  populate = (data: NonceEntityData, wallet: string) => {
    this.data = data;
    this.id = wallet;
    this.type = EntityType.NonceEntity;
    this.globalId = buildNonceEntityGlobalId(this.type, data.nonce);
    const now = new Date();
    this.createdAt = now; 
    this.updatedAt = now; 
  }
}
