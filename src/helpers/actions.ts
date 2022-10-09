import {
  Cluster,
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token, NATIVE_MINT } from "@solana/spl-token";
import { AuctionHouseProgram } from "@metaplex-foundation/mpl-auction-house";
import {
  Metadata,
  MetadataData,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  getPriceWithMantissa,
  getTokenAmount,
  getTreasuryMintKey,
  getRemainingAccounts,
  serializeRawTransactionWithSigners,
} from "./utils";

const authorityKeypair = Keypair.fromSecretKey(
  new Uint8Array(
    (
      (process.env.AH_AUTH_KEY as string) ||
      // 2iWiYia5q5tFaiubDPH1JvXtDe7XHbEdxXNayBh7D4k8
      "235,159,53,225,32,242,232,36,39,123,191,33,133,97,98,30,253,210,33,164,118,247,146,200,228,101,163,130,167,18,211,84,25,126,25,183,91,11,29,37,27,60,45,230,51,174,40,42,48,35,176,156,51,19,58,28,147,250,126,128,37,56,151,241"
    )
      .split(",")
      .map((item) => parseInt(item))
  )
);

const network = process.env.SOLANA_NETWORK || "devnet";
const rpcUrl =
  process.env.SOLANA_CUSTOM_RPC_URL || clusterApiUrl(network as Cluster);

export const connection = new Connection(rpcUrl);

// inspect auction house
export const showAction = async (treasuryMint?: string) => {
  const treasuryMintKey = getTreasuryMintKey(treasuryMint);
  const [auctionHouseKey] = await AuctionHouseProgram.findAuctionHouseAddress(
    authorityKeypair.publicKey,
    treasuryMintKey
  );

  const auctionHouse =
    await AuctionHouseProgram.accounts.AuctionHouse.fromAccountAddress(
      connection,
      auctionHouseKey
    );

  console.debug(
    "Fee payer account:",
    auctionHouse.auctionHouseFeeAccount.toBase58()
  );

  return auctionHouse.pretty();
};

// inspect escrow amount
export const showEscrowAction = async (
  wallet: string,
  treasuryMint?: string
) => {
  const walletKey = new PublicKey(wallet);
  const treasuryMintKey = getTreasuryMintKey(treasuryMint);
  const [auctionHouseKey] = await AuctionHouseProgram.findAuctionHouseAddress(
    authorityKeypair.publicKey,
    treasuryMintKey
  );
  const [escrowPaymentAccount] =
    await AuctionHouseProgram.findEscrowPaymentAccountAddress(
      auctionHouseKey,
      walletKey
    );

  return getTokenAmount(connection, escrowPaymentAccount, treasuryMintKey);
};

