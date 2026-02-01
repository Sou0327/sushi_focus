/**
 * Focus management logic utilities.
 * Extracted from background/index.ts for testability.
 */

/**
 * Checks if a hostname matches any domain in the distraction list.
 * Matches both exact domains and subdomains.
 *
 * @param hostname - The hostname to check (e.g., 'www.youtube.com')
 * @param distractionDomains - List of distraction domains (e.g., ['youtube.com', 'twitter.com'])
 * @returns true if the hostname is on a distraction domain
 *
 * @example
 * isHostOnDistractionDomain('youtube.com', ['youtube.com']) // true
 * isHostOnDistractionDomain('www.youtube.com', ['youtube.com']) // true
 * isHostOnDistractionDomain('google.com', ['youtube.com']) // false
 */
export function isHostOnDistractionDomain(
  hostname: string,
  distractionDomains: string[]
): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return distractionDomains.some((domain) => {
    const normalizedDomain = domain.toLowerCase();
    return (
      normalizedHostname === normalizedDomain ||
      normalizedHostname.endsWith('.' + normalizedDomain)
    );
  });
}
