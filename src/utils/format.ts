/**
 * 格式化工具函数
 */

import { format, formatDistance, formatRelative } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 格式化日期
 */
export function formatDate(date: string | Date, formatStr = 'yyyy-MM-dd'): string {
  return format(new Date(date), formatStr, { locale: zhCN });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: string | Date): string {
  return formatDistance(new Date(date), new Date(), {
    addSuffix: true,
    locale: zhCN,
  });
}

/**
 * 格式化工时
 */
export function formatEstimation(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}分钟`;
  }
  if (hours < 8) {
    return `${hours}小时`;
  }
  const days = Math.floor(hours / 8);
  const remainingHours = hours % 8;
  if (remainingHours === 0) {
    return `${days}天`;
  }
  return `${days}天${remainingHours}小时`;
}
