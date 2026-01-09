/**
 * 需求分析 API 调用
 */

import type {
  RequirementAnalysis,
  JourneySuggestion,
  AnalyzeRequirementDTO,
  GenerateJourneysDTO,
} from '../types';

// API 基础地址（如果是 Next.js API Route）
const API_BASE = '/api/llm';

/**
 * 分析需求
 */
export async function analyzeRequirement(
  dto: AnalyzeRequirementDTO
): Promise<RequirementAnalysis> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '需求分析失败');
  }

  return response.json();
}

/**
 * 生成用户旅程建议
 */
export async function generateJourneySuggestions(
  dto: GenerateJourneysDTO
): Promise<JourneySuggestion[]> {
  const response = await fetch(`${API_BASE}/generate-journey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '旅程生成失败');
  }

  return response.json();
}

/**
 * 测试 API 连接
 */
export async function testApiConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/test`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}