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
  private checkpointSignal = createBarrier();
  private checkpointWaiters = new Set<RecoveryBarrier>();
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
    this.checkpointSignal.resolve();
    try {
      this.current?.kill();
    } catch {
      // already exited
    }
  }

  async waitForRecovery(): Promise<void> {
    if (!this.lifecycle || this.stopped || this.fatal) return;

    const recovery = this.recovery;
    if (recovery) {
      await recovery.promise;
      if (this.stopped || this.fatal) return;
    }

    // Linearize this check in the monitor's steady-state race. If the current
    // generation exited first, the waiter is held until recovery or fatal;
    // otherwise the monitor confirms that no recovery was active at this
    // checkpoint. This avoids guessing at promise reaction timing.
    const waiter = createBarrier();
    this.checkpointWaiters.add(waiter);
    this.checkpointSignal.resolve();
    await waiter.promise;
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
      const exitCode = pendingExitCode ?? (await this.waitForExit(proc));
      pendingExitCode = undefined;
      if (this.stopped || exitCode === undefined) return;

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

  private async waitForExit(proc: T): Promise<number | undefined> {
    while (!this.stopped) {
      const checkpoint = this.checkpointSignal;
      const outcome = await Promise.race([
        proc.exited.then(
          (code) => ({ kind: "exit", code }) as const,
          () => ({ kind: "exit", code: -1 }) as const,
        ),
        checkpoint.promise.then(() => ({ kind: "checkpoint" }) as const),
      ]);

      if (this.checkpointSignal === checkpoint) {
        this.checkpointSignal = createBarrier();
      }
      if (this.stopped) return undefined;

      if (outcome.kind === "exit") return outcome.code;
      this.finishCheckpoints();
    }
    return undefined;
  }

  private finishRecovery(): void {
    const barrier = this.recovery;
    this.recovery = undefined;
    barrier?.resolve();
    this.finishCheckpoints();
  }

  private finishCheckpoints(): void {
    const waiters = this.checkpointWaiters;
    this.checkpointWaiters = new Set();
    for (const waiter of waiters) waiter.resolve();
  }

  private fail(exitCode: number): void {
    if (this.fatal) return;
    this.fatal = `${this.options.name} exited with code ${exitCode} and failed to recover after ${this.options.maxRestarts} restarts`;
    this.options.onFatal?.(this.fatal);
    this.finishRecovery();
  }
}
