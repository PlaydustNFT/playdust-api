import {
  attribute,
  hashKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";
import { DynamoDB } from "aws-sdk";

const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
  ({ I: value.getTime() } as DynamoDB.AttributeValue);
const dateUnmarshall = ({ N }: DynamoDB.AttributeValue): Date | undefined =>
  N ? new Date(N) : undefined;

@table("api-markets")
export class Market {
  @hashKey()
  treasuryMint?: string;

  @attribute()
  tokenName?: string;

  @attribute()
  tokenSymbol?: string;

  @attribute({ marshall: dateMarshall, unmarshall: dateUnmarshall })
  createdAt?: Date;

  @attribute({ marshall: dateMarshall, unmarshall: dateUnmarshall })
  updatedAt?: Date;
}
