/**
 * Map over `array` with at most `concurrency` async mappers in flight.
 * Avoids hammering the API/browser with dozens of simultaneous requests.
 */
export async function mapPool(concurrency, array, mapper) {
  if (!array || array.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, array.length));
  const results = new Array(array.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= array.length) break;
      results[i] = await mapper(array[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
