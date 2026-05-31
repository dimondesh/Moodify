export async function mapWithConcurrency(items, fn, concurrency = 5) {
  const results = new Array(items.length);

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => fn(item, i + batchIndex)),
    );
    batchResults.forEach((result, batchIndex) => {
      results[i + batchIndex] = result;
    });
  }

  return results;
}
