import { DataMapper } from "@aws/dynamodb-data-mapper";
import { DynamoDB } from "aws-sdk";
import { Collection } from "../ddbmodels/Collection";
import { Market } from "../ddbmodels/Market";
import { NftMetadata } from "../ddbmodels/NftMetadata";
import { Order } from "../ddbmodels/Order";
import { Sale } from "../ddbmodels/Sale";
import { User } from "../ddbmodels/User";
import { IndexNames } from "../helpers/constants";
import { ZeroArgumentsConstructor } from "@aws/dynamodb-data-marshaller";

const dynamoDBOptions: DynamoDB.ClientConfiguration = {
  region: process.env.AWS_REGION || "local",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

if (process.env.DYNAMODB_ENDPOINT) {
  dynamoDBOptions.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const ensureTableExistsWithIndex = async (
  table: ZeroArgumentsConstructor<any>,
  indexName: string
) => {
  return ddbmapper.ensureTableExists(table, {
    readCapacityUnits: 5,
    writeCapacityUnits: 5,
    indexOptions: {
      [indexName]: {
        type: "global",
        projection: "all",
        readCapacityUnits: 5,
        writeCapacityUnits: 5,
      },
    },
  });
};

class WrappedDataMapper extends DataMapper {
  connect = async () => {
    console.log("Connecting to Dynamo DB");

    // bootstrap ddb
    const defaultDdbTableOptions = {
      readCapacityUnits: 5,
      writeCapacityUnits: 5,
    };

    await ddbmapper.ensureTableExists(Market, defaultDdbTableOptions);
    console.log(`${Market.name} table is created and ready for use!`);

    // create order table with mint index
    await ensureTableExistsWithIndex(Order, IndexNames.Order.mint);
    console.log(`${Order.name} table is created and ready for use!`);

    await ddbmapper.ensureTableExists(User, defaultDdbTableOptions);
    console.log(`${User.name} table is created and ready for use!`);

    // create NftMetadata table with collection id index
    await ensureTableExistsWithIndex(
      NftMetadata,
      IndexNames.NftMetadata.collection
    );
    console.log(`${NftMetadata.name} table is created and ready for use!`);

    await ddbmapper.ensureTableExists(Collection, defaultDdbTableOptions);
    console.log(`${Collection.name} table is created and ready for use!`);

    // create Sale table
    await ddbmapper.ensureTableExists(Sale, defaultDdbTableOptions);
    console.log(`${Sale.name} table is created and ready for use!`);

    console.log("Connection to Dynamo DB established");
  };
}

export const ddbclient = new DynamoDB(dynamoDBOptions);
export const ddbmapper = new WrappedDataMapper({ client: ddbclient });
