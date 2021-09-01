import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';

const discordBot = new Discord.Client();
const  discordSetup = async (): Promise<TextChannel> => {
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

const shortAddress = address => (
  address.substr(0, 6) +
  '...' +
  address.substr(address.length - 4, 4)
)

const buildMessage = (sale: any) => {
  const seller = sale?.seller?.user?.username || shortAddress(sale?.seller?.address)
  const buyer = sale?.winner_account?.user?.username || shortAddress(sale?.winner_account?.address)
  const price = ethers.utils.formatEther(sale.total_price || '0')
  const usdPrice = (parseFloat(price) * parseFloat(sale?.payment_token?.usd_price || 3200))
    .toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})

  return new Discord.MessageEmbed()
      .setColor('#F2C536')
      .setTitle(sale.asset.name + ' sold!')
      .setURL(sale.asset.permalink)
      .addFields(
        { name: 'Amount', value: `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)` },
        { name: 'Buyer', value: `[${buyer}](https://opensea.io/${sale?.winner_account?.address})`, },
        { name: 'Seller', value: `[${seller}](https://opensea.io/${sale?.seller?.address})`,  },
      )
      .setImage(sale.asset.image_url)
      .setTimestamp(Date.parse(`${sale?.created_date}Z`))
      .setFooter('Sold on OpenSea')
}

async function main() {
  const channel = await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  
  const params = new URLSearchParams({
    offset: '0',
    event_type: 'successful',
    only_opensea: 'false',
    occurred_after: hoursAgo.toString(), 
    collection_slug: process.env.COLLECTION_SLUG!,
  })

  if (process.env.CONTRACT_ADDRESS !== OPENSEA_SHARED_STOREFRONT_ADDRESS) {
    params.append('asset_contract_address', process.env.CONTRACT_ADDRESS!)
  }

  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + params).then((resp) => resp.json());
    
  return await Promise.all(
    openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
      const message = buildMessage(sale);
      return channel.send(message)
    })
  );   
}

main()
  .then((res) =>{ 
    if (!res.length) console.log("No recent sales")
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
