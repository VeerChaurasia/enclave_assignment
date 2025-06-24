// monitor-service.ts - Monitor USDC transfers and auto-forward

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { sepolia, arbitrumSepolia, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import 'dotenv/config'
import { abi } from './abi' 
const PRIVATE_KEY_EOA=process.env.PRIVATE_KEY_EOA
const PRIVATE_KEY_RELAYER=process.env.PRIVATE_KEY_RELAYER
const DEPLOYMENT_CONFIG = {
  sepolia: {
    name: 'Ethereum Sepolia',
    chain: sepolia,
    rpcUrl: 'https://sepolia.drpc.org',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    explorerUrl: 'https://sepolia.etherscan.io'
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chain: arbitrumSepolia,
    rpcUrl: 'https://arbitrum-sepolia-rpc.publicnode.com',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    explorerUrl: 'https://sepolia.arbiscan.io'
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chain: baseSepolia,
    rpcUrl: 'https://rpc.therpc.io/base-sepolia',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    explorerUrl: 'https://sepolia.basescan.org'
  }
}
const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
])

interface TransferEvent {
  chainName: string
  txHash: string
  from: string
  to: string
  amount: bigint
  blockNumber: bigint
}

class USDCMonitoringService {
  private eoaAccount: any
  private relayerAccount: any
  private isRunning: boolean = false
  private lastCheckedBlocks: Map<string, bigint> = new Map()

  constructor() {
      if (!PRIVATE_KEY_EOA || !PRIVATE_KEY_EOA.startsWith('0x')) {
        throw new Error('PRIVATE_KEY_EOA environment variable is missing or invalid')
      }
      if (!PRIVATE_KEY_RELAYER || !PRIVATE_KEY_RELAYER.startsWith('0x')) {
        throw new Error('PRIVATE_KEY_RELAYER environment variable is missing or invalid')
      }
      this.eoaAccount = privateKeyToAccount(PRIVATE_KEY_EOA as `0x${string}`)
      this.relayerAccount = privateKeyToAccount(PRIVATE_KEY_RELAYER as `0x${string}`)
    }

  async startMonitoring() {
    console.log('Listening to USDC Transfers event')
    console.log(`📍 Monitoring Address: ${this.eoaAccount.address}`)
    console.log('Chains:', Object.keys(DEPLOYMENT_CONFIG).join(', '))
    console.log('=' .repeat(60))
    this.isRunning = true
    await this.initializeLastCheckedBlocks()
    const monitoringPromises = Object.entries(DEPLOYMENT_CONFIG).map(
      ([chainKey, config]) => this.monitorChain(chainKey, config)
    )

    await Promise.all(monitoringPromises)
  }

  private async initializeLastCheckedBlocks() {
    for (const [chainKey, config] of Object.entries(DEPLOYMENT_CONFIG)) {
      try {
        const publicClient = createPublicClient({
          chain: config.chain,
          transport: http(config.rpcUrl),
        })

        const currentBlock = await publicClient.getBlockNumber()
        this.lastCheckedBlocks.set(chainKey, currentBlock)
        console.log(`📊 ${config.name}: Starting from block ${currentBlock}`)
      } catch (error) {
        console.error(`❌ Failed to get current block for ${config.name}:`, error)
        this.lastCheckedBlocks.set(chainKey, 0n)
      }
    }
  }

