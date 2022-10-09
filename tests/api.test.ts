import server from "supertest";
import { Keypair } from "@solana/web3.js";
import { sign } from "tweetnacl";
import base58 from "bs58";

const request = server("http://localhost:6000");

const USER_KEYPAIR = Keypair.generate();

let accessNonce: string;
let accessToken: string;
let refreshToken: string;

describe("API end points", () => {
  it("should ping and healthcheck", async () => {
    await request.get("/ping").expect(200);
  });

  describe("Authentication module", () => {
    it("should generate nonce", async () => {
      await request
        .post("/authentication/nonce")
        .send({
          wallet: USER_KEYPAIR.publicKey.toBase58(),
        })
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty("nonce");
          expect(res.body.nonce).not.toBe(null);
          expect(res.body.nonce.length).toBe(64);
          accessNonce = res.body.nonce;
        });
    });

    it("should generate access token", async () => {
      const signedMessage = base58.encode(
        sign.detached(
          new TextEncoder().encode(accessNonce),
          USER_KEYPAIR.secretKey
        )
      );

      await request
        .post("/authentication/login")
        .send({
          wallet: USER_KEYPAIR.publicKey.toBase58(),
          nonce: accessNonce,
          message: signedMessage,
        })
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty("accessToken");
          expect(res.body).toHaveProperty("refreshToken");
          expect(res.body.accessToken).not.toBe(null);
          expect(res.body.refreshToken).not.toBe(null);

          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it("should refresh access token", async () => {
      await request
        .post("/authentication/token")
        .send({
          wallet: USER_KEYPAIR.publicKey.toBase58(),
        })
        .set("Authorization", `Bearer ${refreshToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty("token");
          expect(res.body.token).not.toBe(null);
          expect(res.body.nonce).not.toBe(null);

          accessToken = res.body.token;
          accessNonce = res.body.nonce;
        });
    });

    it("should logout", async () => {
      await request
        .post("/authentication/logout")
        .send({
        })
        .set("Authorization", `Bearer ${refreshToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty("success");
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe("Trading module", () => {
    it("should retrieve available markets", async () => {
      await request
        .get("/trading/markets")
        .expect(200)
        .then((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(0);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty("auctionHouse");
            expect(res.body[0]).toHaveProperty("tokenSymbol");
          }
        });
    });
  });
});
