import 'dotenv/config'
import { Client, MessageEmbed, TextChannel } from 'discord.js'
import fetch from 'node-fetch'
import { ethers } from 'ethers'
import shortAddress from './helpers/short-address'
import { delay } from './helpers/time'
import SCAPE_DATA from './provenance-metadata.json'
import { sendTweet } from './helpers/twitter'

const BLACKLIST = [
  '0x83F05c2F9b6D309c652C50799d16Db51542E05f1',
  '0x1259a5c3d6a30a18ee1e04daa2c6e43d4c442632',
]

const discordBot = new Client({
  intents: [],
})
const discordSetup = async (): Promise<TextChannel[]> => {
  return new Promise<TextChannel[]>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })

    discordBot.once('ready', async () => {
      const salesChannel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!)
      const listingsChannel = await discordBot.channels.fetch(process.env.DISCORD_LISTINGS_CHANNEL_ID!)

      resolve([salesChannel as TextChannel, listingsChannel as TextChannel])
    })

    discordBot.login(process.env.DISCORD_BOT_TOKEN)
  })
}

async function fetchLastEvents(queryParams, after) {
  const params = new URLSearchParams({
    // event_type: 'successful',
    only_opensea: 'false',
    limit: '100',
    collection_slug: process.env.COLLECTION_SLUG!,
    asset_contract_address: process.env.CONTRACT_ADDRESS!,
    ...queryParams,
    cursor: '',
  })

  let asset_events = []
  let loadMore = true

  while (loadMore) {
    console.log(`https://api.opensea.io/api/v1/events?${params}`)
    const response = await fetch(`https://api.opensea.io/api/v1/events?${params}`, {
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY,
      },
    })

    if (response.status !== 200) {
      console.error(`OpenSea responded with ${response.status}`, response.statusText)
      loadMore = false
    }

    try {
      const data = await response.json()

      const events = data?.asset_events.filter(e => {
        return e.asset?.token_id && new Date(e.created_date) > after
      })
      asset_events = asset_events.concat(events)

      const hasMore = data?.asset_events.length === events.length
      if (hasMore) {
        console.log(`Next page: ${data.next}`)
        params.set('cursor', data.next)
        await delay(500)
      } else {
        loadMore = false
      }
    } catch (e) {
      console.error(e)
    }
  }

  return asset_events.reverse()
}

const EVENTS = {
  successful: {
    channel: null,
    message: async (sale: any) => {
      const buyer = sale?.winner_account?.user?.username || shortAddress(sale?.winner_account?.address)
      const price = ethers.utils.formatEther(sale.total_price || '0')
      const usdPrice = (parseFloat(price) * parseFloat(sale?.payment_token?.usd_price || 3200))
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      const priceString = `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)`
      const date = SCAPE_DATA[sale.asset.token_id].date

      // Tweet
      sendTweet(`${sale.asset.name} was just bought by ${buyer} for ${priceString}. \n\nIts Gallery 27 date is ${date}\n\nhttps://punkscape.xyz/scapes/${sale.asset.token_id}`)

      // DiscordMessage
      const discordMessage = new MessageEmbed()
          .setColor('#eeeeee')
          .setTitle(sale.asset.name + ' has a new owner')
          .setURL(sale.asset.permalink)
          .addFields(
            { name: 'Scapoor', value: `[${buyer}](https://opensea.io/${sale?.winner_account?.address})`, inline: true },
            { name: 'Price', value: priceString, inline: true },
            { name: 'Gallery 27 Date', value: `[${date}](https://punkscape.xyz/gallery27/punkscape/${sale.asset.token_id})`, inline: true },
          )
          .setImage(sale.asset.image_url)

      try {
        console.log('sending successful sale discord message')
        await EVENTS.successful.channel.send({ embeds: [discordMessage] })
      } catch (e) {
        console.error(e)
      }
    },
  },
  created: {
    channel: null,
    message: (listing: any) => {
      if (BLACKLIST.includes(listing?.seller?.address)) {
        console.log('blacklisted')
        return
      }
      const price = ethers.utils.formatEther(listing.starting_price || '0')
      const usdPrice = (parseFloat(price) * parseFloat(listing?.payment_token?.usd_price || 3200))
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      const discordMessage = new MessageEmbed()
          .setColor('#eeeeee')
          .setTitle(`${listing.asset.name} was listed for ${price}${ethers.constants.EtherSymbol}`)
          .setURL(listing.asset.permalink)
          .addFields(
            { name: 'Price', value: `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)`, inline: true },
            { name: 'Gallery 27 Date', value: `[${SCAPE_DATA[listing.asset.token_id].date}](https://punkscape.xyz/gallery27/punkscape/${listing.asset.token_id})`, inline: true },
            { name: 'Links', value: `[Official](https://punkscape.xyz/scapes/${listing.asset.token_id})`, inline: true },
          )
          .setImage(listing.asset.image_url)

      EVENTS.created.channel.send({ embeds: [discordMessage] })
    },
  }
}

const watchEvents = async (type) => {
  let after = new Date((parseInt(process.env.BEFORE) * 1000) || Date.now())

  while (true) {
    console.info(`Waiting ${process.env.SECONDS}s until next call`)
    await delay(parseInt(process.env.SECONDS! || '60') * 1000)

    let events = await fetchLastEvents({
      event_type: type,
    }, after)

    if (!events.length) {
      console.info(`No new events`)
      continue
    }

    console.info(`${events.length} new events`)

    after = new Date(events[events.length - 1].created_date)
    console.info(`Latest event: ${events[0].created_date}`, after, events[0].asset.token_id)

    await Promise.all(
      events?.map(async (event: any) => {
        console.log('event ', event.asset.token_id, event.event_type)
        await EVENTS[event.event_type]?.message(event)
      })
    )
  }
}

async function main() {
  const [salesChannel, listingsChannel] = await discordSetup()
  EVENTS.successful.channel = salesChannel
  EVENTS.created.channel = listingsChannel

  watchEvents('successful')
  await delay(parseInt(process.env.SECONDS! || '60') / 2 * 1000)
  watchEvents('created')
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
