# 🔗 CharityChain – Transparent Charity Donation System Using Blockchain

A decentralized charity donation platform built using **Ethereum, Solidity, Hardhat, React, and MetaMask**. CharityChain aims to improve transparency and trust in charitable donations by recording transactions on the blockchain.

## 🌟 Project Overview

CharityChain allows users to create charity campaigns, donate cryptocurrency, track transactions, and verify donations using blockchain technology.

The platform provides transparent donation records and helps donors monitor how funds are collected and managed.

## ✨ Key Features

- 🔐 **MetaMask Wallet Integration** – Connect and disconnect your wallet.
- ❤️ **Create Campaigns** – Create charity campaigns with descriptions and funding goals.
- 💰 **Donate Cryptocurrency** – Donate ETH to active campaigns.
- 📊 **Dashboard** – View campaign and donation statistics.
- 🔍 **Transaction Verification** – Verify donations using blockchain transaction hashes.
- 📜 **Transaction History** – View donation and withdrawal records.
- 🏆 **Donor Leaderboard** – Display top contributors.
- 🔔 **Notifications** – View platform activity notifications.
- 📄 **Donation Certificates** – Generate donation certificates.
- 🔄 **Refund Support** – Claim eligible refunds.
- 📈 **Transparency Reports** – View donation and campaign information.

## 🛠️ Technology Stack

### Frontend
- React.js
- Vite
- Tailwind CSS
- Ethers.js
- React Router
- Framer Motion
- Recharts
- Lucide React

### Blockchain
- Solidity
- Ethereum
- Hardhat
- MetaMask

### Development Tools
- Node.js
- npm
- Visual Studio Code
- Git and GitHub

## 📁 Project Structure

```text
Charity-Donation-Blockchain/
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── contracts/
│   └── CharityDonation.sol
│
├── scripts/
│   └── deploy.js
│
├── test/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── blockchain/
│   │   ├── components/
│   │   └── pages/
│   ├── package.json
│   └── vite.config.js
│
├── hardhat.config.js
└── README.md
```

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/RakeshBG195/Charity-Donation-Blockchain.git
```

### 2. Open the project

```bash
cd Charity-Donation-Blockchain
```

### 3. Install Hardhat dependencies

```bash
npm install
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

### 5. Start the frontend

```bash
npm run dev
```

Open the local URL displayed in your terminal.

## ⛓️ Smart Contract Deployment

Return to the project root:

```bash
cd ..
```

Start the local Hardhat blockchain:

```bash
npx hardhat node
```

Open another terminal and deploy the smart contract:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Update the deployed contract address in:

```text
frontend/src/blockchain/contract.js
```

Make sure MetaMask is configured with the correct network.

## 🌐 Live Website

**GitHub Repository:**  
https://github.com/RakeshBG195/Charity-Donation-Blockchain

**GitHub Pages:**  
https://rakeshbg195.github.io/Charity-Donation-Blockchain/

## 🔮 Future Enhancements

- Deploy smart contracts on a public testnet or mainnet.
- Enable decentralized storage for donation documents.
- Add enhanced donor identity and campaign verification.
- Integrate additional transparency and analytics features.
- Improve accessibility and mobile responsiveness.

## 👨‍💻 Developed By

**Rakesh B G**

B.Tech – Computer Science and Engineering (Blockchain)  
Presidency University, Bengaluru

## 📜 License

This project is developed for educational and demonstration purposes.
