/**
 * WebSocket authentication utilities.
 * Extracted from server/index.ts for testability.
 */
/**
 * Verify WebSocket client connection.
 *
 * @param info - Client connection info
 * @param authSecret - Authentication secret (undefined = no auth required)
 * @returns true if connection is allowed
 */
export function verifyWsClient(info, authSecret) {
    // Skip auth if no secret is configured (local development mode)
    if (!authSecret)
        return true;
    // Skip auth for Chrome extension connections (trusted local origin)
    if (info.origin && info.origin.startsWith('chrome-extension://')) {
        return true;
    }
    // Validate external connections (Claude Code hooks, etc.)
    try {
        if (!info.url || !info.host) {
            return false;
        }
        const url = new URL(info.url, `http://${info.host}`);
        const token = url.searchParams.get('token') ||
            info.authorization?.replace('Bearer ', '');
        if (!token || token !== authSecret) {
            return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=wsAuth.js.map