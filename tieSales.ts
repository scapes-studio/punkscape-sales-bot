import fs from 'fs'

type Sale = {
  tokenId: string,
  price: string,
  buyer: {
    name: string,
    address: string,
  },
  seller: {
    name: string,
    address: string,
  },
  usdPrice: string,
}

const main = async () => {
  const sales: Sale[] = JSON.parse(fs.readFileSync('sales.json').toString());
  const ties = JSON.parse(fs.readFileSync('BOW-SHIPS.json').toString())
    .map(t => parseInt(t.name.replace('PunkScape #', '')))
    .filter(t => !!t)

  const tieSales = sales.filter(sale => ties.includes(parseInt(sale.tokenId)))

  fs.writeFileSync('tieSales.json', JSON.stringify(tieSales, null, 4))
}

main()
