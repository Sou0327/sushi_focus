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

/**
 * Result of cooldown check for auto-focus on done.
 */
export interface CooldownCheckResult {
  shouldFocus: boolean;
  reason: 'distraction' | 'always_focus' | 'cooldown_expired' | 'in_cooldown';
}

/**
 * Determines if auto-focus should be triggered on task done.
 *
 * Priority:
 * 1. Distraction site → always focus
 * 2. alwaysFocusOnDone → always focus
 * 3. Check cooldown period
 *
 * @param isOnDistraction - Whether user is on a distraction site
 * @param alwaysFocusOnDone - Whether alwaysFocusOnDone setting is enabled
 * @param lastDoneFocusTime - Timestamp of last focus trigger
 * @param cooldownMs - Cooldown period in milliseconds
 * @param now - Current timestamp (default: Date.now())
 * @returns Result with shouldFocus flag and reason
 */
export function shouldTriggerFocus(
  isOnDistraction: boolean,
  alwaysFocusOnDone: boolean,
  lastDoneFocusTime: number,
  cooldownMs: number,
  now: number = Date.now()
): CooldownCheckResult {
  // Always focus if on distraction site
  if (isOnDistraction) {
    return { shouldFocus: true, reason: 'distraction' };
  }

  // Always focus if setting is enabled
  if (alwaysFocusOnDone) {
    return { shouldFocus: true, reason: 'always_focus' };
  }

  // Check cooldown
  if (now - lastDoneFocusTime < cooldownMs) {
    return { shouldFocus: false, reason: 'in_cooldown' };
  }

  return { shouldFocus: true, reason: 'cooldown_expired' };
}
