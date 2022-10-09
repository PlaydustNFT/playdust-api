import {
  AttributePath,
  FunctionExpression,
  UpdateExpression,
} from "@aws/dynamodb-expressions";

// internal methods for generating ddb integrations
export const prepareSetUpdateExpression = (
  attributeName: string,
  functionExpression: FunctionExpression
) => {
  const expr = new UpdateExpression();
  expr.set(new AttributePath(attributeName), functionExpression);
  return expr;
};

export const prepareDeleteUpdateExpression = (toDelete: string) => {
  const expr = new UpdateExpression();
  expr.remove(toDelete);
  return expr;
};

export const prepareListUpdateFunctionExpression = <T>(
  functionExpressionType: string,
  attributeName: string,
  data: T
) => {
  return new FunctionExpression(
    functionExpressionType,
    new AttributePath(attributeName),
    [data]
  );
};

// TODO: come up with a better way of specifying type here
export const calculateListAppendFunctionExpressionType = <T>(
  list: Array<T>,
  locateExpr: any
) => {
  if (!list) {
    return "if_not_exists";
  } else {
    const itemExists = list.find(locateExpr);
    if (!itemExists) {
      return "list_append";
    }
    // no more processing required as item already exists in list
  }
};
