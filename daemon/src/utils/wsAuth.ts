/**
 * WebSocket authentication utilities.
 * Extracted from server/index.ts for testability.
 */

export interface WsClientInfo {
  origin?: string;
  url?: string;
  host?: string;
  authorization?: string;
}

/**
 * Extract extension ID from chrome-extension:// origin.
 * Returns null if not a valid chrome-extension origin.
 */
export function extractExtensionId(origin: string | undefined): string | null {
  if (!origin) return null;
  const match = origin.match(/^chrome-extension:\/\/([a-z]{32})$/i);
  return match ? match[1] : null;
}

/**
 * Verify WebSocket client connection.
 *
 * @param info - Client connection info
 * @param authSecret - Authentication secret (undefined = no auth required for external connections)
 * @param allowedExtensionId - Allowed Chrome extension ID (undefined = allow any extension)
 * @returns true if connection is allowed
 */
export function verifyWsClient(
  info: WsClientInfo,
  authSecret: string | undefined,
  allowedExtensionId: string | undefined = undefined
): boolean {
  // Validate Chrome extension connections
  const extensionId = extractExtensionId(info.origin);
  if (extensionId) {
    // If ALLOWED_EXTENSION_ID is set, always verify against it (even without AUTH_SECRET)
    if (allowedExtensionId) {
      return extensionId.toLowerCase() === allowedExtensionId.toLowerCase();
    }
    // If no specific extension ID is required, allow any valid extension
    return true;
  }

  // External connections (Claude Code hooks, etc.)
  // Skip auth if no secret is configured (local development mode)
  if (!authSecret) return true;

  // Validate external connections with token
  try {
    if (!info.url || !info.host) {
      return false;
    }

    const url = new URL(info.url, `http://${info.host}`);
    const token =
      url.searchParams.get('token') ||
      info.authorization?.replace('Bearer ', '');

    if (!token || token !== authSecret) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
