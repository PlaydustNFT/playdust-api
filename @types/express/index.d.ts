export {};

declare global {
  namespace Express {
    export interface User {
      wallet: string;
      nonce: string;
    }
  }
}
