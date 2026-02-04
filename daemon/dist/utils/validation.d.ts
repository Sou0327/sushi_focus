/**
 * Input validation utilities for API endpoints.
 * Extracted from server/index.ts for testability.
 */
/**
 * Validates that a value is a non-empty string within length limits.
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @param maxLength - Maximum allowed length
 * @returns Error message if invalid, null if valid
 */
export declare function validateString(value: unknown, fieldName: string, maxLength: number): string | null;
/**
 * Validates an optional string value within length limits.
 * @param value - Value to validate (undefined/null allowed)
 * @param fieldName - Field name for error messages
 * @param maxLength - Maximum allowed length
 * @returns Error message if invalid, null if valid or absent
 */
export declare function validateOptionalString(value: unknown, fieldName: string, maxLength: number): string | null;
/**
 * Validates that a value is a valid number (not NaN).
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @returns Error message if invalid, null if valid
 */
export declare function validateNumber(value: unknown, fieldName: string): string | null;
//# sourceMappingURL=validation.d.ts.map