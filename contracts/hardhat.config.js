require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

const POLYGON_MAINNET_RPC_URL = process.env.POLYGON_MAINNET_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY    = process.env.DEPLOYER_PRIVATE_KEY    || "";
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

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
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
