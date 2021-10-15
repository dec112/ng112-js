/**
 * @experimental
 */
export interface HttpAdapter {
  /**
   * @experimental
   * 
   * Adapter function for issuing a HTTP-GET request
   * 
   * Errors during execution are directly handed to the consumer of the ng112-js SDK
   * 
   * @param url URL the call shall be issued to
   * @returns a JSON object or undefined
   */
  get: (url: string) => Promise<any | undefined>;
  /**
   * @experimental
   * 
   * Adapter function for issuing a HTTP-POST request
   * 
   * Errors during execution are directly handed to the consumer of the ng112-js SDK
   * 
   * @param url URL the call shall be issued to
   * @param body POST body as JSON object
   * @returns a JSON object or undefined
   */
  post: (url: string, body: any) => Promise<any | undefined>;
}