  private async monitorChain(chainKey: string, config: any) {
    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    })

    console.log(`🔄 Starting monitoring for ${config.name}...`)

    while (this.isRunning) {
      try {
        await this.checkForNewTransfers(chainKey, config, publicClient)
        await this.sleep(5000) 
      } catch (error) {
        console.error(`❌ Error monitoring ${config.name}:`, error)
        await this.sleep(10000)
      }
    }
  }

  private async checkForNewTransfers(chainKey: string, config: any, publicClient: any) {
    const currentBlock = await publicClient.getBlockNumber()
    const lastChecked = this.lastCheckedBlocks.get(chainKey) || 0n

    if (currentBlock <= lastChecked) {
      return 
    }

    try {
      const logs = await publicClient.getLogs({
        address: config.usdcAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false }
          ]
        },
        args: {
          to: this.eoaAccount.address 
        },
        fromBlock: lastChecked + 1n,
        toBlock: currentBlock
      })

      if (logs.length > 0) {
        console.log(`\n💰 Found ${logs.length} USDC transfer(s) to unified address on ${config.name}`)
        
        for (const log of logs) {
          const transferEvent: TransferEvent = {
            chainName: config.name,
            txHash: log.transactionHash!,
            from: log.args.from as string,
            to: log.args.to as string,
            amount: log.args.value as bigint,
            blockNumber: log.blockNumber!
          }

          console.log(`  📥 Transfer: ${this.formatAmount(transferEvent.amount)} USDC from ${transferEvent.from}`)
          console.log(`     🔗 TX: ${config.explorerUrl}/tx/${transferEvent.txHash}`)
          await this.forwardTokens(chainKey, config, transferEvent)
        }
      }
      this.lastCheckedBlocks.set(chainKey, currentBlock)
    } catch (error) {
      console.error(`❌ Error checking transfers for ${config.name}:`, error)
    }
  }
  private async forwardTokens(chainKey: string, config: any, transferEvent: TransferEvent) {
    try {
      console.log(`  🚀 Initiating token forward on ${config.name}...`)
      const walletClient = createWalletClient({
        account: this.relayerAccount,
        chain: config.chain,
        transport: http(config.rpcUrl),
      })
      const hash = await walletClient.writeContract({
        account: this.relayerAccount,
        chain: config.chain,
        abi,
        address: this.eoaAccount.address,
        functionName: 'forwardToken',
        args: []
      })
      console.log(`  ⏳ Forwarding transaction sent: ${hash}`)
      const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        console.log(`  ✅ Tokens forwarded successfully!`)
        console.log(`     🔗 Forward TX: ${config.explorerUrl}/tx/${hash}`)
        console.log(`     ⛽ Gas Used: ${receipt.gasUsed?.toLocaleString()}`)
      } else {
        console.log(`  ❌ Forward transaction failed`)
      }

    } catch (error: any) {
      console.error(`  ❌ Failed to forward tokens on ${config.name}:`, error.message)
      if (error.message.includes('UnauthorizedRelayer')) {
        console.error(`     🔒 Relayer not authorized. Check relayer address in contract.`)
      } else if (error.message.includes('InvalidAmount')) {
        console.error(`     💰 No balance to forward or amount is zero.`)
      }
    }
  }
  private formatAmount(amount: bigint): string {
    return (Number(amount) / 1000000).toFixed(6)
  }
  stop() {
    console.log('\n🛑 Stopping monitoring service...')
    this.isRunning = false
  }
  async getStatus() {
    console.log('\n📊 MONITORING STATUS')
    console.log('=' .repeat(40))
    
    for (const [chainKey, config] of Object.entries(DEPLOYMENT_CONFIG)) {
      try {
        const publicClient = createPublicClient({
          chain: config.chain,
          transport: http(config.rpcUrl),
        })
        const balance = await publicClient.readContract({
          address: this.eoaAccount.address,
          abi,
          functionName: 'getUSDCBalance'
        })
        const lastBlock = this.lastCheckedBlocks.get(chainKey) || 0n
        const currentBlock = await publicClient.getBlockNumber()
        console.log(`📍 ${config.name}:`)
        console.log(`   💰 Current Balance: ${this.formatAmount(balance as bigint)} USDC`)
        console.log(`   📊 Last Checked Block: ${lastBlock}`)
        console.log(`   🔄 Current Block: ${currentBlock}`)
        console.log(`   ⚡ Status: ${this.isRunning ? 'MONITORING' : 'STOPPED'}`)
      } catch (error) {
        console.log(`❌ ${config.name}: Error getting status`)
      }
    }
  }
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

async function main() {
  const monitor = new USDCMonitoringService()
  process.on('SIGINT', () => {
    console.log('\n🛑 Received shutdown signal...')
    monitor.stop()
    process.exit(0)
  })
  await monitor.startMonitoring()
}

if (require.main === module) {
  main().catch(console.error)
}

export { USDCMonitoringService }