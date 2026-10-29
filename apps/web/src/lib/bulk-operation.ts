/** Preserve failed selections so retry never repeats successful writes. */
export async function runBulk(ids: string[], write: (id: string) => Promise<unknown>) {
  const results = await Promise.allSettled(ids.map(write));
  return {
    succeeded: ids.filter((_, i) => results[i].status === "fulfilled"),
    failed: ids.filter((_, i) => results[i].status === "rejected"),
  };
}
