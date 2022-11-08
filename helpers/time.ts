export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export const now = () => Math.floor(Date.now() / 1000)
