import 'dotenv/config'
import watchSales from './tasks/watch-sales'
import { discordSetup } from './helpers/discord'

const init = async () => {
  await discordSetup()

  watchSales({
    contract: process.env.PUNKSCAPES_CONTRACT_ADDRESS,
    name: 'Scape',
    from: process.env.START,
  })
}

init()
