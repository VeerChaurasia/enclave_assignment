import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia, arbitrumSepolia, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { abi } from './abi'
import 'dotenv/config'
import fs from 'fs'

const CONTRACT_SEPOLIA=process.env.SEPOLIA
const CONTRACT_ARBITRUM=process.env.ARBITRUM_SEPOLIA
const CONTRACT_BASE=process.env.BASE_SEPOLIA
const RECIPIENT_ADDRESS=process.env.RECIPIENT_ADDRESS
const PRIVATE_KEY_EOA=process.env.PRIVATE_KEY_EOA
const PRIVATE_KEY_RELAYER=process.env.PRIVATE_KEY_RELAYER
const DEPLOYMENT_CONFIG = {
  sepolia: {
    name: 'Ethereum Sepolia',
    chain: sepolia,
    rpcUrl: 'https://sepolia.drpc.org',
    recipient: RECIPIENT_ADDRESS,
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    logicContractAddress: CONTRACT_SEPOLIA,
    explorerUrl: 'https://sepolia.etherscan.io'
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chain: arbitrumSepolia,
    rpcUrl: 'https://arbitrum-sepolia-rpc.publicnode.com',
    recipient: RECIPIENT_ADDRESS,
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', 
    logicContractAddress: CONTRACT_ARBITRUM, 
    explorerUrl: 'https://sepolia.arbiscan.io'
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chain: baseSepolia,
    rpcUrl: 'https://rpc.therpc.io/base-sepolia',
    recipient: RECIPIENT_ADDRESS,
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    logicContractAddress: CONTRACT_BASE, 
    explorerUrl: 'https://sepolia.basescan.org'
  }
}

interface DeploymentResult {
  chainName: string
  success: boolean
  error?: string
  txHash?: string
  blockNumber?: bigint
  gasUsed?: bigint
  unifiedAddress: string
  recipient: string
  relayer: string
  usdcAddress: string
  explorerLink?: string
}

class MultiChainDeployer {
  private eoaAccount: any
  private relayerAccount: any
  private deploymentResults: DeploymentResult[] = []

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

  async deployToAllChains(): Promise<DeploymentResult[]> {
    console.log('Deploying')
    console.log(` Unified Address: ${this.eoaAccount.address}`)
    console.log(`Relayer Address: ${this.relayerAccount.address}`)
    for (const [chainKey, config] of Object.entries(DEPLOYMENT_CONFIG)) {
      console.log(`\n🔄 Deploying to ${config.name}...`)
      
      try {
        const result = await this.deployToChain(chainKey, config)
        this.deploymentResults.push(result)
        
        if (result.success) {
          console.log(`✅ ${config.name} deployment successful!`)
          console.log(`🔗 Transaction: ${result.explorerLink}`)
        } else {
          console.log(`❌ ${config.name} deployment failed: ${result.error}`)
        }
      } catch (error: any) {
        console.log(`❌ ${config.name} deployment failed: ${error.message}`)
        this.deploymentResults.push({
          chainName: config.name,
          success: false,
          error: error.message,
          unifiedAddress: this.eoaAccount.address,
          recipient: config.recipient ?? '',
          relayer: this.relayerAccount.address,
          usdcAddress: config.usdcAddress
        })
      }
      await this.sleep(2000)
    }
    await this.deploymentstat()
    return this.deploymentResults
  }

