import { CompiledInstruction, Message, PublicKey, TransactionSignature } from "@solana/web3.js"

export enum MarketplaceInstructionType {
    Unknown = 'UNKNOWN',
    Bid = 'BID',
    CancelBid = 'CANCEL_BID',
    Ask = 'ASK',
    CancelAsk = 'CANCEL_ASK',
    ExecuteSale = 'EXECUTE_SALE',
    Transfer = 'TRANSFER',
};

export enum Marketplace {
    MagicEdenV1 = 'MagicEdenV1',
    MagicEdenV2 = 'MagicEdenV2',
};

export class MarketplaceTransactionEntityData {
    buyerWalletAccount: PublicKey;
    buyerPdaAccount: PublicKey;
    sellerWalletAccount: PublicKey;
    sellerPdaAccount: PublicKey;
    tokenMintAccount: PublicKey;
    created: number;
    signature: TransactionSignature;
    marketplace: Marketplace;
    pdaData: string;
    price: number;
    type: MarketplaceInstructionType;

    constructor(
        buyerWalletAccount: PublicKey,
        buyerPdaAccount: PublicKey,
        sellerWalletAccount: PublicKey,
        sellerPdaAccount: PublicKey,
        tokenMintAccount: PublicKey,
        created: number,
        signature: TransactionSignature,
        marketplace: Marketplace,
        pdaData: string,
        price: number,
        type: MarketplaceInstructionType
    )
    {
        this.buyerWalletAccount = buyerWalletAccount;
        this.buyerPdaAccount = buyerPdaAccount;
        this.sellerWalletAccount = sellerWalletAccount;
        this.sellerPdaAccount = sellerPdaAccount;
        this.tokenMintAccount = tokenMintAccount;
        this.created = created;
        this.signature = signature;
        this.marketplace = marketplace;
        this.pdaData = pdaData;
        this.price = price;
        this.type = type;
    }
};

type TransactionInterface = any;
export class ParseableTransaction {
    Tx: TransactionInterface;
    BlockTime: number;
    Message: Message;
    Signature: TransactionSignature;
    Instructions: CompiledInstruction[];
    constructor(txData: any) {
        this.Tx = txData;
        this.BlockTime = txData.blockTime;
        this.Message = txData.transaction.message;
        this.Signature = txData.transaction.signatures[0];
        this.Instructions = this.Message.instructions;
    }
};

export class OrderEntityData {
    active?: boolean;
    price?: number;
    marketplace?: Marketplace;
    blockTime?: number;
    signature?: TransactionSignature;
    constructor() {}
}

export class NonceEntityData {
    nonce: string;
    expireTime: number;
    constructor(nonce: string, expireTime: number) {
        this.nonce = nonce;
        this.expireTime = expireTime;
    }
}

export enum EntityType {
    MarketplaceTransaction = 'marketplaceTransaction',
    MarketplaceTransactionForNFT = 'marketplaceTransaction4NFT',
    MarketplaceTransactionForWallet = 'marketplaceTransaction4Wallet',
    BidEntity = 'bid',
    AskEntity = 'ask',
    UserRefreshTokenEntity = 'userRefreshToken',
    NonceEntity = 'nonce',
}

export type PipelineConfig = {
    MagicEdenV1TransactionProcessor?: boolean;
    MagicEdenV2TransactionProcessor?: boolean;
    MintAddressProcessor?: boolean;
    DirtyCollectionProcessor?: boolean;
    ActiveOrdersProcessor?: boolean;
};

export class TransactionRelationEntityData {
    transactionSignature: TransactionSignature;
    constructor(transactionSignature: TransactionSignature) {
        this.transactionSignature = transactionSignature;
    }
};

export class UserRefreshTokenEntityData {
    refreshToken: string;
    expireTime: number;
    constructor(refreshToken: string, expireTime: number) {
        this.refreshToken = refreshToken;
        this.expireTime = expireTime;
    }
};

export interface Entity {
    globalId: string;
    id?: string;
    type?: EntityType;
    blockchainAddress?: string;
    createdAt?: Date;
    updatedAt: Date;
    pipelines?: PipelineConfig;
    data?: MarketplaceTransactionEntityData | OrderEntityData | TransactionRelationEntityData | UserRefreshTokenEntityData | NonceEntityData;
};
