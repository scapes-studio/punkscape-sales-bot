import { Client, MessageEmbed, TextChannel } from 'discord.js'

const discordBot = new Client({
  intents: [],
})

export const CHANNELS: {
  sales: TextChannel,
  listings: TextChannel,
} = {
  sales: null,
  listings: null
}

export const discordSetup = async (): Promise<TextChannel[]> =>
  new Promise<TextChannel[]>(async (resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })

    discordBot.once('ready', async () => {
      const salesChannel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!)
      // const listingsChannel = await discordBot.channels.fetch(process.env.DISCORD_LISTINGS_CHANNEL_ID!)

      CHANNELS.sales = salesChannel as TextChannel
      // CHANNELS.listings = listingsChannel as TextChannel

      resolve([
        salesChannel as TextChannel,
        // listingsChannel as TextChannel
      ])
    })

    discordBot.login(process.env.DISCORD_BOT_TOKEN)
  })
