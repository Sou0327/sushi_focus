/**
 * WebSocket authentication utilities.
 * Extracted from server/index.ts for testability.
 */
/**
 * Timing-safe string comparison to prevent timing attacks on secret tokens.
 */
export declare function safeCompare(a: string, b: string): boolean;
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
export declare function extractExtensionId(origin: string | undefined): string | null;
/**
 * Verify WebSocket client connection.
 *
 * @param info - Client connection info
 * @param authSecret - Authentication secret (undefined = no auth required for external connections)
 * @param allowedExtensionId - Allowed Chrome extension ID (undefined = allow any extension)
 * @returns true if connection is allowed
 */
export declare function verifyWsClient(info: WsClientInfo, authSecret: string | undefined, allowedExtensionId?: string | undefined): boolean;
//# sourceMappingURL=wsAuth.d.ts.map