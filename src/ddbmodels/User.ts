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

@table("api-users")
export class User {
  @hashKey()
  wallet?: string;

  @attribute()
  nonce?: string;

  @attribute()
  username?: string;

  @attribute()
  email?: string;

  @attribute()
  twitter?: string;

  @attribute()
  discord?: string;

  @attribute()
  bio?: string;

  @attribute()
  pictureaddress?: string;

  @attribute({ memberType: { type: "String" } })
  roles?: Array<string>;

  @attribute({ marshall: dateMarshall, unmarshall: dateUnmarshall })
  createdAt?: Date;

  @attribute({ marshall: dateMarshall, unmarshall: dateUnmarshall })
  updatedAt?: Date;
}