// ask for NFT
export const askAction = async (
  treasuryMint: string,
  sellerWallet: string,
  mint: string,
  buyPrice: number,
  tokenSize: number,
  buyerWallet?: string
) => {
  const sellerWalletKey = new PublicKey(sellerWallet);
  const mintKey = new PublicKey(mint);
  const treasuryMintKey = getTreasuryMintKey(treasuryMint);
  const [
    buyPriceAdjusted,
    tokenSizeAdjusted,
    tokenAccounts,
    metadataKey,
    [tokenAccountKey],
    [auctionHouseKey],
    [programAsSigner, programAsSignerBump],
  ] = await Promise.all([
    getPriceWithMantissa(buyPrice, treasuryMintKey, connection),
    getPriceWithMantissa(tokenSize, mintKey, connection),
    connection.getTokenLargestAccounts(mintKey),
    Metadata.getPDA(mintKey),
    AuctionHouseProgram.findAssociatedTokenAccountAddress(
      mintKey,
      sellerWalletKey
    ),
    AuctionHouseProgram.findAuctionHouseAddress(
      authorityKeypair.publicKey,
      treasuryMintKey
    ),
    AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress(),
  ]);

  const sellerTokenAccountKey = tokenAccounts.value[0].address;

  if (!tokenAccountKey.equals(sellerTokenAccountKey)) {
    throw Error("You are not owner of the NFT");
  }

  const [
    [sellerTradeState, sellerTradeStateBump],
    [freeSellerTradeState, freeSellerTradeStateBump],
    auctionHouse,
  ] = await Promise.all([
    AuctionHouseProgram.findTradeStateAddress(
      sellerWalletKey,
      auctionHouseKey,
      tokenAccountKey,
      treasuryMintKey,
      mintKey,
      buyPriceAdjusted.toNumber(),
      tokenSizeAdjusted.toNumber()
    ),
    AuctionHouseProgram.findTradeStateAddress(
      sellerWalletKey,
      auctionHouseKey,
      tokenAccountKey,
      treasuryMintKey,
      mintKey,
      0,
      tokenSizeAdjusted.toNumber()
    ),
    AuctionHouseProgram.accounts.AuctionHouse.fromAccountAddress(
      connection,
      auctionHouseKey
    ),
  ]);

  const instructions = [];

  const ixSell = AuctionHouseProgram.instructions.createSellInstruction(
    {
      wallet: sellerWalletKey,
      tokenAccount: tokenAccountKey,
      metadata: metadataKey,
      authority: auctionHouse.authority,
      auctionHouse: auctionHouseKey,
      auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
      sellerTradeState,
      freeSellerTradeState,
      programAsSigner,
    },
    {
      tradeStateBump: sellerTradeStateBump,
      freeTradeStateBump: freeSellerTradeStateBump,
      programAsSignerBump,
      buyerPrice: buyPriceAdjusted,
      tokenSize: tokenSizeAdjusted,
    }
  );
  ixSell.keys
    .filter((k) => k.pubkey.equals(sellerWalletKey))
    .map((k) => (k.isSigner = true));
  ixSell.keys
    .filter((k) => k.pubkey.equals(auctionHouse.authority))
    .map((k) => (k.isSigner = true));
  instructions.push(ixSell);

  // execute final sale when bid is matched to ask
  if (buyerWallet) {
    const buyerWalletKey = new PublicKey(buyerWallet);
    const isNative = treasuryMintKey.equals(NATIVE_MINT);

    const [
      metadata,
      [escrowPaymentAccount, escrowPaymentBump],
      [buyerTradeState],
      [sellerPaymentReceiptAccount],
      [buyerReceiptTokenAccount],
    ] = await Promise.all([
      connection.getAccountInfo(metadataKey),
      AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouseKey,
        buyerWalletKey
      ),
      AuctionHouseProgram.findPublicBidTradeStateAddress(
        buyerWalletKey,
        auctionHouseKey,
        treasuryMintKey,
        mintKey,
        buyPriceAdjusted.toNumber(),
        tokenSizeAdjusted.toNumber()
      ),
      isNative
        ? [sellerWalletKey]
        : AuctionHouseProgram.findAssociatedTokenAccountAddress(
            treasuryMintKey,
            sellerWalletKey
          ),
      AuctionHouseProgram.findAssociatedTokenAccountAddress(
        mintKey,
        buyerWalletKey
      ),
    ]);

    const metadataDecoded = MetadataData.deserialize(metadata.data);
    const remainingAccounts = await getRemainingAccounts(
      metadataDecoded,
      treasuryMintKey,
      isNative
    );

    const ixExecuteSale =
      AuctionHouseProgram.instructions.createExecuteSaleInstruction(
        {
          buyer: buyerWalletKey,
          seller: sellerWalletKey,
          tokenAccount: tokenAccountKey,
          tokenMint: mintKey,
          metadata: metadataKey,
          treasuryMint: treasuryMintKey,
          escrowPaymentAccount,
          sellerPaymentReceiptAccount,
          buyerReceiptTokenAccount,
          authority: auctionHouse.authority,
          auctionHouse: auctionHouseKey,
          auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
          auctionHouseTreasury: auctionHouse.auctionHouseTreasury,
          buyerTradeState,
          sellerTradeState,
          freeTradeState: freeSellerTradeState,
          programAsSigner,
        },
        {
          escrowPaymentBump,
          freeTradeStateBump: freeSellerTradeStateBump,
          programAsSignerBump,
          buyerPrice: buyPriceAdjusted,
          tokenSize: tokenSizeAdjusted,
        }
      );
    ixExecuteSale.keys
      .filter((k) => k.pubkey.equals(auctionHouse.authority))
      .map((k) => (k.isSigner = true));
    ixExecuteSale.keys.push(...remainingAccounts);
    instructions.push(ixExecuteSale);
  }

  return await serializeRawTransactionWithSigners(
    connection,
    instructions,
    [authorityKeypair],
    sellerWalletKey
  );
};

