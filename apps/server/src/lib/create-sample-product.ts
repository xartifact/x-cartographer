import {
  ensureDb,
  generateShortId,
  products,
  userActivities,
  userTasks,
  userStories,
  devTasks,
  statusChanges,
} from "@x-cartographer/db";
/** IDs are reserved before entering the transaction, avoiding a second PGlite connection/query during it. */
export async function createSampleProduct() {
  const id = await generateShortId("product");
  const activityIds = [
    await generateShortId("userActivity"),
    await generateShortId("userActivity"),
  ];
  const stepIds = [await generateShortId("userTask"), await generateShortId("userTask")];
  const storyIds = [await generateShortId("story"), await generateShortId("story")];
  const taskIds = [await generateShortId("devTask"), await generateShortId("devTask")];
  const evidenceIds = await Promise.all(
    Array.from({ length: 7 }, () => generateShortId("statusChange")),
  );
  const db = await ensureDb();
  await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id,
      name: "示例产品 · 电商平台",
      description: "完整示例：活动 → 用户步骤 → 故事 → 研发任务。可自由修改。",
      provenance: "imported",
      settings: {
        auto_save: true,
        display_preferences: {
          default_view: "map",
          show_estimation: true,
          show_priority_colors: true,
        },
      },
    });
    const entities = [{ id, type: "product" }];
    for (let i = 0; i < 2; i++) {
      await tx.insert(userActivities).values({
        id: activityIds[i],
        productId: id,
        name: ["发现商品", "完成购买"][i],
        order: i,
        provenance: "imported",
      });
      await tx.insert(userTasks).values({
        id: stepIds[i],
        activityId: activityIds[i],
        name: ["搜索并查看商品", "确认订单"][i],
        order: 0,
        provenance: "imported",
      });
      await tx.insert(userStories).values({
        id: storyIds[i],
        activityId: activityIds[i],
        userTaskId: stepIds[i],
        title: [
          "作为顾客，我想搜索商品，以便找到需要的商品",
          "作为顾客，我想确认订单，以便完成购买",
        ][i],
        description: "这是可编辑的演示故事。\n\n- 先阅读验收标准\n- 再查看研发任务",
        priority: "high",
        estimation: 2,
        acceptanceCriteria: [
          ["搜索结果匹配关键词", "无匹配时可清除搜索"],
          ["下单前显示商品及总价", "失败时保留订单内容"],
        ][i],
        provenance: "imported",
      });
      await tx.insert(devTasks).values({
        id: taskIds[i],
        productId: id,
        storyId: storyIds[i],
        title: ["实现商品搜索", "实现订单确认"][i],
        description: "演示研发任务，可打开详情编辑并查看状态历史。",
        priority: "P1",
        estimation: 2,
        dependencies: i ? [taskIds[0]] : [],
      });
      entities.push(
        { id: activityIds[i], type: "user_activity" },
        { id: stepIds[i], type: "user_task" },
        { id: storyIds[i], type: "story" },
      );
    }
    await tx.insert(statusChanges).values(
      entities.map((entity, i) => ({
        id: evidenceIds[i],
        entityId: entity.id,
        entityType: entity.type,
        previousStatus: "(none)",
        newStatus: "constraint_written",
        reason: "[constraint-impact:high provenance=imported] 导入完整示例产品",
      })),
    );
  });
  return id;
}
