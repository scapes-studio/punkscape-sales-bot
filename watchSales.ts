import 'dotenv/config'
import Discord, { TextChannel } from 'discord.js'
import fetch from 'node-fetch'
import { ethers } from 'ethers'
import shortAddress from './helpers/short-address'
import { delay } from './helpers/time'
import SCAPE_DATA from './provenance-metadata.json'
import { sendTweet } from './helpers/twitter'

const discordBot = new Discord.Client()
const discordSetup = async (): Promise<TextChannel[]> => {
  return new Promise<TextChannel[]>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })

    discordBot.login(process.env.DISCORD_BOT_TOKEN)
    discordBot.on('ready', async () => {
      const salesChannel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!)
      const listingsChannel = await discordBot.channels.fetch(process.env.DISCORD_LISTINGS_CHANNEL_ID!)

      resolve([salesChannel as TextChannel, listingsChannel as TextChannel])
    })
    // discordBot.on('debug', async (e) => console.log(e))
  })
}

async function fetchLastEvents(queryParams) {
  const params = new URLSearchParams({
    offset: '0',
    // event_type: 'successful',
    only_opensea: 'false',
    limit: '30',
    collection_slug: process.env.COLLECTION_SLUG!,
    asset_contract_address: process.env.CONTRACT_ADDRESS!,
    ...queryParams,
  })

  const response = await fetch(`https://api.opensea.io/api/v1/events?${params}`, {
    headers: {
      'X-API-KEY': process.env.OPENSEA_API_KEY,
    },
  })

  if (response.status !== 200) {
    console.error(`OpenSea responded with ${response.status}`, response.statusText)
    return []
  }

  try {
    const data = await response.json()

    return data?.asset_events
  } catch (e) {
    console.error(`Fault JSON response...`)
  }

  return []
}

const EVENTS = {
  successful: {
    channel: null,
    message: (sale: any) => {
      const buyer = sale?.winner_account?.user?.username || shortAddress(sale?.winner_account?.address)
      const price = ethers.utils.formatEther(sale.total_price || '0')
      const usdPrice = (parseFloat(price) * parseFloat(sale?.payment_token?.usd_price || 3200))
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      const priceString = `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)`

      // Tweet
      sendTweet(`${sale.asset.name} was just bought by ${buyer} for ${priceString} \n\nhttps://punkscape.xyz/scapes/${sale.asset.token_id}`)

      // // DiscordMessage
      // const discordMessage = new Discord.MessageEmbed()
      //     .setColor('#eeeeee')
      //     .setTitle(sale.asset.name + ' has a new owner')
      //     .setURL(sale.asset.permalink)
      //     .addFields(
      //       { name: 'Scapoor', value: `[${buyer}](https://opensea.io/${sale?.winner_account?.address})`, inline: true },
      //       { name: 'Price', value: priceString, inline: true },
      //       { name: 'Gallery 27 Date', value: SCAPE_DATA[sale.asset.token_id].date, inline: true },
      //     )
      //     .setImage(sale.asset.image_url)

      // EVENTS.successful.channel.send(discordMessage)
    },
  },
  created: {
    channel: null,
    message: (listing: any) => {
      const price = ethers.utils.formatEther(listing.starting_price || '0')
      const usdPrice = (parseFloat(price) * parseFloat(listing?.payment_token?.usd_price || 3200))
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      // const discordMessage = new Discord.MessageEmbed()
      //     .setColor('#eeeeee')
      //     .setTitle(`${listing.asset.name} was listed for ${price}${ethers.constants.EtherSymbol}`)
      //     .setURL(listing.asset.permalink)
      //     .addFields(
      //       { name: 'Price', value: `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)`, inline: true },
      //       { name: 'Gallery 27 Date', value: SCAPE_DATA[listing.asset.token_id].date, inline: true },
      //     )
      //     .setImage(listing.asset.image_url)

      // EVENTS.created.channel.send(discordMessage)
    },
  }
}

async function main() {
  const [salesChannel, listingsChannel] = await discordSetup()
  EVENTS.successful.channel = salesChannel
  EVENTS.created.channel = listingsChannel

  const occurred_before = process.env.BEFORE || (Date.now() / 1000 - 20)
  let lastEvent = (await fetchLastEvents({
    limit: '1',
    occurred_before,
  }))[0]
  let afterLastEvent = Date.parse(`${lastEvent?.created_date}Z`) / 1000 + 1 // +1 second

  while (true) {
    console.info(`Waiting ${process.env.SECONDS}s until next call`)
    await delay(parseInt(process.env.SECONDS! || '60') * 1000)

    let eventsSince = await fetchLastEvents({ occurred_after: afterLastEvent.toString() })

    if (!eventsSince.length) {
      console.info(`No events since ${afterLastEvent || occurred_before}`)
      continue
    }

    lastEvent = eventsSince[0]
    afterLastEvent = Date.parse(`${lastEvent?.created_date}Z`) / 1000 + 1
    console.info(`New events: #${lastEvent.asset.token_id} - ${eventsSince.length} fetched in total`)

    await Promise.all(
      eventsSince?.reverse().map(async (event: any) => {
        EVENTS[event.event_type]?.message(event)
      })
    )
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
