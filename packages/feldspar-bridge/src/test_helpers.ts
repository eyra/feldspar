// Retries an assertion until it passes or the time is up, like vi.waitFor of Vitest.
export async function waitFor (assertion: () => void, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return assertion()
    } catch (error) {
      if (Date.now() > deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}
