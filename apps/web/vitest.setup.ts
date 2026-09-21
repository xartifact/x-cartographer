/**
 * vitest 全局 setup（apps/web/vitest.setup.ts）
 *
 * 存在问题：Node 22+ 在全局声明了 `localStorage`（无 `--localstorage-file` 时为
 * undefined），该声明会**遮蔽** happy-dom 提供的那一份，于是测试里
 * `localStorage.getItem/setItem` 报 "Cannot read properties of undefined"——
 * 所有走 zustand persist 的 store 测试因此失败（实测 18 个用例、3 个文件）。
 *
 * 这里显式提供一份最小内存实现，语义与浏览器一致（含 removeItem/clear/key/length），
 * 使 persist 中间件与直接使用 localStorage 的代码都能在测试中正常工作。
 *
 * 为什么不用 jsdom 替代：环境选型（happy-dom）是既有决定，且真因是 node 的全局声明
 * 遮蔽，不是 happy-dom 不支持 localStorage——补上被遮蔽的全局即可，改动面最小。
 */
class MemoryStorage implements Storage {
  #map = new Map<string, string>();

  get length(): number {
    return this.#map.size;
  }

  clear(): void {
    this.#map.clear();
  }

  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, String(value));
  }
}

// defineProperty 而非直接赋值：node 的全局声明是只读/不可写描述符，直接赋值会被忽略
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});
