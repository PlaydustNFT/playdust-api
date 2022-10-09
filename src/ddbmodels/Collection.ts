import {
  attribute,
  hashKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";

import { UserFlag, CensorData } from "../helpers/types";

@table("api-collection")
export class Collection {
  @hashKey()
  id?: string;

  @attribute()
  description?: string;

  @attribute()
  family?: string;

  @attribute()
  name?: string;

  @attribute()
  symbol?: string;

  @attribute()
  userFlagList?: Array<UserFlag>;

  @attribute()
  staleFlagList?: Array<UserFlag>;

  @attribute()
  censorList?: Array<CensorData>;
}