// cancel ask
export const cancelAskAction = async (
  treasuryMint: string,
  wallet: string,
  mint: string,
  buyPrice: number,
  tokenSize: number
) => {
  const walletKey = new PublicKey(wallet);
  const mintKey = new PublicKey(mint);
  const treasuryMintKey = getTreasuryMintKey(treasuryMint);

  const [
    buyPriceAdjusted,
    tokenSizeAdjusted,
    [tokenAccountKey],
    [auctionHouseKey],
  ] = await Promise.all([
    getPriceWithMantissa(buyPrice, treasuryMintKey, connection),
    getPriceWithMantissa(tokenSize, mintKey, connection),
    AuctionHouseProgram.findAssociatedTokenAccountAddress(mintKey, walletKey),
    AuctionHouseProgram.findAuctionHouseAddress(
      authorityKeypair.publicKey,
      treasuryMintKey
    ),
  ]);

  const [[tradeState], auctionHouse] = await Promise.all([
    AuctionHouseProgram.findTradeStateAddress(
      auctionHouseKey,
      walletKey,
      tokenAccountKey,
      treasuryMintKey,
      mintKey,
      tokenSizeAdjusted.toNumber(),
      buyPriceAdjusted.toNumber()
    ),
    AuctionHouseProgram.accounts.AuctionHouse.fromAccountAddress(
      connection,
      auctionHouseKey
    ),
  ]);

  const instruction = AuctionHouseProgram.instructions.createCancelInstruction(
    {
      wallet: walletKey,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      authority: auctionHouse.authority,
      auctionHouse: auctionHouseKey,
      auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
      tradeState,
    },
    {
      buyerPrice: buyPriceAdjusted,
      tokenSize: tokenSizeAdjusted,
    }
  );
  instruction.keys
    .filter((k) => k.pubkey.equals(walletKey))
    .map((k) => (k.isSigner = true));
  instruction.keys
    .filter((k) => k.pubkey.equals(auctionHouse.authority))
    .map((k) => (k.isSigner = true));

  return await serializeRawTransactionWithSigners(
    connection,
    [instruction],
    [authorityKeypair],
    walletKey
  );
};

