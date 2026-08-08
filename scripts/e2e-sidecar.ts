export interface SupervisedProcess {
  exited: Promise<number>;
  kill(): void;
}

export interface SidecarSupervisorOptions<T extends SupervisedProcess> {
  name: string;
  maxRestarts: number;
  startProcess: () => T;
  waitUntilReady: () => Promise<void>;
  onUnexpectedExit?: (code: number) => void;
  onRestart?: (attempt: number, maxRestarts: number) => void;
  onRecovered?: (attempt: number) => void;
  onFatal?: (reason: string) => void;
}

interface RecoveryBarrier {
  promise: Promise<void>;
  resolve: () => void;
}

interface ExitObserver {
  promise: Promise<number>;
  didExit: () => boolean;
  exitCode: () => number;
}

function createBarrier(): RecoveryBarrier {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function observeExit(proc: SupervisedProcess): ExitObserver {
  let exited = false;
  let code = -1;
  const promise = proc.exited.then(
    (value) => {
      exited = true;
      code = value;
      return value;
    },
    () => {
      exited = true;
      return code;
    },
  );
  return {
    promise,
    didExit: () => exited,
    exitCode: () => code,
  };
}

/**
 * Keeps a local test sidecar alive across a bounded number of transient exits.
 * One monitor loop owns every generation, so an exit cannot be dropped between
 * a readiness race and a separate watcher. The restart budget belongs to the
 * supervisor lifetime and is never reset after a successful recovery.
 */
export class SidecarSupervisor<T extends SupervisedProcess> {
  private current: T | undefined;
  private lifecycle: Promise<void> | undefined;
  private recovery: RecoveryBarrier | undefined;
  private stopped = false;
  private restarts = 0;
  private fatal: string | undefined;

  constructor(private readonly options: SidecarSupervisorOptions<T>) {}

  start(): T {
    if (this.lifecycle) throw new Error(`${this.options.name} already started`);
    const proc = this.options.startProcess();
    this.current = proc;
    this.lifecycle = this.monitor(proc).catch(() => {
      if (!this.stopped) this.fail(-1);
    });
    return proc;
  }

  stop(): void {
    this.stopped = true;
    this.finishRecovery();
    try {
      this.current?.kill();
    } catch {
      // already exited
    }
  }

  async waitForRecovery(): Promise<void> {
    // Let a just-settled current-generation exit enter the monitor first.
    await Promise.resolve();
    while (this.recovery) await this.recovery.promise;
  }

  get restartCount(): number {
    return this.restarts;
  }

  get fatalReason(): string | undefined {
    return this.fatal;
  }

  private async monitor(initial: T): Promise<void> {
    let proc = initial;
    let pendingExitCode: number | undefined;

    while (!this.stopped) {
      const exitCode = pendingExitCode ?? (await proc.exited.catch(() => -1));
      pendingExitCode = undefined;
      if (this.stopped) return;

      this.options.onUnexpectedExit?.(exitCode);
      this.beginRecovery();
      if (this.restarts >= this.options.maxRestarts) {
        this.fail(exitCode);
        return;
      }

      const attempt = ++this.restarts;
      this.options.onRestart?.(attempt, this.options.maxRestarts);
      try {
        proc = this.options.startProcess();
      } catch {
        pendingExitCode = -1;
        continue;
      }
      this.current = proc;

      const exit = observeExit(proc);
      const readiness = Promise.resolve()
        .then(() => this.options.waitUntilReady())
        .then(
          () => ({ kind: "ready" }) as const,
          () => ({ kind: "not-ready" }) as const,
        );
      const outcome = await Promise.race([
        readiness,
        exit.promise.then((code) => ({ kind: "exit", code }) as const),
      ]);
      if (this.stopped) return;

      if (outcome.kind === "exit") {
        pendingExitCode = outcome.code;
        continue;
      }

      if (outcome.kind === "not-ready") {
        if (!exit.didExit()) {
          try {
            proc.kill();
          } catch {
            // already exited
          }
        }
        // Preserve the D1 lock guarantee: the next generation cannot launch
        // until this process has fully exited after the readiness failure.
        pendingExitCode = await exit.promise;
        continue;
      }

      // If readiness and exit settle in the same turn, the exit observer's
      // reaction runs by the next microtask and wins over a false recovery.
      await Promise.resolve();
      if (exit.didExit()) {
        pendingExitCode = exit.exitCode();
        continue;
      }

      this.options.onRecovered?.(attempt);
      this.finishRecovery();
    }
  }

  private beginRecovery(): void {
    this.recovery ??= createBarrier();
  }

  private finishRecovery(): void {
    const barrier = this.recovery;
    this.recovery = undefined;
    barrier?.resolve();
  }

  private fail(exitCode: number): void {
    if (this.fatal) return;
    this.fatal = `${this.options.name} exited with code ${exitCode} and failed to recover after ${this.options.maxRestarts} restarts`;
    this.options.onFatal?.(this.fatal);
    this.finishRecovery();
  }
}
