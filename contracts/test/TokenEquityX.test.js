const { expect }      = require("chai");
const { ethers }      = require("hardhat");

describe("TokenEquityX V2 — Full Test Suite", function () {

  let deployer, issuer, investor1, investor2, auditor, treasury;
  let usdc, cm, po, af, gm, dd, dm, mc, es, p2p;

  // ─── SETUP ──────────────────────────────────────────────────────
  beforeEach(async function () {
    [deployer, issuer, investor1, investor2, auditor, treasury] =
      await ethers.getSigners();

    // Deploy all contracts
    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    cm   = await (await ethers.getContractFactory("ComplianceManager")).deploy();
    po   = await (await ethers.getContractFactory("PriceOracle")).deploy();
    af   = await (await ethers.getContractFactory("AssetFactory")).deploy(
      await cm.getAddress(), await po.getAddress()
    );
    gm   = await (await ethers.getContractFactory("GovernanceModule")).deploy();
    dd   = await (await ethers.getContractFactory("DividendDistributor")).deploy(
      await usdc.getAddress(), treasury.address
    );
    dm   = await (await ethers.getContractFactory("DebtManager")).deploy(
      await usdc.getAddress(), treasury.address
    );
    mc   = await (await ethers.getContractFactory("MarketController")).deploy();
    es   = await (await ethers.getContractFactory("ExchangeSettlement")).deploy(
      await usdc.getAddress(), await cm.getAddress(),
      deployer.address, treasury.address
    );
    p2p  = await (await ethers.getContractFactory("P2PTransferModule")).deploy(
      await usdc.getAddress(), await cm.getAddress(), deployer.address
    );

    await es.setMarketController(await mc.getAddress());

    // Grant AssetFactory DEFAULT_ADMIN_ROLE on ComplianceManager
    // so it can call registerToken() when deploying assets
    await cm.grantRole(
      await cm.DEFAULT_ADMIN_ROLE(),
      await af.getAddress()
    );
  });

  // ─── HELPER: approve investors ──────────────────────────────────
  async function approveInvestors() {
    await cm.connect(deployer).approveInvestor(
      investor1.address, 1, 1, 365, 1000, 0, "KYC-001"
    );
    await cm.connect(deployer).approveInvestor(
      investor2.address, 1, 1, 365, 1000, 0, "KYC-002"
    );
    await cm.connect(deployer).approveInvestor(
      issuer.address, 2, 1, 365, 5000, 0, "KYC-003"
    );
  }

  // ─── HELPER: deploy a test equity token ─────────────────────────
  async function deployEquityToken() {
    await approveInvestors();
    const tx = await af.connect(deployer).deployAsset(
      "Acme Corporation",
      "ACME",
      "ACME",
      0, // EQUITY
      "ZW",
      "ZW-SPV-001",
      "QmTestHash123",
      ethers.parseEther("1000000"),
      100,
      issuer.address
    );
    const receipt     = await tx.wait();
    const event       = receipt.logs.find(l => {
      try { return af.interface.parseLog(l).name === "AssetDeployed"; }
      catch { return false; }
    });
    const parsed      = af.interface.parseLog(event);
    const tokenAddress = parsed.args[0];
    const token = await ethers.getContractAt("AssetToken", tokenAddress);
    return token;
  }

  // ════════════════════════════════════════════════════════════════
  // 1. MOCK USDC
  // ════════════════════════════════════════════════════════════════
  describe("1. MockUSDC", function () {

    it("should deploy with correct name and decimals", async function () {
      expect(await usdc.name()).to.equal("Mock USD Coin");
      expect(await usdc.symbol()).to.equal("USDC");
      expect(await usdc.decimals()).to.equal(6);
    });

    it("should mint 10M USDC to deployer on deploy", async function () {
      const balance = await usdc.balanceOf(deployer.address);
      expect(balance).to.equal(10_000_000n * 10n ** 6n);
    });

    it("should allow faucet up to 100,000 USDC", async function () {
      const amount = 100_000n * 10n ** 6n;
      await usdc.connect(investor1).faucet(amount);
      expect(await usdc.balanceOf(investor1.address)).to.equal(amount);
    });

    it("should reject faucet above 100,000 USDC", async function () {
      const amount = 200_000n * 10n ** 6n;
      await expect(usdc.connect(investor1).faucet(amount))
        .to.be.revertedWith("Max 100,000 USDC per faucet");
    });

    it("should allow MINTER_ROLE to mint", async function () {
      await usdc.mint(investor1.address, 500n * 10n ** 6n);
      expect(await usdc.balanceOf(investor1.address))
        .to.equal(500n * 10n ** 6n);
    });

    it("should reject mint from non-minter", async function () {
      await expect(
        usdc.connect(investor1).mint(investor2.address, 100n)
      ).to.be.reverted;
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. COMPLIANCE MANAGER
  // ════════════════════════════════════════════════════════════════
  describe("2. ComplianceManager", function () {

    it("should approve an investor", async function () {
      await cm.approveInvestor(
        investor1.address, 1, 1, 365, 1000, 0, "KYC-001"
      );
      expect(await cm.isApproved(investor1.address)).to.be.true;
    });

    it("should reject transfer for unapproved investor", async function () {
      await expect(
        cm.canTransfer(investor1.address, investor2.address, 100)
      ).to.be.revertedWith("Sender not KYC approved");
    });

    it("should freeze and block frozen investor", async function () {
      await cm.approveInvestor(
        investor1.address, 1, 1, 365, 1000, 0, "KYC-001"
      );
      await cm.freezeInvestor(investor1.address, "AML investigation");
      expect(await cm.isApproved(investor1.address)).to.be.false;
    });

    it("should unfreeze investor", async function () {
      await cm.approveInvestor(
        investor1.address, 1, 1, 365, 1000, 0, "KYC-001"
      );
      await cm.freezeInvestor(investor1.address, "Test");
      await cm.unfreezeInvestor(investor1.address);
      expect(await cm.isApproved(investor1.address)).to.be.true;
    });

    it("should block jurisdiction and reject transfer", async function () {
      await cm.approveInvestor(
        investor1.address, 1, 99, 365, 1000, 0, "KYC-001"
      );
      await cm.blockJurisdiction(99);
      expect(await cm.isApproved(investor1.address)).to.be.false;
    });

    it("should reject approval from non-KYC agent", async function () {
      await expect(
        cm.connect(investor1).approveInvestor(
          investor2.address, 1, 1, 365, 1000, 0, "KYC-001"
        )
      ).to.be.reverted;
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. PRICE ORACLE
  // ════════════════════════════════════════════════════════════════
  describe("3. PriceOracle", function () {

    it("should update price directly", async function () {
      const token = ethers.Wallet.createRandom().address;
      const price = 550_000_000n;
      const hash  = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      await po.updatePrice(token, price, hash, "DCF_MODEL");
      const raw = await po.getPriceRaw(token);
      expect(raw.price).to.equal(price);
    });

    it("should reject price update from non-updater", async function () {
      const token = ethers.Wallet.createRandom().address;
      await expect(
        po.connect(investor1).updatePrice(
          token, 100n, ethers.ZeroHash, "TEST"
        )
      ).to.be.reverted;
    });

    it("should submit price for auditor approval", async function () {
      await po.setRequireAuditorApproval(true);
      const token = ethers.Wallet.createRandom().address;
      const hash  = ethers.keccak256(ethers.toUtf8Bytes("audit-data"));
      await po.submitPrice(token, 100_000_000n, hash, "NAV");
      expect(await po.hasPendingPrice(token)).to.be.true;
    });

    it("should allow auditor to approve pending price", async function () {
      await po.setRequireAuditorApproval(true);
      const token = ethers.Wallet.createRandom().address;
      const hash  = ethers.keccak256(ethers.toUtf8Bytes("audit-data"));
      await po.submitPrice(token, 100_000_000n, hash, "NAV");
      await po.approvePrice(token);
      expect(await po.hasPendingPrice(token)).to.be.false;
      const raw = await po.getPriceRaw(token);
      expect(raw.auditorApproved).to.be.true;
    });

    it("should allow auditor to reject pending price", async function () {
      await po.setRequireAuditorApproval(true);
      const token = ethers.Wallet.createRandom().address;
      const hash  = ethers.keccak256(ethers.toUtf8Bytes("audit-data"));
      await po.submitPrice(token, 100_000_000n, hash, "NAV");
      await po.rejectPrice(token, "Insufficient data");
      expect(await po.hasPendingPrice(token)).to.be.false;
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. ASSET FACTORY + ASSET TOKEN
  // ════════════════════════════════════════════════════════════════
  describe("4. AssetFactory + AssetToken", function () {

    it("should deploy an equity token via factory", async function () {
      const token = await deployEquityToken();
      expect(await token.name()).to.equal("Acme Corporation");
      expect(await token.symbol()).to.equal("ACME");
    });

    it("should register token in compliance manager", async function () {
      const token = await deployEquityToken();
      expect(
        await cm.registeredTokens(await token.getAddress())
      ).to.be.true;
    });

    it("should retrieve token by ticker", async function () {
      const token = await deployEquityToken();
      const addr  = await af.getTokenByTicker("ACME");
      expect(addr).to.equal(await token.getAddress());
    });

    it("should issue tokens to KYC approved investor", async function () {
      const token  = await deployEquityToken();
      const amount = ethers.parseEther("1000");
      await token.connect(issuer).issueTokens(
        investor1.address, amount, "Initial issuance"
      );
      expect(await token.balanceOf(investor1.address)).to.equal(amount);
    });

    it("should reject token issuance to unapproved investor", async function () {
      const token = await deployEquityToken();
      await expect(
        token.connect(issuer).issueTokens(
          ethers.Wallet.createRandom().address,
          ethers.parseEther("100"),
          "Test"
        )
      ).to.be.revertedWith("Recipient not KYC approved");
    });

    it("should enforce market state PRE_LAUNCH block", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("100"), "Test"
      );
      await expect(
        token.connect(investor1).transfer(
          investor2.address, ethers.parseEther("10")
        )
      ).to.be.revertedWith("Market not open: PRE_LAUNCH");
    });

    it("should correctly report cap table", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("500"), "Issuance"
      );
      await token.connect(issuer).issueTokens(
        investor2.address, ethers.parseEther("300"), "Issuance"
      );
      const [holders] = await token.getCapTable();
      expect(holders.length).to.equal(2);
    });

    it("should reject duplicate ticker", async function () {
      await deployEquityToken();
      await expect(
        af.connect(deployer).deployAsset(
          "Acme Copy", "ACME2", "ACME", 0,
          "ZW", "ZW-SPV-002", "QmHash2",
          ethers.parseEther("1000000"), 100, issuer.address
        )
      ).to.be.revertedWith("Ticker already exists");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. GOVERNANCE MODULE
  // ════════════════════════════════════════════════════════════════
  describe("5. GovernanceModule", function () {

    it("should create a proposal", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("1000"), "Test"
      );
      await gm.grantRole(await gm.PROPOSER_ROLE(), deployer.address);
      await gm.createProposal(
        await token.getAddress(),
        "Q3 Dividend Approval",
        "Approve $50,000 dividend payment",
        "QmProposalDoc",
        0,
        3 * 24 * 60 * 60
      );
      const proposal = await gm.getProposal(1);
      expect(proposal.title).to.equal("Q3 Dividend Approval");
      expect(proposal.status).to.equal(0);
    });

    it("should allow token holder to vote", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("1000"), "Test"
      );
      await gm.grantRole(await gm.PROPOSER_ROLE(), deployer.address);
      await gm.createProposal(
        await token.getAddress(),
        "Test Proposal", "Description",
        "QmHash", 0, 3 * 24 * 60 * 60
      );
      await gm.connect(investor1).castVote(1, 1);
      const proposal = await gm.getProposal(1);
      expect(proposal.votesFor).to.equal(ethers.parseEther("1000"));
    });

    it("should reject double voting", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("1000"), "Test"
      );
      await gm.grantRole(await gm.PROPOSER_ROLE(), deployer.address);
      await gm.createProposal(
        await token.getAddress(),
        "Test", "Desc", "QmHash", 0, 3 * 24 * 60 * 60
      );
      await gm.connect(investor1).castVote(1, 1);
      await expect(
        gm.connect(investor1).castVote(1, 2)
      ).to.be.revertedWith("Already voted");
    });

    it("should reject vote from non-token-holder", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("1000"), "Test"
      );
      await gm.grantRole(await gm.PROPOSER_ROLE(), deployer.address);
      await gm.createProposal(
        await token.getAddress(),
        "Test", "Desc", "QmHash", 0, 3 * 24 * 60 * 60
      );
      await expect(
        gm.connect(investor2).castVote(1, 1)
      ).to.be.revertedWith("No voting power");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. DIVIDEND DISTRIBUTOR
  // ════════════════════════════════════════════════════════════════
  describe("6. DividendDistributor", function () {

    it("should create a dividend round and allow claim", async function () {
      const token      = await deployEquityToken();
      const amount     = ethers.parseEther("1000");
      await token.connect(issuer).issueTokens(
        investor1.address, amount, "Test"
      );
      const usdcAmount = 10_000n * 10n ** 6n;
      await usdc.approve(await dd.getAddress(), usdcAmount);
      await dd.grantRole(await dd.DISTRIBUTOR_ROLE(), deployer.address);
      await dd.createRound(
        await token.getAddress(), 0, usdcAmount, 30, "Q3 2025 Dividend"
      );
      const preview = await dd.previewClaim(1, investor1.address);
      expect(preview).to.equal(usdcAmount);
      await dd.connect(investor1).claim(1);
      expect(await usdc.balanceOf(investor1.address)).to.equal(usdcAmount);
    });

    it("should reject double claim", async function () {
      const token      = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("1000"), "Test"
      );
      const usdcAmount = 1_000n * 10n ** 6n;
      await usdc.approve(await dd.getAddress(), usdcAmount);
      await dd.grantRole(await dd.DISTRIBUTOR_ROLE(), deployer.address);
      await dd.createRound(
        await token.getAddress(), 0, usdcAmount, 30, "Test"
      );
      await dd.connect(investor1).claim(1);
      await expect(
        dd.connect(investor1).claim(1)
      ).to.be.revertedWith("Already claimed");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 7. MARKET CONTROLLER
  // ════════════════════════════════════════════════════════════════
  describe("7. MarketController", function () {

    it("should register a token", async function () {
      const token = await deployEquityToken();
      await mc.registerToken(
        await token.getAddress(),
        1_000_000n * 10n ** 6n,
        100_000n  * 10n ** 6n,
        2000
      );
      expect(
        await mc.isTokenTradeable(await token.getAddress())
      ).to.be.true;
    });

    it("should halt and resume a token", async function () {
      const token = await deployEquityToken();
      await mc.registerToken(await token.getAddress(), 0, 0, 0);

      const OPERATOR = await token.OPERATOR_ROLE();
      await token.connect(issuer).grantRole(OPERATOR, await mc.getAddress());

      await mc.haltToken(await token.getAddress(), "Suspicious activity");
      expect(await mc.isTokenTradeable(await token.getAddress())).to.be.false;

      await mc.resumeToken(await token.getAddress());
      expect(await mc.isTokenTradeable(await token.getAddress())).to.be.true;
    });

    it("should enforce global emergency stop", async function () {
      await mc.setGlobalEmergencyStop(true, "Market manipulation detected");
      expect(await mc.globalEmergencyStop()).to.be.true;
      const token = ethers.Wallet.createRandom().address;
      await expect(
        mc.canTrade(token, 100n, 100n)
      ).to.be.revertedWith("Emergency stop active");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 8. DEBT MANAGER
  // ════════════════════════════════════════════════════════════════
  describe("8. DebtManager", function () {

    it("should register a bond", async function () {
      const token    = await deployEquityToken();
      const maturity = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await dm.registerBond(
        await token.getAddress(),
        1_000_000n, 800,
        90 * 24 * 60 * 60,
        maturity, true, 500
      );
      const bond = await dm.getBond(await token.getAddress());
      expect(bond.couponRateBps).to.equal(800);
      expect(bond.status).to.equal(0);
    });

    it("should reject bond registration with past maturity", async function () {
      const token    = await deployEquityToken();
      const maturity = Math.floor(Date.now() / 1000) - 1000;
      await expect(
        dm.registerBond(
          await token.getAddress(),
          1_000_000n, 800,
          90 * 24 * 60 * 60,
          maturity, false, 0
        )
      ).to.be.revertedWith("Maturity in past");
    });

    it("should allow escrow deposit", async function () {
      const token    = await deployEquityToken();
      const maturity = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await dm.registerBond(
        await token.getAddress(),
        1_000_000n, 800,
        90 * 24 * 60 * 60,
        maturity, false, 0
      );
      await dm.grantRole(await dm.ISSUER_ROLE(), deployer.address);
      const depositAmount = 10_000n * 10n ** 6n;
      await usdc.approve(await dm.getAddress(), depositAmount);
      await dm.depositRedemptionFunds(
        await token.getAddress(), depositAmount
      );
      const bond = await dm.getBond(await token.getAddress());
      expect(bond.escrowBalance).to.equal(depositAmount);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 9. ACCESS CONTROL
  // ════════════════════════════════════════════════════════════════
  describe("9. Access Control", function () {

    it("should reject ComplianceManager freeze from non-officer", async function () {
      await expect(
        cm.connect(investor1).freezeInvestor(investor2.address, "Test")
      ).to.be.reverted;
    });

    it("should reject AssetFactory deploy from non-admin", async function () {
      await expect(
        af.connect(investor1).deployAsset(
          "Fake", "FAKE", "FAKE", 0,
          "ZW", "ZW-001", "QmHash",
          ethers.parseEther("1000"), 100,
          investor1.address
        )
      ).to.be.reverted;
    });

    it("should reject GovernanceModule proposal from non-proposer", async function () {
      const token = await deployEquityToken();
      await token.connect(issuer).issueTokens(
        investor1.address, ethers.parseEther("100"), "Test"
      );
      await expect(
        gm.connect(investor1).createProposal(
          await token.getAddress(),
          "Fake", "Desc", "QmHash", 0, 3 * 24 * 60 * 60
        )
      ).to.be.reverted;
    });

    it("should reject PriceOracle update from non-updater", async function () {
      const token = ethers.Wallet.createRandom().address;
      await expect(
        po.connect(investor1).updatePrice(
          token, 100n, ethers.ZeroHash, "TEST"
        )
      ).to.be.reverted;
    });

    it("should reject MarketController halt from non-circuit-breaker", async function () {
      const token = await deployEquityToken();
      await mc.registerToken(await token.getAddress(), 0, 0, 0);
      await expect(
        mc.connect(investor1).haltToken(
          await token.getAddress(), "Test"
        )
      ).to.be.reverted;
    });
  });
});
