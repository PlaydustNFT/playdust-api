import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  Token,
  NATIVE_MINT,
  u64 as BN,
} from "@solana/spl-token";
import { MetadataData } from "@metaplex-foundation/mpl-token-metadata";
import { AuctionHouseProgram } from "@metaplex-foundation/mpl-auction-house";
export const getPriceWithMantissa = async (
  price: number,
  mint: PublicKey,
  connection: Connection
): Promise<BN> => {
  const token = new Token(
    connection,
    mint,
    TOKEN_PROGRAM_ID,
    Keypair.generate()
  );

  const mintInfo = await token.getMintInfo();

  const mantissa = new BN(10).pow(new BN(mintInfo.decimals));

  return new BN(price * 10 ** 6).mul(mantissa).divn(10 ** 6);
};

export async function getTokenAmount(
  connection: Connection,
  account: PublicKey,
  mint: PublicKey
): Promise<number> {
  let amount = 0;
  if (!mint.equals(NATIVE_MINT)) {
    try {
      const token = await connection.getTokenAccountBalance(account);
      amount = token.value.uiAmount * Math.pow(10, token.value.decimals);
    } catch (e) {
      console.error(
        "Account ",
        account.toBase58(),
        "didnt return value. Assuming 0 tokens."
      );
    }
  } else {
    amount = await connection.getBalance(account);
  }

  return amount;
}

export const getTreasuryMintKey = (mint?: string) => {
  if (!mint) {
    // No treasury mint detected, using SOL.
    return NATIVE_MINT;
  } else {
    return new PublicKey(mint);
  }
};

export const getRemainingAccounts = async (
  metadataDecoded: MetadataData,
  treasuryMintKey: PublicKey,
  isNative: boolean
) => {
  const remainingAccounts = [];

  for (let i = 0; i < metadataDecoded.data.creators.length; i++) {
    remainingAccounts.push({
      pubkey: new PublicKey(metadataDecoded.data.creators[i].address),
      isWritable: true,
      isSigner: false,
    });
    if (!isNative) {
      remainingAccounts.push({
        pubkey: (
          await AuctionHouseProgram.findAssociatedTokenAccountAddress(
            treasuryMintKey,
            remainingAccounts[remainingAccounts.length - 1].pubkey
          )
        )[0],
        isWritable: true,
        isSigner: false,
      });
    }
  }

  return remainingAccounts;
};

export const serializeRawTransactionWithSigners = async (
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Signer[],
  feePayer?: PublicKey
) => {
  const transaction = new Transaction();

  transaction.recentBlockhash =
    // https://docs.solana.com/developing/clients/jsonrpc-api#getlatestblockhash
    // (await connection.getLatestBlockhash("finalized" as Commitment)).blockhash;
    (await connection.getRecentBlockhash("finalized" as Commitment)).blockhash;

  transaction.add(...instructions);

  if (feePayer) {
    transaction.feePayer = feePayer;
  }

  if (signers.length > 0) {
    transaction.sign(...signers);
  }

  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
};
