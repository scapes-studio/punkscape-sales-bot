import openapi from 'api'

const sdk = openapi('@reservoirprotocol/v1.0#pxy1ula7n39mc')
sdk.auth(process.env.RESERVOIR_API_KEY!)

export default sdk
