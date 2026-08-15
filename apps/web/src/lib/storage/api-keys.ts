/**
 * API 密钥安全存储
 * 使用 AES 加密存储到 localStorage
 */

import CryptoJS from 'crypto-js';
import { createLogger } from '@/lib/logger';
import type { LLMProvider } from '@/types';

const log = createLogger('apiKeys');

/**
 * API 密钥存储键名
 */
const STORAGE_KEY = 'x-cartographer-api-keys';

/**
 * 加密密钥（从浏览器指纹生成）
 */
function getEncryptionKey(): string {
  // 使用浏览器特征生成密钥（简单方案）
  // 生产环境应该使用更安全的方案，如用户密码派生密钥
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width,
    screen.height,
  ].join('|');

  return CryptoJS.SHA256(fingerprint).toString();
}

/**
 * API 密钥数据结构
 */
export interface ApiKeys {
  openai?: string;
  anthropic?: string;
}

/**
 * 加密数据
 */
function encrypt(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * 解密数据
 */
function decrypt(encryptedData: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * 保存 API 密钥
 */
export function saveApiKey(provider: LLMProvider, apiKey: string): void {
  const keys = getApiKeys();
  keys[provider] = apiKey;

  const encryptionKey = getEncryptionKey();
  const encrypted = encrypt(JSON.stringify(keys), encryptionKey);

  localStorage.setItem(STORAGE_KEY, encrypted);
}

/**
 * 获取 API 密钥
 */
export function getApiKey(provider: LLMProvider): string | null {
  const keys = getApiKeys();
  return keys[provider] || null;
}

/**
 * 获取所有 API 密钥
 */
export function getApiKeys(): ApiKeys {
  try {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) {
      return {};
    }

    const encryptionKey = getEncryptionKey();
    const decrypted = decrypt(encrypted, encryptionKey);

    return JSON.parse(decrypted) as ApiKeys;
  } catch (error) {
    log.error('apiKeys.decrypt.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/**
 * 删除 API 密钥
 */
export function deleteApiKey(provider: LLMProvider): void {
  const keys = getApiKeys();
  delete keys[provider];

  if (Object.keys(keys).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    const encryptionKey = getEncryptionKey();
    const encrypted = encrypt(JSON.stringify(keys), encryptionKey);
    localStorage.setItem(STORAGE_KEY, encrypted);
  }
}

/**
 * 清除所有 API 密钥
 */
export function clearApiKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 检查 API 密钥是否存在
 */
export function hasApiKey(provider: LLMProvider): boolean {
  const apiKey = getApiKey(provider);
  return apiKey !== null && apiKey.length > 0;
}

/**
 * 验证 API 密钥格式
 */
export function validateApiKeyFormat(
  provider: LLMProvider,
  apiKey: string
): {
  valid: boolean;
  error?: string;
} {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  switch (provider) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return {
          valid: false,
          error: 'OpenAI API key should start with "sk-"',
        };
      }
      if (apiKey.length < 40) {
        return { valid: false, error: 'OpenAI API key seems too short' };
      }
      break;

    case 'anthropic':
      if (!apiKey.startsWith('sk-ant-')) {
        return {
          valid: false,
          error: 'Anthropic API key should start with "sk-ant-"',
        };
      }
      if (apiKey.length < 40) {
        return { valid: false, error: 'Anthropic API key seems too short' };
      }
      break;

    default:
      return { valid: false, error: 'Unknown provider' };
  }

  return { valid: true };
}

/**
 * 脱敏显示 API 密钥（用于 UI 显示）
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length);
  }

  const start = apiKey.slice(0, 4);
  const end = apiKey.slice(-4);
  const middle = '*'.repeat(Math.min(apiKey.length - 8, 20));

  return `${start}${middle}${end}`;
}
