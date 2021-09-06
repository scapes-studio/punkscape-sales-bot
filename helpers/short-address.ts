const shortAddress = (address: string): string => (
    address.substr(0, 6) +
    '...' +
    address.substr(address.length - 4, 4)
)

export default shortAddress
