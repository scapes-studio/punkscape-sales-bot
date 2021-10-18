import 'dotenv/config';
import fs from 'fs';
import fetch from 'node-fetch';
import { ethers } from 'ethers';
import shortAddress from './helpers/short-address';

async function main(): Promise<Array<{ seller: any, buyer: any, price: string, usdPrice: string }>> {
  const LIMIT = 100
  const params = new URLSearchParams({
    event_type: 'successful',
    only_opensea: 'false',
    collection_slug: process.env.COLLECTION_SLUG!,
    asset_contract_address: process.env.CONTRACT_ADDRESS!,
    limit: LIMIT.toString(),
    offset: '0',
  })

  try {
    const sales = []
    let lastSalesCount = null
    let page = 0

    while (lastSalesCount === null || lastSalesCount === LIMIT) {
      page++
      params.set('offset', ((page - 1) * LIMIT).toString())

      const openSeaResponse = await fetch(
        "https://api.opensea.io/api/v1/events?" + params).then((resp) => resp.json());

      const result = await openSeaResponse?.asset_events
      lastSalesCount = result.length

      console.log(page, lastSalesCount)

      result?.map((sale: any) => {
        const seller = {
          address: sale?.seller?.address,
          name: sale?.seller?.user?.username || shortAddress(sale?.seller?.address),
        }
        const buyer = {
          address: sale?.winner_account?.address,
          name: sale?.winner_account?.user?.username || shortAddress(sale?.winner_account?.address)
        }
        const price = ethers.utils.formatEther(sale.total_price || '0')
        const usdPrice = (parseFloat(price) * parseFloat(sale?.payment_token?.usd_price || 3200))
          .toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})

        sales.unshift({
          tokenId: sale?.asset?.token_id,
          timestamp: sale?.created_date,
          seller,
          buyer,
          price,
          usdPrice,
        })
      })
    }

    fs.writeFileSync('sales.json', JSON.stringify(sales, undefined, 4))

    return sales
  } catch (e) {
    console.log(e)
  }
}

main()
  .then((sales) => {
    if (!sales.length) console.log("No recent sales")
    else console.log(`${sales.length} recent sales`)
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
