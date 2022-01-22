import { TwitterApi } from 'twitter-api-v2'
import Env from './Environment'

// Instanciate with desired auth type (here's Bearer v2 auth)
const client = new TwitterApi({
  appKey: process.env.TWITTER_KEY,
  appSecret: process.env.TWITTER_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
})
// const client = new TwitterApi(process.env.TWITTER_BEARER)
// const writeClient = twitterClient.readWrite

export const uploadMedia = async (url) => {
  try {
    return await client.v1.uploadMedia(url, {
      target: 'tweet',
      shared: true,
    });
  } catch (e) {
    console.error(e)
  }
}

export const sendTweet = async (tweet = 'Hello Twitter!', params = {}) => {
  if (Env.isDevelopment()) {
    console.info('Send Tweet', tweet, params)
    return
  }

  try {
    await client.v1.tweet(tweet, params)
  } catch (e) {
    console.error(e)
  }
}
