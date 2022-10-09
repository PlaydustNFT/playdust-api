export type UserFlag = {
  wallet: string;
  reason?: string;
  datetime: string; // hack around ddb's limited support for dates here; could convert to number
};

export type CensorData = {
  type: string;
  wallet: string;
  datetime: string;
};
