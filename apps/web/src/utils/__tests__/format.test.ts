import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, formatRelativeTime, formatEstimation } from '../format';

describe('formatDate', () => {
  it('使用默认格式 yyyy-MM-dd', () => {
    expect(formatDate('2026-08-15T10:30:00')).toBe('2026-08-15');
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('支持自定义格式', () => {
    expect(formatDate('2026-08-15T10:30:00', 'yyyy/MM/dd')).toBe('2026/08/15');
    expect(formatDate('2026-08-15T10:30:00', 'HH:mm')).toBe('10:30');
  });

  it('接受 Date 对象', () => {
    expect(formatDate(new Date('2026-12-31T23:59:00'), 'yyyy-MM-dd')).toBe('2026-12-31');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('过去的日期输出"X 前"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00'));
    expect(formatRelativeTime('2026-08-15T11:58:00')).toBe('2 分钟前');
  });

  it('未来的日期输出"X 后"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00'));
    expect(formatRelativeTime('2026-08-15T13:00:00')).toBe('大约 1 小时内');
  });

  it('接受 Date 对象', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00'));
    expect(formatRelativeTime(new Date('2026-08-15T11:00:00'))).toBe('大约 1 小时前');
  });
});

describe('formatEstimation', () => {
  it('小于 1 小时显示分钟', () => {
    expect(formatEstimation(0.5)).toBe('30分钟');
    expect(formatEstimation(0)).toBe('0分钟');
  });

  it('1-7 小时显示小时', () => {
    expect(formatEstimation(1)).toBe('1小时');
    expect(formatEstimation(7.5)).toBe('7.5小时');
  });

  it('整 8 小时显示 1 天', () => {
    expect(formatEstimation(8)).toBe('1天');
    expect(formatEstimation(16)).toBe('2天');
  });

  it('超过 8 小时且有余数显示天+小时', () => {
    expect(formatEstimation(9)).toBe('1天1小时');
    expect(formatEstimation(20)).toBe('2天4小时');
  });

  it('小数工时四舍五入到分钟', () => {
    expect(formatEstimation(0.25)).toBe('15分钟');
    expect(formatEstimation(0.8)).toBe('48分钟');
  });
});
