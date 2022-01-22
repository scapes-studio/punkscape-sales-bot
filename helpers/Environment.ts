export default class Env {
  static isProduction (): boolean {
    return process.env.ENVIRONMENT === 'production'
  }

  static isDevelopment (): boolean {
    return process.env.ENVIRONMENT !== 'production'
  }
}
