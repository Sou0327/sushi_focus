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
 * Verify WebSocket client connection.
 *
 * @param info - Client connection info
 * @param authSecret - Authentication secret (undefined = no auth required)
 * @returns true if connection is allowed
 */
export declare function verifyWsClient(info: WsClientInfo, authSecret: string | undefined): boolean;
//# sourceMappingURL=wsAuth.d.ts.map