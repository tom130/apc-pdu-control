export function createPduLock() {
  const chains = new Map<string, Promise<unknown>>();

  async function withPduLock<T>(pduId: string, task: () => Promise<T>): Promise<T> {
    const previous = chains.get(pduId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => current);

    chains.set(pduId, tail);

    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (chains.get(pduId) === tail) {
        chains.delete(pduId);
      }
    }
  }

  return { withPduLock };
}

export const { withPduLock } = createPduLock();
