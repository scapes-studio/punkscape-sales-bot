import { ColorResolvable, EmbedFieldData, MessageEmbed, TextChannel } from 'discord.js'
import sdk from './../helpers/api'
import { paths } from '@reservoir0x/reservoir-kit-client'
import shortAddress from '../helpers/short-address'
import { CHANNELS } from '../helpers/discord'
import { sendTweet } from '../helpers/twitter'
import { delay, now } from '../helpers/time'

type Sale = paths['/sales/v4']['get']['responses']['200']['schema']['sales'][0]
type CustomSale = {
  ID: string,
  priceString: string;
  buyer: string;
  sale: Sale;
}
type SaleWatcherDefinition = {
  contract: string[];
  name: string;
  from?: string;
  tweet?: (config: CustomSale) => string;
  discord?: {
    color?: ColorResolvable;
    title?: (config: CustomSale) => string;
    fields?: (config: CustomSale) => EmbedFieldData[];
    image?: (config: CustomSale) => Promise<string>;
    thumbnail?: (config: CustomSale) => string;
  }
  url?: (config: CustomSale) => string;
  imageURL?: (config: CustomSale) => Promise<string>;
}

const watchSales = async (config: SaleWatcherDefinition) => {
  let since = config.from || now().toString()
  try {
    while (true) {
      const currentTime = now()
      const sales = await fetchSales(config.contract, since, (currentTime - 1).toString())
      console.log(`Found ${sales.length} new sales events since ${since}`)
      for (const sale of sales) {
        await reportSale(sale, config)
      }
      since = currentTime.toString()
      await delay(60 * 1000) // Wait for one minute
    }
  } catch (e) {
    console.log(e)
  }
}

const fetchSales = async (contract: string[], from: string, to: string) => {
  try {
    const { data } = await sdk.getSalesV4({
      contract,
      startTimestamp: from,
      endTimestamp: to,
      limit: '1000',
      accept: '*/*'
    })
    const response = data as paths['/sales/v4']['get']['responses']['200']['schema']
    return response.sales.reverse()
  } catch (e) {
    console.log(e)
  }
}

export const reportSale = async (sale: Sale, config: SaleWatcherDefinition) => {
  const buyer = shortAddress(sale.to)
  const price = sale.price.amount.native
  const usdPrice = sale.price.amount.usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const priceString = `${price} ${sale.price.currency.name} ($${usdPrice} USD)`

  const ID = sale.token.tokenId
  const saleData: CustomSale = { ID, buyer, priceString, sale }

  // Tweet
  if (config.tweet) {
    sendTweet(config.tweet(saleData))
  }

  // DiscordMessage
  const title = typeof config.discord?.title === 'function'
    ? config.discord?.title(saleData)
    : `${config.name} #${sale.token.tokenId} has a new owner`
  const color = config.discord?.color || '#eeeeee'

  const discordMessage = new MessageEmbed()
  discordMessage.setColor(color)
  discordMessage.setTitle(title)
  discordMessage.setURL(config.url(saleData))

  if (config.discord?.image) discordMessage.setImage(await config.discord.image(saleData))
  if (config.discord?.thumbnail) discordMessage.setThumbnail(config.discord.thumbnail(saleData))
  if (config.discord?.fields) discordMessage.addFields(...config.discord.fields(saleData))

  try {
    console.log('Sending sale discord message')
    await CHANNELS.sales.send({ embeds: [discordMessage] })
  } catch (e) {
    console.error(e)
  }
}


export default watchSales
