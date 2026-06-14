require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const POLYGON_MAINNET_RPC_URL  = process.env.POLYGON_MAINNET_RPC_URL  || "https://polygon-rpc.com";
const POLYGON_TESTNET_RPC_URL  = process.env.POLYGON_TESTNET_RPC_URL  || "";
const DEPLOYER_PRIVATE_KEY     = process.env.DEPLOYER_PRIVATE_KEY     || "";
const POLYGONSCAN_API_KEY      = process.env.POLYGONSCAN_API_KEY       || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { chainId: 1337 },
    polygon_mainnet: {
      url:      POLYGON_MAINNET_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId:  137,
      gasPrice: "auto",
    },
    // Polygon Amoy testnet (replaces deprecated Mumbai chain 80001)
    polygon_testnet: {
      url:      POLYGON_TESTNET_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId:  80002,
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      polygon:      POLYGONSCAN_API_KEY,
      polygonAmoy:  POLYGONSCAN_API_KEY,
    },
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
