/**
 * Schema 就绪检查（apps/server/src/lib/schema-health.ts）
 *
 * 存在理由：2026-09-15 生产事故——新代码镜像已部署，但数据库从未迁移，
 * 结果是 /health 返回 200 而所有业务 API 500。根因是 health 硬编码 `{status:'ok'}`，
 * 不碰数据库，因此"部署成功"的信号完全不可信。
 *
 * 本模块回答三个层次的问题（缺一不可）：
 *   1. 进程活着 —— 由 HTTP 响应本身回答
 *   2. 数据库可达 —— `SELECT 1`
 *   3. **schema 与当前代码期望一致** —— 逐一核对关键表/列是否就位
 *
 * 第 3 层是防线核心：它把"代码已升级、库未迁移"这种半迁移状态从
 * "部署成功但全站 500"变成"部署后立即探活失败"。
 *
 * 特征清单随 schema 演进**必须同步更新**（新增列/表时加一条），
 * 否则防线会随版本漂移而失效。
 */
import { sql } from 'drizzle-orm';
import { ensureDb, rowsOf } from '@x-cartographer/db';

/** 当前代码期望的 schema 特征。新增迁移时在此追加。 */
const REQUIRED_TABLES = [
  'products',
  'milestones',
  'user_activities',
  'user_tasks',
  'user_stories',
  'dev_tasks',
  'status_changes',
  'adr_records',
  'system_modules',
] as const;

/**
 * 关键列：这些列一旦缺失，对应功能会在运行时报错（而非静默降级），
 * 所以必须在探活阶段就暴露。
 */
const REQUIRED_COLUMNS: Array<{ table: string; column: string; since: string }> = [
  // 0003 story-map-redesign
  { table: 'user_stories', column: 'activity_id', since: '0003' },
  { table: 'user_stories', column: 'legacy_journey_id', since: '0003' },
  { table: 'user_stories', column: 'user_task_id', since: '0003' },
  { table: 'user_stories', column: 'affected_modules', since: '0003' },
  { table: 'dev_tasks', column: 'affected_modules', since: '0003' },
  // 0005 provenance（约束写入协议）
  { table: 'products', column: 'provenance', since: '0005' },
  { table: 'milestones', column: 'provenance', since: '0005' },
  { table: 'user_activities', column: 'provenance', since: '0005' },
  { table: 'user_tasks', column: 'provenance', since: '0005' },
  { table: 'user_stories', column: 'provenance', since: '0005' },
  { table: 'adr_records', column: 'provenance', since: '0005' },
  // 0006 system_modules（模块目录升为一等实体）
  { table: 'system_modules', column: 'provenance', since: '0006' },
  { table: 'system_modules', column: 'depends_on', since: '0006' },
  // 0008 工作项第二锚定路径
  { table: 'dev_tasks', column: 'product_id', since: '0008' },
  { table: 'dev_tasks', column: 'module_id', since: '0008' },
];

/**
 * 关键约束：列存在≠语义正确。0009 把 system_modules 的主键从单列 id
 * 改为复合 (product_id, id)——列没变，**约束变了**，而漏掉这个约束的后果是
 * 跨产品 slug 静默互相覆盖（模块易主、零报错）。仅查列无法发现，故单列一类。
 *
 * `columns` 按 PK 定义顺序比对（pg_constraint.conkey 顺序）。
 */
const REQUIRED_PRIMARY_KEYS: Array<{ table: string; columns: string[]; since: string }> = [
  { table: 'system_modules', columns: ['product_id', 'id'], since: '0009' },
];

export interface SchemaHealth {
  ok: boolean;
  /** 数据库连接是否可用 */
  reachable: boolean;
  /** 缺失的表 */
  missingTables: string[];
  /** 缺失的列（`table.column`，附引入版本） */
  missingColumns: string[];
  /** 主键形态不符的约束（`table(pk 期望)`，附引入版本） */
  wrongPrimaryKeys: string[];
  /** 探测失败时的错误摘要（连接不可用等） */
  error?: string;
}

/**
 * 探测数据库与 schema 就绪状态。**永不抛错**——health 端点需要稳定返回，
 * 失败信息通过返回值表达。
 */
export async function checkSchemaHealth(): Promise<SchemaHealth> {
  try {
    const db = await ensureDb();

    // 1) 数据库可达
    await db.execute(sql.raw('SELECT 1'));

    // 2) 表就位
    const tableRows = rowsOf(
      await db.execute(
        sql.raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
      )
    );
    const present = new Set(tableRows.map((r) => String(r.tablename)));
    const missingTables = REQUIRED_TABLES.filter((t) => !present.has(t));

    // 3) 关键列就位
    const colRows = rowsOf(
      await db.execute(
        sql.raw(
          `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
        )
      )
    );
    const presentCols = new Set(colRows.map((r) => `${String(r.table_name)}.${String(r.column_name)}`));
    const missingColumns = REQUIRED_COLUMNS
      .filter((c) => !presentCols.has(`${c.table}.${c.column}`))
      .map((c) => `${c.table}.${c.column} (since ${c.since})`);

    // 4) 关键主键形态（列存在≠语义正确，见 REQUIRED_PRIMARY_KEYS）
    //    conkey 是列号数组，按 attnum 还原列名后与期望序列比对。
    const pkRows = rowsOf(
      await db.execute(
        sql.raw(`SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.conkey
                 FROM pg_constraint c
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'p' AND c.connamespace = 'public'::regnamespace`)
      )
    );
    const pkCols = new Map<string, string[]>();
    for (const r of pkRows) {
      const tbl = String(r.tbl);
      pkCols.set(tbl, [...(pkCols.get(tbl) ?? []), String(r.col)]);
    }
    const wrongPrimaryKeys = REQUIRED_PRIMARY_KEYS
      .filter(({ table, columns }) => {
        const actual = pkCols.get(table) ?? [];
        return actual.length !== columns.length || !columns.every((c) => actual.includes(c));
      })
      .map(({ table, columns, since }) => `${table}(${columns.join(', ')}) (since ${since})`);

    return {
      ok:
        missingTables.length === 0 &&
        missingColumns.length === 0 &&
        wrongPrimaryKeys.length === 0,
      reachable: true,
      missingTables,
      missingColumns,
      wrongPrimaryKeys,
    };
  } catch (err) {
    return {
      ok: false,
      reachable: false,
      missingTables: [],
      missingColumns: [],
      wrongPrimaryKeys: [],
      error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    };
  }
}