// public bid for NFT
export const publicBidAction = async (
  treasuryMint: string,
  buyerWallet: string,
  mint: string,
  depositAmount: number,
  buyPrice: number,
  tokenSize: number,
  sellerWallet?: string
) => {
  const buyerWalletKey = new PublicKey(buyerWallet);
  const mintKey = new PublicKey(mint);
  const treasuryMintKey = getTreasuryMintKey(treasuryMint);
  const isNative = treasuryMintKey.equals(NATIVE_MINT);

  const [
    buyPriceAdjusted,
    tokenSizeAdjusted,
    tokenAccounts,
    metadataKey,
    [buyerTokenAccountKey],
    [ata],
    [auctionHouseKey],
  ] = await Promise.all([
    getPriceWithMantissa(buyPrice, treasuryMintKey, connection),
    getPriceWithMantissa(tokenSize, mintKey, connection),
    connection.getTokenLargestAccounts(mintKey),
    Metadata.getPDA(mintKey),
    AuctionHouseProgram.findAssociatedTokenAccountAddress(
      mintKey,
      buyerWalletKey
    ),
    AuctionHouseProgram.findAssociatedTokenAccountAddress(
      treasuryMintKey,
      buyerWalletKey
    ),
    AuctionHouseProgram.findAuctionHouseAddress(
      authorityKeypair.publicKey,
      treasuryMintKey
    ),
  ]);

  const tokenAccountKey = tokenAccounts.value[0].address;
  const transferAuthority = Keypair.generate();

  if (tokenAccountKey.equals(buyerTokenAccountKey)) {
    throw Error("You cannot buy your own NFT");
  }

  const [
    [escrowPaymentAccount, escrowPaymentBump],
    [buyerTradeState, buyerTradeStateBump],
    auctionHouse,
  ] = await Promise.all([
    AuctionHouseProgram.findEscrowPaymentAccountAddress(
      auctionHouseKey,
      buyerWalletKey
    ),
    AuctionHouseProgram.findPublicBidTradeStateAddress(
      buyerWalletKey,
      auctionHouseKey,
      treasuryMintKey,
      mintKey,
      buyPriceAdjusted.toNumber(),
      tokenSizeAdjusted.toNumber()
    ),
    AuctionHouseProgram.accounts.AuctionHouse.fromAccountAddress(
      connection,
      auctionHouseKey
    ),
  ]);

  const instructions = [
    ...(isNative
      ? []
      : [
          Token.createApproveInstruction(
            TOKEN_PROGRAM_ID,
            ata,
            transferAuthority.publicKey,
            buyerWalletKey,
            [],
            buyPriceAdjusted.toNumber()
          ),
        ]),
  ];

  const ixPublicBuy =
    AuctionHouseProgram.instructions.createPublicBuyInstruction(
      {
        wallet: buyerWalletKey,
        paymentAccount: isNative ? buyerWalletKey : ata,
        transferAuthority: isNative
          ? buyerWalletKey
          : transferAuthority.publicKey,
        treasuryMint: treasuryMintKey,
        tokenAccount: tokenAccountKey,
        metadata: metadataKey,
        escrowPaymentAccount,
        authority: auctionHouse.authority,
        auctionHouse: auctionHouseKey,
        auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
        buyerTradeState,
      },
      {
        tradeStateBump: buyerTradeStateBump,
        escrowPaymentBump,
        buyerPrice: buyPriceAdjusted,
        tokenSize: tokenSizeAdjusted,
      }
    );
  ixPublicBuy.keys
    .filter((k) => k.pubkey.equals(buyerWalletKey))
    .map((k) => (k.isSigner = true));
  ixPublicBuy.keys
    .filter((k) => k.pubkey.equals(auctionHouse.authority))
    .map((k) => (k.isSigner = true));
  if (!isNative) {
    ixPublicBuy.keys
      .filter((k) => k.pubkey.equals(transferAuthority.publicKey))
      .map((k) => (k.isSigner = true));
  }
  instructions.push(ixPublicBuy);

  // deposit difference amount
  if (depositAmount > 0) {
    const depositAmountAdjusted = await getPriceWithMantissa(
      depositAmount,
      treasuryMintKey,
      connection
    );

    const ixDeposit = AuctionHouseProgram.instructions.createDepositInstruction(
      {
        wallet: buyerWalletKey,
        paymentAccount: isNative ? buyerWalletKey : ata,
        transferAuthority: isNative
          ? buyerWalletKey
          : transferAuthority.publicKey,
        escrowPaymentAccount,
        treasuryMint: treasuryMintKey,
        authority: auctionHouse.authority,
        auctionHouse: auctionHouseKey,
        auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
      },
      {
        escrowPaymentBump,
        amount: depositAmountAdjusted,
      }
    );
    ixDeposit.keys
      .filter((k) => k.pubkey.equals(buyerWalletKey))
      .map((k) => (k.isSigner = true));
    ixDeposit.keys
      .filter((k) => k.pubkey.equals(auctionHouse.authority))
      .map((k) => (k.isSigner = true));
    if (!isNative) {
      ixDeposit.keys
        .filter((k) => k.pubkey.equals(transferAuthority.publicKey))
        .map((k) => (k.isSigner = true));
    }
    instructions.push(ixDeposit);
  }

  instructions.push(
    ...(isNative
      ? []
      : [
          Token.createRevokeInstruction(
            TOKEN_PROGRAM_ID,
            ata,
            buyerWalletKey,
            []
          ),
        ])
  );

  // execute sale when bid is matched to ask
  if (sellerWallet) {
    const sellerWalletKey = new PublicKey(sellerWallet);

    const [
      metadata,
      [programAsSigner, programAsSignerBump],
      [escrowPaymentAccount, escrowPaymentBump],
      [freeTradeState, freeTradeStateBump],
      [sellerTradeState],
      [sellerPaymentReceiptAccount],
      [buyerReceiptTokenAccount],
    ] = await Promise.all([
      connection.getAccountInfo(metadataKey),
      AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress(),
      AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouseKey,
        buyerWalletKey
      ),
      AuctionHouseProgram.findTradeStateAddress(
        sellerWalletKey,
        auctionHouseKey,
        tokenAccountKey,
        treasuryMintKey,
        mintKey,
        0,
        tokenSizeAdjusted.toNumber()
      ),
      AuctionHouseProgram.findTradeStateAddress(
        sellerWalletKey,
        auctionHouseKey,
        tokenAccountKey,
        treasuryMintKey,
        mintKey,
        buyPriceAdjusted.toNumber(),
        tokenSizeAdjusted.toNumber()
      ),
      isNative
        ? [sellerWalletKey]
        : await AuctionHouseProgram.findAssociatedTokenAccountAddress(
            treasuryMintKey,
            sellerWalletKey
          ),
      AuctionHouseProgram.findAssociatedTokenAccountAddress(
        mintKey,
        buyerWalletKey
      ),
    ]);

    const metadataDecoded = MetadataData.deserialize(metadata.data);
    const remainingAccounts = await getRemainingAccounts(
      metadataDecoded,
      treasuryMintKey,
      isNative
    );

    const ixExecuteSale =
      AuctionHouseProgram.instructions.createExecuteSaleInstruction(
        {
          buyer: buyerWalletKey,
          seller: sellerWalletKey,
          tokenAccount: tokenAccountKey,
          tokenMint: mintKey,
          metadata: metadataKey,
          treasuryMint: treasuryMintKey,
          escrowPaymentAccount,
          sellerPaymentReceiptAccount,
          buyerReceiptTokenAccount,
          authority: auctionHouse.authority,
          auctionHouse: auctionHouseKey,
          auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
          auctionHouseTreasury: auctionHouse.auctionHouseTreasury,
          buyerTradeState,
          sellerTradeState,
          freeTradeState,
          programAsSigner,
        },
        {
          escrowPaymentBump,
          freeTradeStateBump,
          programAsSignerBump,
          buyerPrice: buyPriceAdjusted,
          tokenSize: tokenSizeAdjusted,
        }
      );
    ixExecuteSale.keys
      .filter((k) => k.pubkey.equals(auctionHouse.authority))
      .map((k) => (k.isSigner = true));
    ixExecuteSale.keys.push(...remainingAccounts);
    instructions.push(ixExecuteSale);
  }

  const signers = isNative ? [] : [transferAuthority];
  signers.push(authorityKeypair);

  return await serializeRawTransactionWithSigners(
    connection,
    instructions,
    signers,
    buyerWalletKey
  );
};

