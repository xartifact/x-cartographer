'use server';

import { StatusChangeRepository } from '@/lib/db/repositories/status-change.repository';
import type { StatusChangeRecord } from '@/types';

const repo = new StatusChangeRepository();

export async function getAllStatusChanges(): Promise<StatusChangeRecord[]> {
  return repo.findAll();
}

export async function createStatusChange(record: StatusChangeRecord): Promise<void> {
  return repo.create(record);
}

export async function createManyStatusChanges(records: StatusChangeRecord[]): Promise<void> {
  return repo.createMany(records);
}

export async function deleteStatusChange(id: string): Promise<void> {
  return repo.deleteById(id);
}

export async function deleteEntityStatusHistory(entityId: string): Promise<void> {
  return repo.deleteByEntityId(entityId);
}

export async function deleteAllStatusHistory(): Promise<void> {
  return repo.deleteAll();
}
