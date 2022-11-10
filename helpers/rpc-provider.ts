import { ethers } from 'ethers'

export default new ethers.providers.StaticJsonRpcProvider(process.env.RPC_PROVIDER)