// cancel public bid
export const cancelPublicBidAction = async (
  treasuryMint: string,
  wallet: string,
  mint: string,
  buyPrice: number,
  tokenSize: number
) => {
  const walletKey = new PublicKey(wallet);
  const mintKey = new PublicKey(mint);
  const treasuryMintKey = getTreasuryMintKey(treasuryMint);
  const isNative = treasuryMintKey.equals(NATIVE_MINT);

  const [
    buyPriceAdjusted,
    tokenSizeAdjusted,
    tokenAccounts,
    [ata],
    [auctionHouseKey],
  ] = await Promise.all([
    getPriceWithMantissa(buyPrice, treasuryMintKey, connection),
    getPriceWithMantissa(tokenSize, mintKey, connection),
    connection.getTokenLargestAccounts(mintKey),
    AuctionHouseProgram.findAssociatedTokenAccountAddress(
      treasuryMintKey,
      walletKey
    ),
    AuctionHouseProgram.findAuctionHouseAddress(
      authorityKeypair.publicKey,
      treasuryMintKey
    ),
  ]);

  const tokenAccountKey = tokenAccounts.value[0].address;

  const [
    [escrowPaymentAccount, escrowPaymentBump],
    [tradeState],
    auctionHouse,
  ] = await Promise.all([
    AuctionHouseProgram.findEscrowPaymentAccountAddress(
      auctionHouseKey,
      walletKey
    ),
    AuctionHouseProgram.findPublicBidTradeStateAddress(
      auctionHouseKey,
      walletKey,
      treasuryMintKey,
      mintKey,
      tokenSizeAdjusted.toNumber(),
      buyPriceAdjusted.toNumber()
    ),
    AuctionHouseProgram.accounts.AuctionHouse.fromAccountAddress(
      connection,
      auctionHouseKey
    ),
  ]);

  const instructions = [];

  // cancel bid
  const ixCancel = AuctionHouseProgram.instructions.createCancelInstruction(
    {
      wallet: walletKey,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      authority: auctionHouse.authority,
      auctionHouse: auctionHouseKey,
      auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
      tradeState,
    },
    {
      buyerPrice: buyPriceAdjusted,
      tokenSize: tokenSizeAdjusted,
    }
  );
  ixCancel.keys
    .filter((k) => k.pubkey.equals(walletKey))
    .map((k) => (k.isSigner = true));
  ixCancel.keys
    .filter((k) => k.pubkey.equals(auctionHouse.authority))
    .map((k) => (k.isSigner = true));
  instructions.push(ixCancel);

  // withdraw buy price amount from escrow payment account
  const ixWithdraw = AuctionHouseProgram.instructions.createWithdrawInstruction(
    {
      wallet: walletKey,
      receiptAccount: isNative ? walletKey : ata,
      escrowPaymentAccount,
      treasuryMint: treasuryMintKey,
      authority: auctionHouse.authority,
      auctionHouse: auctionHouseKey,
      auctionHouseFeeAccount: auctionHouse.auctionHouseFeeAccount,
    },
    {
      escrowPaymentBump,
      amount: buyPriceAdjusted,
    }
  );
  ixWithdraw.keys
    .filter((k) => k.pubkey.equals(walletKey))
    .map((k) => (k.isSigner = true));
  ixWithdraw.keys
    .filter((k) => k.pubkey.equals(auctionHouse.authority))
    .map((k) => (k.isSigner = true));
  instructions.push(ixWithdraw);

  return await serializeRawTransactionWithSigners(
    connection,
    instructions,
    [authorityKeypair],
    walletKey
  );
};

// execute auction house transaction
export const executeAction = async (buff: Buffer) => {
  const txHash = await connection.sendRawTransaction(buff);

  await connection.confirmTransaction(txHash, "processed");

  return txHash;
};
