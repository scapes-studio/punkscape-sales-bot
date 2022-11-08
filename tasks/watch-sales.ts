import { MessageEmbed, TextChannel } from 'discord.js'
import sdk from './../helpers/api'
import { paths } from '@reservoir0x/reservoir-kit-client'
import shortAddress from '../helpers/short-address'
import SCAPE_DATA from './../provenance-metadata.json'
import { CHANNELS } from '../helpers/discord'
import { sendTweet } from '../helpers/twitter'
import { delay, now } from '../helpers/time'

type Sale = paths['/sales/v4']['get']['responses']['200']['schema']['sales'][0]
type SaleWatcherDefinition = {
  contract: string;
  name: string;
  from?: string;
}

const watchSales = async (config: SaleWatcherDefinition) => {
  let since = config.from || now().toString()
  try {
    while (true) {
      const currentTime = now()
      const sales = await fetchSales(config.contract, since, (currentTime - 1).toString())
      console.log(`Found ${sales.length} new sales events since ${since}`)
      for (const sale of sales) {
        await reportSale(sale)
      }
      since = currentTime.toString()
      await delay(60 * 1000) // Wait for one minute
    }
  } catch (e) {
    console.log(e)
  }
}

const fetchSales = async (contract: string, from: string, to: string) => {
  try {
    const { data } = await sdk.getSalesV4({
      contract: contract,
      startTimestamp: from,
      endTimestamp: to,
      limit: '1000',
      accept: '*/*'
    })
    const response = data as paths['/sales/v4']['get']['responses']['200']['schema']
    return response.sales
  } catch (e) {
    console.log(e)
  }
}

export const reportSale = async (sale: Sale) => {
  const buyer = shortAddress(sale.to)
  const price = sale.price.amount.native
  const usdPrice = sale.price.amount.usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const priceString = `${price} ${sale.price.currency.name} ($${usdPrice} USD)`

  const ID = sale.token.tokenId
  const date = SCAPE_DATA[ID].date

  // Tweet
  sendTweet(`Scape #${sale.token.tokenId} was just bought by ${buyer} for ${priceString}. \n\nIts Gallery 27 date is ${date}\n\nhttps://punkscape.xyz/scapes/${ID}`)

  // DiscordMessage
  const discordMessage = new MessageEmbed()
      .setColor('#eeeeee')
      .setTitle(`Scape #${sale.token.tokenId} has a new owner`)
      .setURL(`https://punkscape.xyz/scapes/${ID}`)
      .addFields(
        { name: 'Scapoor', value: `[${buyer}](https://punkscape.xyz/accounts/${sale.from})`, inline: true },
        { name: 'Price', value: priceString, inline: true },
        { name: 'Gallery 27 Date', value: `[${date}](https://punkscape.xyz/gallery27/punkscape/${ID})`, inline: true },
      )
      .setImage(`https://ipfs.punkscape.xyz/ipfs/QmaADSyXfiNhTqLKtRYxvGB4qJ7ZAR375Yh48SiCmcVYYE/${ID}/image.png`)

  try {
    console.log('Sending sale discord message')
    await CHANNELS.sales.send({ embeds: [discordMessage] })
  } catch (e) {
    console.error(e)
  }
}


export default watchSales
