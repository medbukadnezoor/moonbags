import dns from "dns";

/**
 * IPv4-preferred fetch wrapper.
 *
 * GMGN has rejected IPv6 paths in some environments. Do not rewrite the URL to
 * a raw IPv4 address: Cloudflare-hosted endpoints need the original hostname
 * for TLS/SNI, and a Host header alone is not enough for Node fetch.
 */
export async function ipv4Fetch(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  dns.setDefaultResultOrder("ipv4first");
  return fetch(url, init);
}
