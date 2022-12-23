import 'dotenv/config'
import watchSales from './tasks/watch-sales'
import { discordSetup } from './helpers/discord'
import { delay } from './helpers/time'
import fetch from 'node-fetch'

const init = async () => {
  await discordSetup()

  watchSales({
    contract: [ process.env.ONEDAYPUNKS_CONTRACT_ADDRESS ],
    name: 'One Day Punk',
    from: process.env.START_ODP,
    discord: {
      title: config => `Welcome One Day Punk #${config.ID}`,
      thumbnail: config => `https://api.punkscape.xyz/onedaypunks/${config.ID}/profile.png`,
      color: '#ffffff',
      fields: config => [
        { name: 'Punk', value: `[${config.buyer}](https://scapes.xyz/people/${config.sale.to})`, inline: true },
        { name: 'Price', value: config.priceString, inline: true },
      ],
    },
    url: config => `https://punkscape.xyz/onedaypunks/${config.ID}`,
  })

  await delay(10 * 1000) // wait 10 seconds
  watchSales({
    contract: [ process.env.TWENTYSEVENYEAR_SCAPES_CONTRACT_ADDRESS ],
    name: 'Twenty Seven Year Scape',
    from: process.env.START_27YSCAPES,
    discord: {
      fields: config => [
        { name: 'Scapoor', value: `[${config.buyer}](https://gallery27.scapes.xyz/accounts/${config.sale.to})`, inline: true },
        { name: 'Price', value: config.priceString, inline: true },
      ],
      image: async config => {
        const response = await fetch(`https://api.punkscape.xyz/gallery27/scapes/${config.ID}`)
        const scape = await response.json()

        return scape.imageRequest?.image?.image_url
      },
    },
    url: config => `https://gallery27.scapes.xyz/${config.ID}`,
    tweet: config =>
      `Twenty Seven Year Scape #${config.ID} was bought by ${config.buyer} for ${config.priceString}. \n\nhttps://gallery27.scapes.xyz/${config.ID}`,
  })
}

init()
