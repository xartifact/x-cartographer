import { describe, test, expect } from 'bun:test';
import type { TaskRepository as TaskRepoType } from '../task.repository';
import type { StatusChangeRepository as StatusChangeRepoType } from '../status-change.repository';
import { AppSettingsRepository } from '../app-settings.repository';
import type { AppSettingsRepository as AppSettingsRepoType } from '../app-settings.repository';
import {
  ProjectRepository,
  JourneyRepository,
  StoryRepository,
  TaskRepository,
  StatusChangeRepository,
  getProjectRepository,
  getStatusChangeRepository,
} from '../index';

describe('Repository migration exports', () => {
  describe('TaskRepository', () => {
    test('TaskRepository class has all required methods', () => {
      const requiredMethods: (keyof TaskRepoType)[] = [
        'findById',
        'findByStoryId',
        'create',
        'update',
        'delete',
      ];

      for (const method of requiredMethods) {
        expect(typeof TaskRepository.prototype[method]).toBe('function');
      }
    });
  });

  describe('StatusChangeRepository', () => {
    test('StatusChangeRepository class has all required methods', () => {
      const requiredMethods: (keyof StatusChangeRepoType)[] = [
        'findByEntityId',
        'findAll',
        'create',
        'createMany',
        'deleteById',
        'deleteByEntityId',
        'deleteAll',
      ];

      for (const method of requiredMethods) {
        expect(typeof StatusChangeRepository.prototype[method]).toBe('function');
      }
    });
  });

  describe('AppSettingsRepository', () => {
    test('AppSettingsRepository class has all required methods', () => {
      const requiredMethods: (keyof AppSettingsRepoType)[] = [
        'get',
        'set',
        'delete',
      ];

      for (const method of requiredMethods) {
        expect(typeof AppSettingsRepository.prototype[method]).toBe('function');
      }
    });
  });

  describe('index.ts barrel exports', () => {
    test('exports all repository classes', () => {
      expect(typeof ProjectRepository).toBe('function');
      expect(typeof JourneyRepository).toBe('function');
      expect(typeof StoryRepository).toBe('function');
      expect(typeof TaskRepository).toBe('function');
      expect(typeof StatusChangeRepository).toBe('function');
    });

    test('exports singleton getter functions', () => {
      expect(typeof getProjectRepository).toBe('function');
      expect(typeof getStatusChangeRepository).toBe('function');
    });

    test('singleton getters return instances of correct type', () => {
      const projectRepo = getProjectRepository();
      expect(projectRepo).toBeInstanceOf(ProjectRepository);

      const statusChangeRepo = getStatusChangeRepository();
      expect(statusChangeRepo).toBeInstanceOf(StatusChangeRepository);
    });
  });

  describe('barrel completeness check', () => {
    test('AppSettingsRepository IS exported from the barrel (migration complete)', () => {
      // Import dynamic to check if it's re-exported
      const indexModule = require('../index');
      expect(indexModule.AppSettingsRepository).toBe(AppSettingsRepository);
    });
  });
});
