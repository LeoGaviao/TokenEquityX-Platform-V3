-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 06, 2026 at 03:39 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tokenequityx_v3`
--

-- --------------------------------------------------------

--
-- Table structure for table `analytics_snapshots`
--

CREATE TABLE `analytics_snapshots` (
  `id` int(11) NOT NULL,
  `snapshot_date` date NOT NULL,
  `total_users` int(11) NOT NULL DEFAULT 0,
  `total_tokens` int(11) NOT NULL DEFAULT 0,
  `total_volume_usd` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `total_fees_usd` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `total_aum_usd` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `performed_by` varchar(42) DEFAULT NULL,
  `target_wallet` varchar(42) DEFAULT NULL,
  `target_entity` varchar(100) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `user_id` varchar(36) DEFAULT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `action`, `performed_by`, `target_wallet`, `target_entity`, `details`, `ip_address`, `created_at`, `user_id`, `entity_type`, `entity_id`) VALUES
(1, 'TOKENISATION_APPLICATION', '0xce1ebe789e0067f08222e5cd0456a02c7a7c8e90', NULL, 'MCR', 'Entity: Mutare City REIT, Files: 7', NULL, '2026-04-01 12:49:24', NULL, NULL, NULL),
(2, 'TOKENISATION_APPLICATION', '0xce1ebe789e0067f08222e5cd0456a02c7a7c8e90', NULL, 'TEX', 'Entity: TokenEquityX, Files: 7', NULL, '2026-04-01 14:26:10', NULL, NULL, NULL),
(3, 'TOKENISATION_APPLICATION', '0xce1ebe789e0067f08222e5cd0456a02c7a7c8e90', NULL, 'TEX', 'Entity: TokenEquityX, Files: 7', NULL, '2026-04-01 14:46:10', NULL, NULL, NULL),
(4, 'AUDITOR_ASSIGNED', '0xce1ebe789e0067f08222e5cd0456a02c7a7c8e90', NULL, '1', 'Assigned to: J. Sibanda CPA (ICAZ)', NULL, '2026-04-01 18:40:00', NULL, NULL, NULL),
(5, 'AUDITOR_ASSIGNED', '0xADMIN00000000000000000000000000000000000', NULL, '452068', 'Assigned to: 0xAUDIT00000000000000000000000000000000000', NULL, '2026-04-04 11:20:18', NULL, NULL, NULL),
(6, 'AUDIT_REPORT_SUBMITTED', '0xAUDIT00000000000000000000000000000000000', NULL, '452068', 'Status: AUDITOR_APPROVED. Price: $3.0000. Risk: MEDIUM', NULL, '2026-04-04 17:45:01', NULL, NULL, NULL),
(7, 'ORACLE_PRICE_SET', '0xAUDIT00000000000000000000000000000000000', NULL, 'MCR', 'New price: $3.0000. Source: Auditor certification — Independent Appraisal — 2026-04-04', NULL, '2026-04-04 17:45:01', NULL, NULL, NULL),
(8, 'ADMIN_FINAL_APPROVAL', '0xADMIN00000000000000000000000000000000000', NULL, 'MCR', 'Listing type: GREENFIELD_P2P. Certified price: $3. Notes: None', NULL, '2026-04-04 17:45:35', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `auth_nonces`
--

CREATE TABLE `auth_nonces` (
  `id` int(11) NOT NULL,
  `wallet` varchar(42) NOT NULL DEFAULT '',
  `nonce` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bonds`
--

