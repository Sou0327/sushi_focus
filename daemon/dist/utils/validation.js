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
export function validateString(value, fieldName, maxLength) {
    if (typeof value !== 'string')
        return `${fieldName} must be a string`;
    if (value.length === 0)
        return `${fieldName} is required`;
    if (value.length > maxLength)
        return `${fieldName} exceeds maximum length of ${maxLength} characters`;
    return null;
}
/**
 * Validates an optional string value within length limits.
 * @param value - Value to validate (undefined/null allowed)
 * @param fieldName - Field name for error messages
 * @param maxLength - Maximum allowed length
 * @returns Error message if invalid, null if valid or absent
 */
export function validateOptionalString(value, fieldName, maxLength) {
    if (value === undefined || value === null)
        return null;
    if (typeof value !== 'string')
        return `${fieldName} must be a string`;
    if (value.length > maxLength)
        return `${fieldName} exceeds maximum length of ${maxLength} characters`;
    return null;
}
/**
 * Validates that a value is a valid number (not NaN).
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @returns Error message if invalid, null if valid
 */
export function validateNumber(value, fieldName) {
    if (typeof value !== 'number' || isNaN(value))
        return `${fieldName} must be a number`;
    return null;
}
//# sourceMappingURL=validation.js.map