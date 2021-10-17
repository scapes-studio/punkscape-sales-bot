import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from 'ethers';
import shortAddress from './helpers/short-address';
import { delay } from './helpers/time';

const discordBot = new Discord.Client();
const discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })

    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
      resolve(channel as TextChannel);
    });
  })
}

const buildMessage = (sale: any) => {
  const buyer = sale?.winner_account?.user?.username || shortAddress(sale?.winner_account?.address)
  const price = ethers.utils.formatEther(sale.total_price || '0')
  const usdPrice = (parseFloat(price) * parseFloat(sale?.payment_token?.usd_price || 3200))
    .toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})

  return new Discord.MessageEmbed()
      .setColor('#eeeeee')
      .setTitle(sale.asset.name + ' has a new owner')
      .setURL(sale.asset.permalink)
      .addFields(
        { name: 'Scaper', value: `[${buyer}](https://opensea.io/${sale?.winner_account?.address})`, inline: true },
        { name: 'Price', value: `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)`, inline: true },
      )
      .setImage(sale.asset.image_url)
}

async function fetchLastSales(queryParams) {
  const params = new URLSearchParams({
    offset: '0',
    event_type: 'successful',
    only_opensea: 'false',
    limit: '30',
    collection_slug: process.env.COLLECTION_SLUG!,
    asset_contract_address: process.env.CONTRACT_ADDRESS!,
    ...queryParams,
  })

  const openSeaResponse = await (await fetch(`https://api.opensea.io/api/v1/events?${params}`)).json()

  return openSeaResponse?.asset_events
}

async function main() {
  const channel = await discordSetup();
  let lastSale = (await fetchLastSales({
    limit: '1',
    occurred_before: process.env.BEFORE || (Date.now() / 1000 - 20),
  }))[0]
  let afterLastSale = Date.parse(`${lastSale?.transaction.timestamp}Z`) / 1000 + 1 // +1 second

  while (true) {
    let salesSince = await fetchLastSales({ occurred_after: afterLastSale.toString() })

    console.info(`Waiting ${process.env.SECONDS}s until next call`)
    await delay(parseInt(process.env.SECONDS! || '60') * 1000)

    if (!salesSince.length) {
      console.info(`No last sales since ${afterLastSale}`)
      continue
    }

    lastSale = salesSince[0]
    afterLastSale = Date.parse(`${lastSale?.transaction.timestamp}Z`) / 1000 + 1
    console.info(`New last sale: #${lastSale.asset.token_id} - ${salesSince.length} fetched in total`)

    await Promise.all(
      salesSince?.reverse().map(async (sale: any) => {
        const message = buildMessage(sale);
        if (! message) return
        return channel.send(message)
      }),
    );
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