CREATE TABLE `bonds` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `face_value` decimal(20,8) NOT NULL,
  `coupon_rate` decimal(10,4) NOT NULL,
  `maturity_date` date NOT NULL,
  `payment_frequency` enum('MONTHLY','QUARTERLY','SEMI_ANNUAL','ANNUAL') NOT NULL DEFAULT 'QUARTERLY',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bond_coupons`
--

CREATE TABLE `bond_coupons` (
  `id` int(11) NOT NULL,
  `bond_id` int(11) NOT NULL,
  `payment_date` date NOT NULL,
  `amount_per_token` decimal(20,8) NOT NULL,
  `status` enum('SCHEDULED','PAID','MISSED') NOT NULL DEFAULT 'SCHEDULED',
  `tx_hash` varchar(66) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `data_submissions`
--

CREATE TABLE `data_submissions` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `submitted_by` varchar(42) NOT NULL,
  `period` varchar(50) NOT NULL,
  `data_json` text NOT NULL,
  `status` enum('PENDING','UNDER_REVIEW','INFO_REQUESTED','AUDITOR_APPROVED','ADMIN_APPROVED','LISTED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `token_id` int(11) DEFAULT NULL,
  `auditor_notes` text DEFAULT NULL,
  `reviewed_by` varchar(42) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assigned_auditor` varchar(100) DEFAULT NULL,
  `audit_report` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`audit_report`)),
  `audit_report_url` varchar(500) DEFAULT NULL,
  `listing_type` varchar(50) DEFAULT NULL COMMENT 'GREENFIELD_P2P or BROWNFIELD_BOURSE',
  `certified_price` decimal(18,8) DEFAULT NULL,
  `valuation_method` varchar(200) DEFAULT NULL,
  `admin_approved_by` int(11) DEFAULT NULL,
  `admin_approved_at` datetime DEFAULT NULL,
  `admin_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `data_submissions`
--

INSERT INTO `data_submissions` (`id`, `token_symbol`, `submitted_by`, `period`, `data_json`, `status`, `token_id`, `auditor_notes`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`, `assigned_auditor`, `audit_report`, `audit_report_url`, `listing_type`, `certified_price`, `valuation_method`, `admin_approved_by`, `admin_approved_at`, `admin_notes`) VALUES
(32, 'TEX', '2', 'TOKENISATION_APPLICATION', '{\"type\":\"TOKENISATION_APPLICATION\",\"legalEntityName\":\"TokenEquityX\",\"registrationNumber\":\"1234/2026\",\"proposedSymbol\":\"TEX\",\"tokenName\":\"TokenEquityX\",\"assetClass\":\"Private Equity\",\"assetDescription\":\"TokenEquityX is an institutional-grade, multi-asset tokenization and trading platform engineered specifically for African capital markets. The platform enables companies to tokenize equity stakes, real estate portfolios, mineral resource rights, infrastructure concessions, Real Estate Investment Trusts (REITs), and debt instruments — with built-in compliance enforcement, corporate governance, dividend distribution, and secondary market trading capabilities.\\r\\n\\r\\nAfrica\'s capital markets face a structural funding gap. Formal stock exchanges serve only a small fraction of the continent\'s enterprises, while the vast majority of investment-worthy businesses — in mining, agriculture, infrastructure, and real estate — remain inaccessible to institutional and retail investors. Tokenization addresses this gap by fractionalising asset ownership, reducing settlement times from days to seconds, enforcing compliance programmatically, and enabling 24/7 secondary market trading.\\r\\n\\r\\nTokenEquityX V3 is a production-grade platform comprising eleven smart contracts — pending independent security audit ahead of mainnet deployment — deployed on the Polygon blockchain, a full-stack backend API with thirteen functional modules, five role-differentiated dashboards, a real-time order matching engine, a multi-model valuation engine covering six asset classes, and a complete audit trail architecture meeting institutional compliance requirements.\\r\\n\\r\\nKey Platform Capabilities\\r\\n•\\tMulti-asset tokenization: equity, real estate, mining, infrastructure, REITs, and bonds\\r\\n•\\tKYC/AML compliance enforced at the smart contract level on every token transfer\\r\\n•\\tOn-chain corporate governance enabling shareholder voting on company resolutions\\r\\n•\\tAutomated dividend and coupon distribution to verified token holders\\r\\n•\\tReal-time order book with price-time priority matching and atomic DVP settlement\\r\\n•\\tSix-model valuation engine producing auditor-approved reference prices\\r\\n•\\tComplete audit trail meeting institutional and regulatory reporting requirements\\r\\n•\\tRole-based access for investors, issuers, auditors, administrators, and partners\\r\\n\\r\\nStrategic Partnership Framework\\r\\nTokenEquityX seeks to establish the following institutional partnership structure to ensure sustainable growth and regulatory alignment:\\r\\n\\r\\nPartner\\tRole\\tValue Contribution\\r\\nInternational Finance Corporation (IFC)\\tGrant & Technical Partner\\tTechnical assistance grants, regulatory engagement, global credibility\\r\\nAfrican Development Bank (AfDB)\\tEquity Partner (15-20%)\\tBalance sheet credibility, continental network, SADC expansion pathway\\r\\nStanbic Bank / Ecobank\\tBanking & Distribution Partner\\tPayment rails, banking infrastructure, investor distribution network\\r\\n \\r\\n\",\"jurisdiction\":\"Zimbabwe\",\"targetRaiseUsd\":500000,\"tokenIssuePrice\":10,\"totalSupply\":1000000,\"expectedYield\":\"36\",\"distributionFrequency\":\"Semi-Annual\",\"keyPersonnel\":[{\"role\":\"CEO\",\"name\":\"Richard Chimuka\",\"email\":\"r.chimuka@tokenequityx.co.zw\",\"idNumber\":\"08-671488e22\"},{\"role\":\"CFO\",\"name\":\"Leo Gaviao\",\"email\":\"l.gaviao@tokenequityx.co.zw\",\"idNumber\":\"08-671488e22\"},{\"role\":\"Legal Counsel\",\"name\":\"Tendai Rwodzi\",\"email\":\"t.rwodzi@legal.com\",\"idNumber\":\"08-671488e22\"}],\"documents\":[{\"originalName\":\"TokenEquityX_SECZ_BusinessPlan.docx\",\"storedName\":\"0xce1ebe789e_1775053570173_TokenEquityX_SECZ_BusinessPlan.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570173_TokenEquityX_SECZ_BusinessPlan.docx\",\"size\":75995,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_Financial_Model.xlsx\",\"storedName\":\"0xce1ebe789e_1775053570222_TokenEquityX_Financial_Model.xlsx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570222_TokenEquityX_Financial_Model.xlsx\",\"size\":51270,\"mimetype\":\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\"},{\"originalName\":\"TokenEquityX_SECZ_BusinessPlan.docx\",\"storedName\":\"0xce1ebe789e_1775053570225_TokenEquityX_SECZ_BusinessPlan.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570225_TokenEquityX_SECZ_BusinessPlan.docx\",\"size\":75995,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_SECZ_BusinessPlan.docx\",\"storedName\":\"0xce1ebe789e_1775053570226_TokenEquityX_SECZ_BusinessPlan.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570226_TokenEquityX_SECZ_BusinessPlan.docx\",\"size\":75995,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_Financial_Model.xlsx\",\"storedName\":\"0xce1ebe789e_1775053570227_TokenEquityX_Financial_Model.xlsx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570227_TokenEquityX_Financial_Model.xlsx\",\"size\":51270,\"mimetype\":\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\"},{\"originalName\":\"TokenEquityX_SECZ_BusinessPlan.docx\",\"storedName\":\"0xce1ebe789e_1775053570234_TokenEquityX_SECZ_BusinessPlan.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570234_TokenEquityX_SECZ_BusinessPlan.docx\",\"size\":75995,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_Whitepaper_V3.docx\",\"storedName\":\"0xce1ebe789e_1775053570236_TokenEquityX_Whitepaper_V3.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775053570236_TokenEquityX_Whitepaper_V3.docx\",\"size\":48875,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"}],\"submittedBy\":\"2\",\"submittedAt\":\"2026-04-01T14:26:10.248Z\",\"referenceNumber\":\"TEX-2026-7784\"}', 'UNDER_REVIEW', NULL, 'Stage advanced to: live by Admin on 4/3/2026', '2', '2026-04-03 01:00:17', '2026-04-01 14:26:10', '2026-04-03 01:00:17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(452068, 'MCR', '2', 'TOKENISATION_APPLICATION', '{\"type\":\"TOKENISATION_APPLICATION\",\"legalEntityName\":\"Mutare City REIT\",\"registrationNumber\":\"1235/2026\",\"proposedSymbol\":\"MCR\",\"tokenName\":\"Mutare REIT\",\"assetClass\":\"Real Estate / REIT\",\"assetDescription\":\"A toke to fund the development of a new section of Mutare City\",\"jurisdiction\":\"Zimbabwe\",\"targetRaiseUsd\":20000000,\"tokenIssuePrice\":1,\"totalSupply\":1000000,\"expectedYield\":\"14\",\"distributionFrequency\":\"Semi-Annual\",\"keyPersonnel\":[{\"role\":\"CEO\",\"name\":\"Thomas Mutemachani\",\"email\":\"tom @gmail.com\",\"idNumber\":\"\"},{\"role\":\"CFO\",\"name\":\"Miriam Moyo\",\"email\":\"miriam@gmail.com\",\"idNumber\":\"\"},{\"role\":\"Legal Counsel\",\"name\":\"Lawson Muviti\",\"email\":\"law@gmail.com`\",\"idNumber\":\"\"}],\"documents\":[{\"originalName\":\"LH Lerico.pdf\",\"storedName\":\"0xce1ebe789e_1775047764361_LH_Lerico.pdf\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764361_LH_Lerico.pdf\",\"size\":1049805,\"mimetype\":\"application/pdf\"},{\"originalName\":\"HARSHAL BOSALE.docx\",\"storedName\":\"0xce1ebe789e_1775047764452_HARSHAL_BOSALE.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764452_HARSHAL_BOSALE.docx\",\"size\":15899,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"Leo - Resignation.pdf\",\"storedName\":\"0xce1ebe789e_1775047764454_Leo_-_Resignation.pdf\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764454_Leo_-_Resignation.pdf\",\"size\":142317,\"mimetype\":\"application/pdf\"},{\"originalName\":\"Due Diligence Request Pack.pdf\",\"storedName\":\"0xce1ebe789e_1775047764458_Due_Diligence_Request_Pack.pdf\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764458_Due_Diligence_Request_Pack.pdf\",\"size\":196572,\"mimetype\":\"application/pdf\"},{\"originalName\":\"Due Diligence Request Pack.pdf\",\"storedName\":\"0xce1ebe789e_1775047764460_Due_Diligence_Request_Pack.pdf\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764460_Due_Diligence_Request_Pack.pdf\",\"size\":196572,\"mimetype\":\"application/pdf\"},{\"originalName\":\"Urgent.pdf\",\"storedName\":\"0xce1ebe789e_1775047764462_Urgent.pdf\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764462_Urgent.pdf\",\"size\":192128,\"mimetype\":\"application/pdf\"},{\"originalName\":\"Zimbabwe Investment Fund Methodology Development - Concept Note.docx\",\"storedName\":\"0xce1ebe789e_1775047764464_Zimbabwe_Investment_Fund_Methodology_Development_-_Concept_Note.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775047764464_Zimbabwe_Investment_Fund_Methodology_Development_-_Concept_Note.docx\",\"size\":44587,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"}],\"submittedBy\":\"2\",\"submittedAt\":\"2026-04-01T12:49:24.487Z\",\"referenceNumber\":\"TEX-2026-2416\"}', 'UNDER_REVIEW', NULL, 'Stage advanced to: live by Admin on 4/4/2026', 'staff-admin-001', '2026-04-04 21:17:55', '2026-04-01 12:49:24', '2026-04-04 21:17:55', '0xAUDIT00000000000000000000000000000000000', '{\"auditorId\":\"staff-auditor-001\",\"auditorWallet\":\"0xAUDIT00000000000000000000000000000000000\",\"reportDate\":\"2026-04-04T17:45:01.690Z\",\"findings\":\"Everything is in order\",\"methodology\":\"NVV\",\"riskRating\":\"MEDIUM\",\"recommendation\":\"APPROVE\",\"caveats\":\"Asssets to be moved to SPV\",\"certifiedPrice\":3,\"valuationMethod\":\"Independent Appraisal\",\"yearsOfFinancials\":3,\"annualRevenueUsd\":499999,\"suggestedListingType\":\"GREENFIELD_P2P\"}', NULL, 'GREENFIELD_P2P', NULL, NULL, 0, '2026-04-04 19:45:35', NULL),
(2147483647, 'TEX', '2', 'TOKENISATION_APPLICATION', '{\"type\":\"TOKENISATION_APPLICATION\",\"legalEntityName\":\"TokenEquityX\",\"registrationNumber\":\"1234/2026\",\"proposedSymbol\":\"TEX\",\"tokenName\":\"TokenEquityX\",\"assetClass\":\"Private Equity\",\"assetDescription\":\"TokenEquityX is an institutional-grade, multi-asset tokenization and trading platform engineered specifically for African capital markets. The platform enables companies to tokenize equity stakes, real estate portfolios, mineral resource rights, infrastructure concessions, Real Estate Investment Trusts (REITs), and debt instruments — with built-in compliance enforcement, corporate governance, dividend distribution, and secondary market trading capabilities.\\r\\n\\r\\nAfrica\'s capital markets face a structural funding gap. Formal stock exchanges serve only a small fraction of the continent\'s enterprises, while the vast majority of investment-worthy businesses — in mining, agriculture, infrastructure, and real estate — remain inaccessible to institutional and retail investors. Tokenization addresses this gap by fractionalising asset ownership, reducing settlement times from days to seconds, enforcing compliance programmatically, and enabling 24/7 secondary market trading.\\r\\n\\r\\nTokenEquityX V3 is a production-grade platform comprising eleven smart contracts — pending independent security audit ahead of mainnet deployment — deployed on the Polygon blockchain, a full-stack backend API with thirteen functional modules, five role-differentiated dashboards, a real-time order matching engine, a multi-model valuation engine covering six asset classes, and a complete audit trail architecture meeting institutional compliance requirements.\\r\\n\\r\\nKey Platform Capabilities\\r\\n•\\tMulti-asset tokenization: equity, real estate, mining, infrastructure, REITs, and bonds\\r\\n•\\tKYC/AML compliance enforced at the smart contract level on every token transfer\\r\\n•\\tOn-chain corporate governance enabling shareholder voting on company resolutions\\r\\n•\\tAutomated dividend and coupon distribution to verified token holders\\r\\n•\\tReal-time order book with price-time priority matching and atomic DVP settlement\\r\\n•\\tSix-model valuation engine producing auditor-approved reference prices\\r\\n•\\tComplete audit trail meeting institutional and regulatory reporting requirements\\r\\n•\\tRole-based access for investors, issuers, auditors, administrators, and partners\\r\\n\\r\\nStrategic Partnership Framework\\r\\nTokenEquityX seeks to establish the following institutional partnership structure to ensure sustainable growth and regulatory alignment:\\r\\n\\r\\nPartner\\tRole\\tValue Contribution\\r\\nInternational Finance Corporation (IFC)\\tGrant & Technical Partner\\tTechnical assistance grants, regulatory engagement, global credibility\\r\\nAfrican Development Bank (AfDB)\\tEquity Partner (15-20%)\\tBalance sheet credibility, continental network, SADC expansion pathway\\r\\nStanbic Bank / Ecobank\\tBanking & Distribution Partner\\tPayment rails, banking infrastructure, investor distribution network\\r\\n \\r\\n\",\"jurisdiction\":\"Zimbabwe\",\"targetRaiseUsd\":500000,\"tokenIssuePrice\":10,\"totalSupply\":1000000,\"expectedYield\":\"36\",\"distributionFrequency\":\"Quarterly\",\"keyPersonnel\":[{\"role\":\"CEO\",\"name\":\"Richard Chimuja\",\"email\":\"richard,chimuka@tokenequityx.co.zw\",\"idNumber\":\"08-671488E22\"},{\"role\":\"CFO\",\"name\":\"Leo Manezhu Gaviao\",\"email\":\"leo.gaviao@tokenequityx.co.zw\",\"idNumber\":\"08-671488E22\"},{\"role\":\"Legal Counsel\",\"name\":\"Tendai Rwodzi\",\"email\":\"tr@legal.co.zw\",\"idNumber\":\"08-671488E22\"}],\"documents\":[{\"originalName\":\"TokenEquityX_Whitepaper_V3.docx\",\"storedName\":\"0xce1ebe789e_1775054770269_TokenEquityX_Whitepaper_V3.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770269_TokenEquityX_Whitepaper_V3.docx\",\"size\":48875,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_SECZ_BusinessPlan.docx\",\"storedName\":\"0xce1ebe789e_1775054770272_TokenEquityX_SECZ_BusinessPlan.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770272_TokenEquityX_SECZ_BusinessPlan.docx\",\"size\":75995,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_Financial_Model.xlsx\",\"storedName\":\"0xce1ebe789e_1775054770277_TokenEquityX_Financial_Model.xlsx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770277_TokenEquityX_Financial_Model.xlsx\",\"size\":51270,\"mimetype\":\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\"},{\"originalName\":\"TokenEquityX_Financial_Model.xlsx\",\"storedName\":\"0xce1ebe789e_1775054770278_TokenEquityX_Financial_Model.xlsx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770278_TokenEquityX_Financial_Model.xlsx\",\"size\":51270,\"mimetype\":\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\"},{\"originalName\":\"TEX_WhiteLabel_Brochure.docx\",\"storedName\":\"0xce1ebe789e_1775054770279_TEX_WhiteLabel_Brochure.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770279_TEX_WhiteLabel_Brochure.docx\",\"size\":14319,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TEX_WhiteLabel_Brochure.docx\",\"storedName\":\"0xce1ebe789e_1775054770280_TEX_WhiteLabel_Brochure.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770280_TEX_WhiteLabel_Brochure.docx\",\"size\":14319,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"},{\"originalName\":\"TokenEquityX_SECZ_BusinessPlan.docx\",\"storedName\":\"0xce1ebe789e_1775054770281_TokenEquityX_SECZ_BusinessPlan.docx\",\"url\":\"/uploads/assets/0xce1ebe789e_1775054770281_TokenEquityX_SECZ_BusinessPlan.docx\",\"size\":75995,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"}],\"submittedBy\":\"2\",\"submittedAt\":\"2026-04-01T14:46:10.321Z\",\"referenceNumber\":\"TEX-2026-8370\"}', 'PENDING', NULL, NULL, NULL, NULL, '2026-04-01 14:46:10', '2026-04-01 14:46:10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `deposit_requests`
--

CREATE TABLE `deposit_requests` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `user_id` varchar(36) NOT NULL,
  `amount_usd` decimal(20,2) NOT NULL,
  `reference` varchar(100) NOT NULL,
  `proof_doc` varchar(255) DEFAULT NULL,
  `status` enum('PENDING','CONFIRMED','REJECTED') DEFAULT 'PENDING',
  `confirmed_by` varchar(36) DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dividend_claims`
--

CREATE TABLE `dividend_claims` (
  `id` int(11) NOT NULL,
  `round_id` int(11) NOT NULL,
  `wallet_address` varchar(42) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `amount_usdc` decimal(20,6) NOT NULL DEFAULT 0.000000,
  `claimed` tinyint(1) NOT NULL DEFAULT 0,
  `claimed_at` timestamp NULL DEFAULT NULL,
  `tx_hash` varchar(66) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dividend_rounds`
--

CREATE TABLE `dividend_rounds` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `total_amount_usdc` decimal(20,8) NOT NULL,
  `amount_per_token` decimal(20,8) NOT NULL,
  `snapshot_block` int(11) DEFAULT NULL,
  `claim_deadline` datetime NOT NULL,
  `status` enum('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  `created_by` varchar(42) NOT NULL,
  `tx_hash` varchar(66) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dividend_rounds`
--

INSERT INTO `dividend_rounds` (`id`, `token_symbol`, `description`, `total_amount_usdc`, `amount_per_token`, `snapshot_block`, `claim_deadline`, `status`, `created_by`, `tx_hash`, `created_at`) VALUES
(1, '', 'Q1 2026 Rental Distribution', 23000.00000000, 0.02300000, NULL, '2026-04-12 09:17:37', 'OPEN', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', NULL, '2026-03-29 07:17:37'),
(2, '', 'April 2026 Coupon Payment', 10625.00000000, 0.00850000, NULL, '2026-04-16 09:18:02', 'OPEN', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', NULL, '2026-03-29 07:18:02');

-- --------------------------------------------------------

--
-- Table structure for table `investor_wallets`
--

CREATE TABLE `investor_wallets` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `user_id` varchar(36) NOT NULL,
  `balance_usd` decimal(20,2) NOT NULL DEFAULT 0.00,
  `balance_usdc` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `reserved_usd` decimal(20,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `investor_wallets`
--

INSERT INTO `investor_wallets` (`id`, `user_id`, `balance_usd`, `balance_usdc`, `reserved_usd`, `created_at`, `updated_at`) VALUES
('680ef3b5-3067-11f1-9723-af6b0cfbc6ed', 'staff-admin-001', 0.00, 0.00000000, 0.00, '2026-04-04 20:46:51', '2026-04-04 20:46:51');

-- --------------------------------------------------------

--
-- Table structure for table `kyc_documents`
--

CREATE TABLE `kyc_documents` (
  `id` int(11) NOT NULL,
  `kyc_record_id` int(11) NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kyc_records`
--

CREATE TABLE `kyc_records` (
  `id` int(11) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `wallet_address` varchar(42) NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `full_name` varchar(255) DEFAULT NULL,
  `id_number` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `investor_type` enum('RETAIL','ACCREDITED','INSTITUTIONAL','FAMILY_OFFICE') NOT NULL DEFAULT 'RETAIL',
  `reviewed_by` varchar(42) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `market_controls`
--

CREATE TABLE `market_controls` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `daily_trade_limit_usd` decimal(20,8) NOT NULL DEFAULT 50000.00000000,
  `circuit_breaker_pct` decimal(10,4) NOT NULL DEFAULT 10.0000,
  `is_halted` tinyint(1) NOT NULL DEFAULT 0,
  `halt_reason` varchar(500) DEFAULT NULL,
  `updated_by` varchar(42) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `market_controls`
--

INSERT INTO `market_controls` (`id`, `token_symbol`, `daily_trade_limit_usd`, `circuit_breaker_pct`, `is_halted`, `halt_reason`, `updated_by`, `updated_at`) VALUES
(1, 'ZWIB', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:11:45'),
(2, 'HCPR', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:11:45'),
(3, 'ACME', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:11:45'),
(4, 'GDMR', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:11:45'),
(5, 'ZWIB', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:13:29'),
(6, 'HCPR', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:13:29'),
(7, 'ACME', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:13:29'),
(8, 'GDMR', 50000.00000000, 10.0000, 0, NULL, NULL, '2026-03-29 07:13:29');

-- --------------------------------------------------------

--
-- Table structure for table `oracle_prices`
--

CREATE TABLE `oracle_prices` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `price` decimal(20,8) NOT NULL,
  `set_by` varchar(42) NOT NULL,
  `source` varchar(100) DEFAULT NULL,
  `tx_hash` varchar(66) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `oracle_prices`
--

INSERT INTO `oracle_prices` (`id`, `token_symbol`, `price`, `set_by`, `source`, `tx_hash`, `created_at`) VALUES
(5, 'ZWIB', 1.02400000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:11:19'),
(6, 'HCPR', 1.00500000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:11:19'),
(7, 'ACME', 0.98200000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:11:19'),
(8, 'GDMR', 1.01500000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:11:19'),
(9, 'ZWIB', 1.02400000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:13:00'),
(10, 'HCPR', 1.00500000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:13:00'),
(11, 'ACME', 0.98200000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:13:00'),
(12, 'GDMR', 1.01500000, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'Auditor: J. Sibanda CPA', NULL, '2026-03-29 07:13:00'),
(13, 'MCR', 3.00000000, '0xAUDIT00000000000000000000000000000000000', 'Auditor certification — Independent Appraisal — 2026-04-04', NULL, '2026-04-04 17:45:01');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` varchar(36) NOT NULL,
  `wallet_address` varchar(42) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `order_type` enum('MARKET','LIMIT') NOT NULL DEFAULT 'MARKET',
  `side` enum('BUY','SELL') NOT NULL,
  `quantity` decimal(20,8) NOT NULL,
  `price` decimal(20,8) NOT NULL,
  `filled_quantity` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `status` enum('OPEN','PARTIAL','FILLED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'OPEN',
  `tx_hash` varchar(66) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `token_id` varchar(36) DEFAULT NULL,
  `filled_qty` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `limit_price` decimal(20,8) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `partner_clients`
--

CREATE TABLE `partner_clients` (
  `id` int(11) NOT NULL,
  `partner_id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `partner_commissions`
--

CREATE TABLE `partner_commissions` (
  `id` int(11) NOT NULL,
  `partner_id` varchar(36) NOT NULL,
  `source_type` enum('TRADING_FEE','ISSUANCE_FEE','ANNUAL_FEE','KYC_FEE') NOT NULL,
  `amount_usd` decimal(15,6) NOT NULL,
  `trade_ref` varchar(100) DEFAULT NULL,
  `month_year` varchar(7) NOT NULL,
  `paid` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `partner_leads`
--

CREATE TABLE `partner_leads` (
  `id` int(11) NOT NULL,
  `partner_id` varchar(36) NOT NULL,
  `company_name` varchar(200) NOT NULL,
  `lead_type` varchar(100) NOT NULL,
  `contact_name` varchar(200) DEFAULT NULL,
  `est_value` decimal(15,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('NEW','CONTACTED','QUALIFIED','SUBMITTED','CONVERTED','LOST') NOT NULL DEFAULT 'NEW',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `platform_treasury`
--

CREATE TABLE `platform_treasury` (
  `id` int(11) NOT NULL DEFAULT 1,
  `usdc_balance` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `usd_liability` decimal(20,2) NOT NULL DEFAULT 0.00,
  `last_reconciled` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `platform_treasury`
--

INSERT INTO `platform_treasury` (`id`, `usdc_balance`, `usd_liability`, `last_reconciled`, `updated_at`) VALUES
(1, 0.00000000, 0.00, NULL, '2026-04-04 20:05:46');

-- --------------------------------------------------------

--
-- Table structure for table `proposals`
--

CREATE TABLE `proposals` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `title` varchar(500) NOT NULL,
  `description` text DEFAULT NULL,
  `proposed_by` varchar(42) NOT NULL,
  `votes_for` int(11) NOT NULL DEFAULT 0,
  `votes_against` int(11) NOT NULL DEFAULT 0,
  `votes_abstain` int(11) NOT NULL DEFAULT 0,
  `status` enum('ACTIVE','PASSED','REJECTED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `start_time` datetime DEFAULT current_timestamp(),
  `end_time` datetime NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `proposals`
--

INSERT INTO `proposals` (`id`, `token_symbol`, `company_name`, `title`, `description`, `proposed_by`, `votes_for`, `votes_against`, `votes_abstain`, `status`, `start_time`, `end_time`, `created_at`) VALUES
(1, 'ACME', 'Acme Mining Ltd', 'Approve Phase 2 Capital Expenditure Programme', 'Board resolution to approve USD 2.1M expansion budget for Block 12 Phase 2 works.', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 340, 45, 15, 'ACTIVE', '2026-03-29 09:14:59', '2026-04-03 09:14:59', '2026-03-29 09:14:59'),
(2, 'HCPR', 'Harare CBD REIT', 'Appoint New Independent Director — Audit Committee', 'Appointment of qualified CA(Z) to serve as independent chair of the Audit Committee.', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 180, 20, 10, 'ACTIVE', '2026-03-29 09:14:59', '2026-04-06 09:14:59', '2026-03-29 09:14:59'),
(3, 'ZWIB', 'ZimInfra Holdings', 'Authorise Early Redemption of 10% Bond Tranche', 'Resolution to authorise early redemption of 125,000 tokens at par from surplus toll revenues.', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 520, 30, 25, 'ACTIVE', '2026-03-29 09:14:59', '2026-04-10 09:14:59', '2026-03-29 09:14:59');

-- --------------------------------------------------------

--
-- Table structure for table `spvs`
--

CREATE TABLE `spvs` (
  `id` int(11) NOT NULL,
  `issuer_wallet` varchar(42) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `registration_number` varchar(100) DEFAULT NULL,
  `asset_class` enum('REAL_ESTATE','MINING','BOND','INFRASTRUCTURE','EQUITY','AGRICULTURE') NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('PENDING','KYC_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `owner_user_id` varchar(36) DEFAULT NULL,
  `legal_name` varchar(255) DEFAULT NULL,
  `jurisdiction` varchar(100) DEFAULT NULL,
  `sector` varchar(100) DEFAULT NULL,
  `asset_type` varchar(50) DEFAULT NULL,
  `ipfs_doc_hash` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `spvs`
--

INSERT INTO `spvs` (`id`, `issuer_wallet`, `company_name`, `registration_number`, `asset_class`, `description`, `status`, `created_at`, `updated_at`, `owner_user_id`, `legal_name`, `jurisdiction`, `sector`, `asset_type`, `ipfs_doc_hash`) VALUES
(17, '', '', 'ZW2024001', 'REAL_ESTATE', 'Infrastructure bond financing the Beitbridge-Harare toll road corridor.', 'PENDING', '2026-03-29 06:55:56', '2026-03-29 06:55:56', '3', 'ZimInfra Holdings (Pvt) Ltd', 'Zimbabwe', 'Infrastructure', 'BOND', NULL),
(18, '', '', 'ZW2024002', 'REAL_ESTATE', 'REIT holding 8 Grade-A commercial properties in Harare CBD.', 'PENDING', '2026-03-29 06:55:56', '2026-03-29 06:55:56', '5', 'Harare CBD REIT Management Ltd', 'Zimbabwe', 'Real Estate', 'REAL_ESTATE', NULL),
(19, '', '', 'ZW2024003', 'REAL_ESTATE', 'PGM producer operating Block 12 on Zimbabwe Great Dyke.', 'PENDING', '2026-03-29 06:55:56', '2026-03-29 06:55:56', '3', 'Acme Mining Ltd', 'Zimbabwe', 'Mining', 'EQUITY', NULL),
(20, '', '', 'ZW2024004', 'REAL_ESTATE', 'Advanced-stage PGM exploration. 2.8M oz JORC resource at Sebakwe Block.', 'PENDING', '2026-03-29 06:55:56', '2026-03-29 06:55:56', '5', 'Great Dyke Minerals (Pvt) Ltd', 'Zimbabwe', 'Mining', 'EQUITY', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tokens`
--

CREATE TABLE `tokens` (
  `id` int(11) NOT NULL,
  `spv_id` int(11) DEFAULT NULL,
  `symbol` varchar(20) NOT NULL,
  `name` varchar(200) NOT NULL DEFAULT '',
  `company_name` varchar(255) NOT NULL,
  `asset_class` varchar(50) NOT NULL,
  `contract_address` varchar(42) DEFAULT NULL,
  `total_supply` bigint(20) NOT NULL DEFAULT 0,
  `price_usd` decimal(18,8) NOT NULL DEFAULT 1.00000000,
  `oracle_price` decimal(20,8) NOT NULL DEFAULT 1.00000000,
  `market_cap` decimal(20,2) DEFAULT NULL,
  `change_24h` decimal(8,4) DEFAULT 0.0000,
  `volume_24h` decimal(20,2) DEFAULT 0.00,
  `market_state` enum('PRE_LAUNCH','PRIMARY_ONLY','FULL_TRADING','SUSPENDED','DELISTED') NOT NULL DEFAULT 'PRE_LAUNCH',
  `issuer_address` varchar(42) NOT NULL,
  `listing_price` decimal(20,8) NOT NULL DEFAULT 1.00000000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `description` text DEFAULT NULL,
  `issuer_id` varchar(36) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `token_name` varchar(255) DEFAULT NULL,
  `token_symbol` varchar(20) DEFAULT NULL,
  `ticker` varchar(20) DEFAULT NULL,
  `asset_type` varchar(50) DEFAULT NULL,
  `current_price_usd` decimal(20,8) NOT NULL DEFAULT 1.00000000,
  `issued_shares` bigint(20) NOT NULL DEFAULT 0,
  `authorised_shares` bigint(20) NOT NULL DEFAULT 0,
  `nominal_value_cents` int(11) NOT NULL DEFAULT 100,
  `status` enum('DRAFT','ACTIVE','SUSPENDED','DELISTED') DEFAULT 'ACTIVE',
  `jurisdiction` varchar(100) DEFAULT 'Zimbabwe',
  `ipfs_doc_hash` varchar(100) DEFAULT NULL,
  `submission_id` int(11) DEFAULT NULL,
  `listed_at` timestamp NULL DEFAULT NULL,
  `trading_mode` enum('FULL_TRADING','P2P_ONLY','SUSPENDED','PRE_LISTING') NOT NULL DEFAULT 'PRE_LISTING',
  `listing_type` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tokens`
--

INSERT INTO `tokens` (`id`, `spv_id`, `symbol`, `name`, `company_name`, `asset_class`, `contract_address`, `total_supply`, `price_usd`, `oracle_price`, `market_cap`, `change_24h`, `volume_24h`, `market_state`, `issuer_address`, `listing_price`, `created_at`, `updated_at`, `description`, `issuer_id`, `is_active`, `token_name`, `token_symbol`, `ticker`, `asset_type`, `current_price_usd`, `issued_shares`, `authorised_shares`, `nominal_value_cents`, `status`, `jurisdiction`, `ipfs_doc_hash`, `submission_id`, `listed_at`, `trading_mode`, `listing_type`) VALUES
(25, 17, 'ZWIB', 'ZimInfra Bond 2027', 'ZimInfra Holdings', 'BOND', NULL, 1250000, 1.00500000, 1.00000000, 5025000.00, 0.5000, 125000.00, 'FULL_TRADING', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 1.00000000, '2026-03-29 07:08:21', '2026-04-03 09:15:00', '3-year infrastructure bond. 8.5% coupon quarterly.', NULL, 1, 'ZimInfra Bond 2027', 'ZWIB', 'ZWIB', 'BOND', 1.02400000, 1250000, 2000000, 100, 'ACTIVE', 'Zimbabwe', NULL, NULL, '2026-04-03 09:15:00', 'FULL_TRADING', NULL),
(26, 18, 'HCPR', 'Harare CBD REIT', 'Harare CBD REIT', 'REAL_ESTATE', NULL, 5000000, 1.02300000, 1.02000000, 10230000.00, 2.3000, 340000.00, 'FULL_TRADING', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 1.00000000, '2026-03-29 07:08:21', '2026-04-03 09:15:01', 'REIT holding 8 Grade-A properties. 9.2% annual yield.', NULL, 1, 'Harare CBD REIT', 'HCPR', 'HCPR', 'REAL_ESTATE', 1.00500000, 5000000, 5000000, 100, 'ACTIVE', 'Zimbabwe', NULL, NULL, '2026-04-03 09:15:01', 'FULL_TRADING', NULL),
(27, 19, 'ACME', 'Acme Mining Ltd', 'Acme Mining Ltd', 'EQUITY', NULL, 1000000, 0.87500000, 0.90000000, 17500000.00, -1.2500, 89000.00, 'FULL_TRADING', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 1.00000000, '2026-03-29 07:08:21', '2026-04-03 09:15:01', 'PGM equity token. 850 oz production per quarter.', NULL, 1, 'Acme Mining Ltd', 'ACME', 'ACME', 'EQUITY', 0.98200000, 1000000, 2000000, 100, 'ACTIVE', 'Zimbabwe', NULL, NULL, '2026-04-03 09:15:01', 'FULL_TRADING', NULL),
(28, 20, 'GDMR', 'Great Dyke Minerals', 'Great Dyke Minerals', 'EQUITY', NULL, 3000000, 0.21000000, 0.20000000, 10500000.00, 5.0000, 45000.00, 'FULL_TRADING', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 1.00000000, '2026-03-29 07:08:21', '2026-04-03 09:15:01', 'Pre-revenue PGM development. 2.8M oz JORC resource.', NULL, 1, 'Great Dyke Minerals', 'GDMR', 'GDMR', 'EQUITY', 1.01500000, 3000000, 5000000, 100, 'ACTIVE', 'Zimbabwe', NULL, NULL, '2026-04-03 09:15:01', 'P2P_ONLY', NULL),
(30, NULL, 'MCR', 'MCR', 'MCR', 'EQUITY', NULL, 1000000, 3.00000000, 3.00000000, 3000000.00, 0.0000, 0.00, 'FULL_TRADING', '', 1.00000000, '2026-04-04 17:45:35', '2026-04-04 17:45:35', NULL, NULL, 1, NULL, NULL, NULL, 'EQUITY', 3.00000000, 0, 0, 100, 'ACTIVE', 'Zimbabwe', NULL, 452068, '2026-04-04 17:45:35', 'P2P_ONLY', 'GREENFIELD_P2P');

-- --------------------------------------------------------

--
-- Table structure for table `trades`
--

CREATE TABLE `trades` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) DEFAULT NULL,
  `buy_order_id` varchar(36) DEFAULT NULL,
  `sell_order_id` varchar(36) DEFAULT NULL,
  `buyer_wallet` varchar(42) NOT NULL,
  `seller_wallet` varchar(42) NOT NULL,
  `quantity` decimal(20,8) NOT NULL,
  `price` decimal(20,8) NOT NULL,
  `total_value` decimal(20,8) DEFAULT NULL,
  `platform_fee` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `tx_hash` varchar(66) DEFAULT NULL,
  `settled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `token_id` varchar(36) DEFAULT NULL,
  `total_usdc` decimal(20,8) DEFAULT NULL,
  `matched_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `trades`
--

INSERT INTO `trades` (`id`, `token_symbol`, `buy_order_id`, `sell_order_id`, `buyer_wallet`, `seller_wallet`, `quantity`, `price`, `total_value`, `platform_fee`, `tx_hash`, `settled_at`, `token_id`, `total_usdc`, `matched_at`) VALUES
(1, '', '0', '0', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', 5000.00000000, 1.02400000, 0.00000000, 25.60000000, NULL, '2026-03-29 07:14:00', '25', 5120.00000000, '2026-03-29 05:14:00'),
(2, '', '0', '0', '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 3000.00000000, 1.02350000, 0.00000000, 15.35000000, NULL, '2026-03-29 07:14:00', '25', 3070.50000000, '2026-03-29 02:14:00'),
(3, '', '0', '0', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 10000.00000000, 1.00500000, 0.00000000, 50.25000000, NULL, '2026-03-29 07:14:00', '26', 10050.00000000, '2026-03-29 04:14:00'),
(4, '', '0', '0', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', 7500.00000000, 1.00480000, 0.00000000, 37.68000000, NULL, '2026-03-29 07:14:00', '26', 7536.00000000, '2026-03-28 23:14:00'),
(5, '', '0', '0', '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', 15000.00000000, 0.98200000, 0.00000000, 73.65000000, NULL, '2026-03-29 07:14:00', '27', 14730.00000000, '2026-03-29 06:14:00'),
(6, '', '0', '0', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 8000.00000000, 0.98150000, 0.00000000, 39.26000000, NULL, '2026-03-29 07:14:00', '27', 7852.00000000, '2026-03-29 01:14:00'),
(7, '', '0', '0', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 4000.00000000, 1.01500000, 0.00000000, 20.30000000, NULL, '2026-03-29 07:14:00', '28', 4060.00000000, '2026-03-29 03:14:00');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `wallet_address` varchar(42) NOT NULL,
  `type` enum('BUY','SELL','DIVIDEND','KYC_FEE','PLATFORM_FEE','ISSUANCE_FEE') NOT NULL,
  `token_symbol` varchar(20) DEFAULT NULL,
  `amount_usdc` decimal(20,8) NOT NULL,
  `tx_hash` varchar(66) DEFAULT NULL,
  `status` enum('PENDING','CONFIRMED','FAILED') NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `wallet` varchar(42) NOT NULL,
  `role` enum('ADMIN','INVESTOR','ISSUER','AUDITOR','PARTNER','COMPLIANCE_OFFICER','DFI') NOT NULL DEFAULT 'INVESTOR',
  `kyc_status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL,
  `wallet_address` varchar(42) GENERATED ALWAYS AS (`wallet`) VIRTUAL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `onboarding_complete` tinyint(1) NOT NULL DEFAULT 0,
  `referred_by` varchar(100) DEFAULT NULL,
  `account_status` varchar(20) DEFAULT 'ACTIVE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `wallet`, `role`, `kyc_status`, `email`, `full_name`, `password_hash`, `created_at`, `updated_at`, `last_login`, `last_login_ip`, `is_active`, `onboarding_complete`, `referred_by`, `account_status`) VALUES
('1', '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'ADMIN', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('17bf2745-76b7-4d89-bb8b-d759c6a7a8eb', 'email_17bf2745', 'INVESTOR', 'APPROVED', 'leomanezh@gmail.com', 'Leo Manezhu Gaviao', '$2b$12$rUfUh7S6Xn90fH/yrqqlr.vmWLAKA2eXlCnofNcWFAejJ6rN2q2G2', '2026-04-03 10:25:38', '2026-04-03 19:00:53', '2026-04-03 11:04:04', NULL, 1, 0, NULL, 'ACTIVE'),
('2', '0xce1ebe789e0067f08222e5cd0456a02c7a7c8e90', 'ADMIN', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('3', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'ISSUER', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('4', '0x14dc79964da2c08b23698b3d3cc7ca32193d9955', 'PARTNER', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('42c283d7-80dc-40ec-8550-e5d6c2ddef56', '', 'INVESTOR', '', NULL, NULL, NULL, '2026-03-29 05:53:12', '2026-04-03 02:39:06', '2026-04-03 02:39:06', '::1', 1, 0, NULL, 'ACTIVE'),
('5', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'ISSUER', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('6', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'INVESTOR', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('7', '0x976ea74026e726554db657fa54763abd0c3a0aa9', 'AUDITOR', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('75c045ed-7623-4a6e-b571-140a6a3a4a5b', 'email_75c045ed', 'INVESTOR', 'APPROVED', 'leomgaviao@outlook.com', 'Leo Gavia', '$2b$12$1bLxvWdYndAFIPToO0./u.bJ/H94GmUdBw9V7DIRh.MX3k21HVNF.', '2026-04-04 11:23:30', '2026-04-04 17:19:27', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('8', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', 'INVESTOR', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('9', '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 'INVESTOR', 'APPROVED', NULL, NULL, NULL, '2026-03-29 05:02:17', '2026-03-29 05:02:17', NULL, NULL, 1, 0, NULL, 'ACTIVE'),
('staff-admin-001', '0xADMIN00000000000000000000000000000000000', 'ADMIN', 'APPROVED', 'admin2@tokenequityx.com', 'Platform Admin', '$2b$12$J9oI1QVmqdn4NEvZsSP7aOpeo/h0FnElUkiyiWkKmix2WPuozMlXK', '2026-04-03 03:35:28', '2026-04-06 09:24:55', '2026-04-06 09:24:55', NULL, 1, 1, NULL, 'ACTIVE'),
('staff-auditor-001', '0xAUDIT00000000000000000000000000000000000', 'AUDITOR', 'APPROVED', 'auditor@tokenequityx.com', 'Chief Auditor', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '2026-04-03 03:35:28', '2026-04-04 21:13:31', '2026-04-04 21:13:31', NULL, 1, 1, NULL, 'ACTIVE'),
('staff-dfi-001', '0xDFI0000000000000000000000000000000000001', 'DFI', 'APPROVED', 'dfi@tokenequityx.com', 'DFI Observer', NULL, '2026-04-03 03:35:28', '2026-04-04 17:31:46', NULL, NULL, 1, 1, NULL, 'ACTIVE'),
('staff-investor-001', '0xINVST00000000000000000000000000000000001', 'INVESTOR', 'APPROVED', 'investor@tokenequityx.com', 'Test Investor', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '2026-04-03 03:35:28', '2026-04-04 19:36:57', '2026-04-04 19:36:57', NULL, 1, 0, NULL, 'ACTIVE'),
('staff-issuer-001', '0xISSUE00000000000000000000000000000000001', 'ISSUER', 'APPROVED', 'issuer@tokenequityx.com', 'Test Issuer', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '2026-04-03 03:35:28', '2026-04-04 19:39:34', '2026-04-04 19:39:34', NULL, 1, 0, NULL, 'ACTIVE'),
('staff-partner-001', '0xPARTN00000000000000000000000000000000001', 'PARTNER', 'APPROVED', 'partner@tokenequityx.com', 'Test Partner', NULL, '2026-04-03 03:35:28', '2026-04-04 17:31:46', NULL, NULL, 1, 1, NULL, 'ACTIVE');

-- --------------------------------------------------------

--
-- Table structure for table `valuations`
--

CREATE TABLE `valuations` (
  `id` int(11) NOT NULL,
  `token_symbol` varchar(20) NOT NULL,
  `submission_id` int(11) DEFAULT NULL,
  `model_used` varchar(100) NOT NULL,
  `calculated_price` decimal(20,8) NOT NULL,
  `variance_pct` decimal(10,4) DEFAULT NULL,
  `approved_by` varchar(42) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--

CREATE TABLE `votes` (
  `id` int(11) NOT NULL,
  `proposal_id` int(11) NOT NULL,
  `wallet_address` varchar(42) NOT NULL,
  `choice` enum('FOR','AGAINST','ABSTAIN') NOT NULL,
  `token_balance` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wallet_transactions`
--

CREATE TABLE `wallet_transactions` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `user_id` varchar(36) NOT NULL,
  `type` enum('DEPOSIT','WITHDRAWAL','TRADE_BUY','TRADE_SELL','DIVIDEND','FEE','REFUND','ADJUSTMENT') NOT NULL,
  `amount_usd` decimal(20,2) NOT NULL,
  `balance_before` decimal(20,2) NOT NULL,
  `balance_after` decimal(20,2) NOT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `withdrawal_requests`
--

CREATE TABLE `withdrawal_requests` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `user_id` varchar(36) NOT NULL,
  `amount_usd` decimal(20,2) NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `account_name` varchar(255) NOT NULL,
  `account_number` varchar(100) NOT NULL,
  `branch_code` varchar(50) DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','COMPLETED','REJECTED') DEFAULT 'PENDING',
  `processed_by` varchar(36) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `tx_reference` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `analytics_snapshots`
--
ALTER TABLE `analytics_snapshots`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `auth_nonces`
--
ALTER TABLE `auth_nonces`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `bonds`
--
ALTER TABLE `bonds`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `bond_coupons`
--
ALTER TABLE `bond_coupons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bond_id` (`bond_id`);

--
-- Indexes for table `data_submissions`
--
ALTER TABLE `data_submissions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `deposit_requests`
--
ALTER TABLE `deposit_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `reference` (`reference`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `dividend_claims`
--
ALTER TABLE `dividend_claims`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_claim` (`round_id`,`wallet_address`);

--
-- Indexes for table `dividend_rounds`
--
ALTER TABLE `dividend_rounds`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `investor_wallets`
--
ALTER TABLE `investor_wallets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_wallet` (`user_id`);

--
-- Indexes for table `kyc_documents`
--
ALTER TABLE `kyc_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `kyc_record_id` (`kyc_record_id`);

--
-- Indexes for table `kyc_records`
--
ALTER TABLE `kyc_records`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `market_controls`
--
ALTER TABLE `market_controls`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `oracle_prices`
--
ALTER TABLE `oracle_prices`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `partner_clients`
--
ALTER TABLE `partner_clients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_partner_client` (`partner_id`,`client_id`),
  ADD KEY `client_id` (`client_id`);

--
-- Indexes for table `partner_commissions`
--
ALTER TABLE `partner_commissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `partner_id` (`partner_id`);

--
-- Indexes for table `partner_leads`
--
ALTER TABLE `partner_leads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `partner_id` (`partner_id`);

--
-- Indexes for table `platform_treasury`
--
ALTER TABLE `platform_treasury`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `proposals`
--
ALTER TABLE `proposals`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `spvs`
--
ALTER TABLE `spvs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tokens`
--
ALTER TABLE `tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `symbol` (`symbol`),
  ADD KEY `spv_id` (`spv_id`);

--
-- Indexes for table `trades`
--
ALTER TABLE `trades`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `wallet_address` (`wallet`),
  ADD UNIQUE KEY `wallet` (`wallet`);

--
-- Indexes for table `valuations`
--
ALTER TABLE `valuations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `submission_id` (`submission_id`);

--
-- Indexes for table `votes`
--
ALTER TABLE `votes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_vote` (`proposal_id`,`wallet_address`);

--
-- Indexes for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `withdrawal_requests`
--
ALTER TABLE `withdrawal_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `analytics_snapshots`
--
ALTER TABLE `analytics_snapshots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `auth_nonces`
--
ALTER TABLE `auth_nonces`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `bonds`
--
ALTER TABLE `bonds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bond_coupons`
--
ALTER TABLE `bond_coupons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `data_submissions`
--
ALTER TABLE `data_submissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2147483648;

--
-- AUTO_INCREMENT for table `dividend_claims`
--
ALTER TABLE `dividend_claims`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dividend_rounds`
--
ALTER TABLE `dividend_rounds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `kyc_documents`
--
ALTER TABLE `kyc_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kyc_records`
--
ALTER TABLE `kyc_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `market_controls`
--
ALTER TABLE `market_controls`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `oracle_prices`
--
ALTER TABLE `oracle_prices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `partner_clients`
--
ALTER TABLE `partner_clients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `partner_commissions`
--
ALTER TABLE `partner_commissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `partner_leads`
--
ALTER TABLE `partner_leads`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `proposals`
--
ALTER TABLE `proposals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `spvs`
--
ALTER TABLE `spvs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `tokens`
--
ALTER TABLE `tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `trades`
--
ALTER TABLE `trades`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `valuations`
--
ALTER TABLE `valuations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `votes`
--
ALTER TABLE `votes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bond_coupons`
--
ALTER TABLE `bond_coupons`
  ADD CONSTRAINT `bond_coupons_ibfk_1` FOREIGN KEY (`bond_id`) REFERENCES `bonds` (`id`);

--
-- Constraints for table `deposit_requests`
--
ALTER TABLE `deposit_requests`
  ADD CONSTRAINT `deposit_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `dividend_claims`
--
ALTER TABLE `dividend_claims`
  ADD CONSTRAINT `dividend_claims_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `dividend_rounds` (`id`);

--
-- Constraints for table `investor_wallets`
--
ALTER TABLE `investor_wallets`
  ADD CONSTRAINT `investor_wallets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `kyc_documents`
--
ALTER TABLE `kyc_documents`
  ADD CONSTRAINT `kyc_documents_ibfk_1` FOREIGN KEY (`kyc_record_id`) REFERENCES `kyc_records` (`id`);

--
-- Constraints for table `partner_clients`
--
ALTER TABLE `partner_clients`
  ADD CONSTRAINT `partner_clients_ibfk_1` FOREIGN KEY (`partner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `partner_clients_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `partner_commissions`
--
ALTER TABLE `partner_commissions`
  ADD CONSTRAINT `partner_commissions_ibfk_1` FOREIGN KEY (`partner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `partner_leads`
--
ALTER TABLE `partner_leads`
  ADD CONSTRAINT `partner_leads_ibfk_1` FOREIGN KEY (`partner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tokens`
--
ALTER TABLE `tokens`
  ADD CONSTRAINT `tokens_ibfk_1` FOREIGN KEY (`spv_id`) REFERENCES `spvs` (`id`);

--
-- Constraints for table `valuations`
--
ALTER TABLE `valuations`
  ADD CONSTRAINT `valuations_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `data_submissions` (`id`);

--
-- Constraints for table `votes`
--
ALTER TABLE `votes`
  ADD CONSTRAINT `votes_ibfk_1` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`);

--
-- Constraints for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD CONSTRAINT `wallet_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `withdrawal_requests`
--
ALTER TABLE `withdrawal_requests`
  ADD CONSTRAINT `withdrawal_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
