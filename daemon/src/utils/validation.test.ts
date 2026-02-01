import { describe, it, expect } from 'vitest';
import {
  validateString,
  validateOptionalString,
  validateNumber,
} from './validation.js';

describe('validateString', () => {
  it('正常な文字列を受け入れる', () => {
    expect(validateString('hello', 'name', 100)).toBe(null);
    expect(validateString('test', 'field', 10)).toBe(null);
  });

  it('空文字列を拒否する', () => {
    expect(validateString('', 'name', 100)).toBe('name is required');
  });

  it('最大長超過を拒否する', () => {
    expect(validateString('hello world', 'name', 5)).toBe(
      'name exceeds maximum length of 5 characters'
    );
  });

  it('非文字列を拒否する', () => {
    expect(validateString(123, 'name', 100)).toBe('name must be a string');
    expect(validateString(null, 'name', 100)).toBe('name must be a string');
    expect(validateString(undefined, 'name', 100)).toBe('name must be a string');
    expect(validateString({}, 'name', 100)).toBe('name must be a string');
    expect(validateString([], 'name', 100)).toBe('name must be a string');
  });
});

describe('validateOptionalString', () => {
  it('undefined/null を許可する', () => {
    expect(validateOptionalString(undefined, 'name', 100)).toBe(null);
    expect(validateOptionalString(null, 'name', 100)).toBe(null);
  });

  it('正常な文字列を受け入れる', () => {
    expect(validateOptionalString('hello', 'name', 100)).toBe(null);
    expect(validateOptionalString('', 'name', 100)).toBe(null); // 空文字は許可
  });

  it('最大長超過を拒否する', () => {
    expect(validateOptionalString('hello world', 'name', 5)).toBe(
      'name exceeds maximum length of 5 characters'
    );
  });

  it('非文字列を拒否する', () => {
    expect(validateOptionalString(123, 'name', 100)).toBe('name must be a string');
    expect(validateOptionalString({}, 'name', 100)).toBe('name must be a string');
    expect(validateOptionalString([], 'name', 100)).toBe('name must be a string');
  });
});

describe('validateNumber', () => {
  it('正常な数値を受け入れる', () => {
    expect(validateNumber(42, 'count')).toBe(null);
    expect(validateNumber(0, 'count')).toBe(null);
    expect(validateNumber(-5, 'count')).toBe(null);
    expect(validateNumber(3.14, 'count')).toBe(null);
  });

  it('NaN を拒否する', () => {
    expect(validateNumber(NaN, 'count')).toBe('count must be a number');
  });

  it('非数値を拒否する', () => {
    expect(validateNumber('42', 'count')).toBe('count must be a number');
    expect(validateNumber(null, 'count')).toBe('count must be a number');
    expect(validateNumber(undefined, 'count')).toBe('count must be a number');
    expect(validateNumber({}, 'count')).toBe('count must be a number');
    expect(validateNumber([], 'count')).toBe('count must be a number');
  });
});
