import fs from 'fs'
import { ethers } from 'ethers'

const main = async () => {
  const sales = JSON.parse(fs.readFileSync('sales.json').toString());

  // Find highest sales
  const highestSales = sales
    .sort((a, b) => ethers.utils.parseEther(a.price).gt(ethers.utils.parseEther(b.price)) ? -1 : 1)
    .slice(0, 20)

  const data = {
    totalAmount: ethers.utils.formatEther(
      highestSales.reduce(
        (accum, curr) => accum.add(ethers.utils.parseEther(curr.price)), ethers.utils.parseEther('0')
      )
    ),
    buyers: highestSales.map(({ tokenId, buyer, price, usdPrice }) => ({
      tokenId,
      buyer: buyer.name.startsWith('0x') ? buyer.address : buyer.name,
      openSea: `https://opensea.io/assets/0x5537d90a4a2dc9d9b37bab49b490cf67d4c54e91/${tokenId}`,
      price: `${price} ${ethers.constants.EtherSymbol} ($${usdPrice} USD)`
    })),
    sales: highestSales,
  }

  fs.writeFileSync('salesLeaderBoard.json', JSON.stringify(data, undefined, 4))
}

main()
