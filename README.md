### Unified Deposit Address System

A sophisticated multi-chain smart contract system that creates a **unified deposit address** using EIP-7702 to upgrade an EOA wallet to a smart contract. This system automatically forwards USDC transfers from multiple testnets to a specified recipient address.

## 🏗️ Architecture Overview

This system implements:
- **EIP-7702 Wallet Upgrade**: Converts an EOA wallet into a smart contract while maintaining the same address
- **Multi-Chain Deployment**: Supports Ethereum Sepolia, Arbitrum Sepolia, and Base Sepolia testnets
- **Automated Monitoring**: Backend service that listens for USDC transfers and automatically forwards them
- **Relayer System**: Authorized relayer that can initiate token transfers on behalf of the unified address

## 🔧 Technical Components

### Smart Contract Features
- **Unified Address**: Same address across all supported chains
- **Access Control**: Only authorized relayer can initiate transfers
- **Token Forwarding**: Automatic USDC transfer to recipient address
- **Balance Tracking**: Real-time USDC balance monitoring

### Deployed Contracts 
| Network | USDC Contract | 
|---------|---------------|
| Ethereum Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 
| Arbitrum Sepolia | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | 
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 

## 📋 Prerequisites

### Required Software
- **Node.js** (v18+ recommended)
- **npm** or **yarn**
- **Git**

### Required Accounts & Keys
- **EOA Private Key**: The wallet that will be upgraded to a smart contract
- **Relayer Private Key**: Authorized account that can initiate transfers
- **Recipient Address**: Where USDC will be forwarded

### Testnet Requirements
- **Sepolia ETH**: For gas fees on Ethereum Sepolia
- **Arbitrum Sepolia ETH**: For gas fees on Arbitrum Sepolia  
- **Base Sepolia ETH**: For gas fees on Base Sepolia

> 💡 **Get Testnet ETH**: Use faucets like [Sepolia Faucet](https://sepoliafaucet.com/), [Arbitrum Faucet](https://faucet.quicknode.com/arbitrum/sepolia), and [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/VeerChaurasia/enclave_assignment.git
cd enclave_assignment
```
### 2.Deploy Contract
```
cd contracts
cp .env.example .env
forge install
forge script script/Unified.s.sol:DeployScript --rpc-url https://1rpc.io/sepolia --broadcast --private-key $PRIVATE_KEY
forge script script/Unified.s.sol:DeployScript --rpc-url https://arbitrum-sepolia-rpc.publicnode.com --broadcast --private-key $PRIVATE_KEY
forge script script/Unified.s.sol:DeployScript --rpc-url https://base-sepolia.drpc.org --broadcast --private-key $PRIVATE_KEY
```
### 3. Backend
```bash
cd backend
npm install
```

### 4. Environment Configuration
```
cp .env.example .env
```


```env
# Private Keys (with 0x prefix)
PRIVATE_KEY_EOA=0x1234567890abcdef...
PRIVATE_KEY_RELAYER=0xabcdef1234567890...

# Addresses
RECIPIENT_ADDRESS=0x742d35Cc6635C0532925a3b8D5c4E9B2765F64...

# Contract Addresses (deployed logic contracts)
SEPOLIA=0x1234567890abcdef1234567890abcdef12345678
ARBITRUM_SEPOLIA=0x1234567890abcdef1234567890abcdef12345678
BASE_SEPOLIA=0x1234567890abcdef1234567890abcdef12345678


```

### 5. Upgrade EOA to Smart wallet on chains 
```bash
cd backend
npx ts-node deployandEOA.ts

```

**Expected Output:**
<img width="1470" alt="Output1" src="https://github.com/user-attachments/assets/628be69b-5098-4c91-a6d7-f010d85e13a7" />

<img width="837" alt="Output3" src="https://github.com/user-attachments/assets/649ef173-3649-4bb5-aa85-3ac75a76a72a" />
<img width="1451" alt="Output2" src="https://github.com/user-attachments/assets/9ca51b11-fa3f-4955-9680-791efc23dda2" />




### 6.Monitor for USDC transfer and autoforward to Recipient Adrress
```
cd backend
npx ts-node monitor.ts

```

**Expected Output:**

<img width="1393" alt="Screenshot 2025-06-24 at 10 20 39" src="https://github.com/user-attachments/assets/c984b0a1-2367-415a-b5fd-f6b55290666c" />




### View Real-time Logs
The monitoring service provides detailed logs including:
- Transfer detection across all chains
- Automatic forwarding transactions
- Gas usage statistics
- Error handling and recovery

### Stop Monitoring
Press `Ctrl+C` to gracefully stop the monitoring service.

## 🔍 Verification & Testing

### Verify Deployment
The deployment script automatically verifies:
- Contract initialization status
- Recipient and relayer addresses
- USDC contract configuration
- Current balance across all chains

### Manual Testing Steps

1. **Fund the EOA**: Ensure your EOA has testnet ETH on all chains
2. **Send Test USDC**: Transfer USDC to the unified address
3. **Monitor Logs**: Watch for automatic forwarding
4. **Check Recipient**: Verify USDC arrives at recipient address

### Test USDC Contracts

You can get test USDC from:
- **Sepolia**: [Circle Faucet](https://faucet.circle.com/)
- **Arbitrum/Base**: Bridge from Sepolia or use testnet faucets


## 🏛️ Smart Contract Architecture

### EIP-7702 Implementation
The system uses EIP-7702 to upgrade an EOA to a smart contract:

```typescript
// Generate authorization for EIP-7702
const authorization = await walletClient.signAuthorization({
  account: eoaAccount,
  contractAddress: logicContractAddress,
})

// Deploy with authorization
const hash = await walletClient.writeContract({
  account: relayerAccount,
  address: eoaAccount.address,
  authorizationList: [authorization],
  functionName: 'initialize',
  args: [recipient, relayer, usdcAddress],
})
```

### Key Functions
- `initialize(recipient, relayer, usdcAddress)`: Sets up the contract
- `forwardToken()`: Transfers all USDC to recipient
- `getUSDCBalance()`: Returns current USDC balance
- Access control via relayer-only modifiers

## 🔐 Security Considerations

### Private Key Management
- Store private keys securely
- Use environment variables only
- Never commit keys to version control
- Consider hardware wallets for production

### Access Control
- Only authorized relayer can initiate transfers
- Recipient address is immutable after initialization
- Contract upgrade protection via EIP-7702

### Network Security
- Uses reputable RPC endpoints
- Implements proper error handling
- Graceful failure recovery


## 📈 Performance & Scalability

### Monitoring Frequency
- **Block Check Interval**: 5 seconds per chain
- **Error Recovery**: 10 second backoff
- **Concurrent Monitoring**: All chains monitored simultaneously

### Gas Optimization
- Efficient contract design
- Batch operations where possible
- Optimized RPC calls

## 🎯 Production Considerations

### Mainnet Deployment
For production deployment:

1. **Update RPC URLs**: Use production-grade RPC services
2. **Security Audit**: Audit smart contracts thoroughly
3. **Multi-sig Setup**: Use multi-signature wallets for relayer
4. **Monitoring**: Implement comprehensive monitoring and alerting
5. **Backup Systems**: Set up redundant monitoring services

### Scaling to More Chains
The architecture supports easy addition of new chains:

1. Add chain configuration to `DEPLOYMENT_CONFIG`
2. Deploy logic contract to new chain
3. Update environment variables
4. Restart monitoring service

## 📄 License

MIT License - see LICENSE file for details.