  private async deployToChain(chainKey: string, config: any): Promise<DeploymentResult> {
    const walletClient = createWalletClient({
      account: this.relayerAccount,
      chain: config.chain,
      transport: http(config.rpcUrl),
    })

    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    })

    console.log(` Generating authorization...`)
    
    // Generate authorization
    const authorization = await walletClient.signAuthorization({
      account: this.eoaAccount,
      contractAddress: config.logicContractAddress,
    })
    console.log(`Sending initialization transaction...`)
    const hash = await walletClient.writeContract({
  account: this.relayerAccount,
  chain: config.chain,
  abi,
  address: this.eoaAccount.address,
  authorizationList: [authorization],
  functionName: 'initialize',
  args: [config.recipient, this.relayerAccount.address, config.usdcAddress],
})

    console.log(`  ⏳ Waiting for confirmation...`)
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    if (receipt.status !== 'success') {
      throw new Error(`Transaction failed with status: ${receipt.status}`)
    }
    const isInitialized = await publicClient.readContract({
      address: this.eoaAccount.address,
      abi,
      functionName: 'isInitialized'
    })
    if (!isInitialized) {
      throw new Error('Contract initialization verification failed')
    }

    return {
      chainName: config.name,
      success: true,
      txHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      unifiedAddress: this.eoaAccount.address,
      recipient: config.recipient,
      relayer: this.relayerAccount.address,
      usdcAddress: config.usdcAddress,
      explorerLink: `${config.explorerUrl}/tx/${hash}`
    }
  }

  private async deploymentstat() {
    const timestamp = new Date().toISOString()
    const successfulDeployments = this.deploymentResults.filter(r => r.success)
    const failedDeployments = this.deploymentResults.filter(r => !r.success)




    console.log('\n' + '='.repeat(60))
    console.log('📊 DEPLOYMENT SUMMARY')
    console.log('='.repeat(60))
    console.log(`📍 Unified Address: ${this.eoaAccount.address}`)
    console.log(`🔧 Relayer Address: ${this.relayerAccount.address}`)
    console.log(`✅ Successful: ${successfulDeployments.length}/${this.deploymentResults.length}`)
    console.log(`❌ Failed: ${failedDeployments.length}/${this.deploymentResults.length}`)

    if (successfulDeployments.length > 0) {
      console.log('\n🎉 SUCCESSFUL DEPLOYMENTS:')
      successfulDeployments.forEach(result => {
        console.log(`  ✅ ${result.chainName}`)
        console.log(`     🔗 ${result.explorerLink}`)
        console.log(`     ⛽ Gas Used: ${result.gasUsed?.toLocaleString()}`)
      })
    }

    if (failedDeployments.length > 0) {
      console.log('\n❌ FAILED DEPLOYMENTS:')
      failedDeployments.forEach(result => {
        console.log(`  ❌ ${result.chainName}: ${result.error}`)
      })
    }

    console.log(`\n📄 Full report saved to: deployment-report.json`)
  }

  async verifyDeployments() {
    console.log('\n🔍 Verifying all deployments...')
    
    for (const result of this.deploymentResults.filter(r => r.success)) {
      const config = Object.values(DEPLOYMENT_CONFIG).find(c => c.name === result.chainName)
      if (!config) continue

      try {
        const publicClient = createPublicClient({
          chain: config.chain,
          transport: http(config.rpcUrl),
        })

        console.log(`\n📋 ${result.chainName}:`)
        
        const recipient = await publicClient.readContract({
          address: this.eoaAccount.address,
          abi,
          functionName: 'getRecipient'
        })
        
        const relayer = await publicClient.readContract({
          address: this.eoaAccount.address,
          abi,
          functionName: 'getRelayer'
        })
        
        const usdcAddress = await publicClient.readContract({
          address: this.eoaAccount.address,
          abi,
          functionName: 'getUSDC'
        })

        const balance = await publicClient.readContract({
          address: this.eoaAccount.address,
          abi,
          functionName: 'getUSDCBalance'
        })

        console.log(`  ✅ Contract Address: ${this.eoaAccount.address}`)
        console.log(`  👤 Recipient: ${recipient}`)
        console.log(`  🔧 Relayer: ${relayer}`)
        console.log(`  💰 USDC Contract: ${usdcAddress}`)
        console.log(`  💵 Current Balance: ${balance} USDC`)

      } catch (error) {
        console.log(`  ❌ Verification failed: ${error}`)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Main execution
async function main() {
  const deployer = new MultiChainDeployer()
  
  console.log('Unified Deposit Deployment')
  console.log('==========================================\n')
  
  const results = await deployer.deployToAllChains()
  await deployer.verifyDeployments()
  
  const successCount = results.filter(r => r.success).length
  const totalCount = results.length
  
  console.log(`\n🏁 Deployment complete: ${successCount}/${totalCount} successful`)
  
  if (successCount === totalCount) {
    console.log('🎉 All deployments successful! Ready to start monitoring service.')
  } else {
    console.log('⚠️  Some deployments failed. Check the report for details.')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { MultiChainDeployer }