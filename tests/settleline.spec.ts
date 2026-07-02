import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";

describe("settleline", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Settleline as Program;

  it("derives market and vault addresses for a World Cup fixture", async () => {
    const fixtureId = new anchor.BN(17952170);
    const marketKindSeed = Buffer.from([0]);
    const [market] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        provider.wallet.publicKey.toBuffer(),
        fixtureId.toArrayLike(Buffer, "le", 8),
        marketKindSeed,
      ],
      program.programId,
    );
    const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), market.toBuffer()],
      program.programId,
    );

    assert.ok(anchor.web3.PublicKey.isOnCurve(market.toBytes()) === false);
    assert.ok(anchor.web3.PublicKey.isOnCurve(vault.toBytes()) === false);
  });
});
