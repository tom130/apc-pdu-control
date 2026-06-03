export type RestoreGuardResult<T> =
  | { started: false }
  | { started: true; value: T };

export function createRestoreGuard() {
  const running = new Set<string>();

  return {
    isRunning(pduId: string): boolean {
      return running.has(pduId);
    },

    async run<T>(pduId: string, task: () => Promise<T>): Promise<RestoreGuardResult<T>> {
      if (running.has(pduId)) {
        return { started: false };
      }

      running.add(pduId);
      try {
        return { started: true, value: await task() };
      } finally {
        running.delete(pduId);
      }
    },
  };
}
