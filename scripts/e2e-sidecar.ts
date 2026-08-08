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

class ExitDuringRecoveryError extends Error {
  constructor(public readonly code: number) {
    super(`sidecar exited during recovery with code ${code}`);
  }
}

/**
 * Keeps a local test sidecar alive across a small number of transient exits.
 *
 * Recovery is intentionally bounded: a one-off Wrangler/workerd crash should
 * not fan out into dozens of misleading browser failures, while a persistent
 * startup failure must still fail the E2E run.
 */
export class SidecarSupervisor<T extends SupervisedProcess> {
  private current: T | undefined;
  private recovery: Promise<void> | undefined;
  private stopped = false;
  private restarts = 0;
  private fatal: string | undefined;

  constructor(private readonly options: SidecarSupervisorOptions<T>) {}

  start(): T {
    if (this.current) throw new Error(`${this.options.name} already started`);
    return this.launch();
  }

  stop(): void {
    this.stopped = true;
    try {
      this.current?.kill();
    } catch {
      // already exited
    }
  }

  async waitForRecovery(): Promise<void> {
    // Give a just-settled `proc.exited` callback a microtask turn to install
    // the recovery promise, then follow any recovery that is currently live.
    await Promise.resolve();
    while (this.recovery) await this.recovery;
  }

  get restartCount(): number {
    return this.restarts;
  }

  get fatalReason(): string | undefined {
    return this.fatal;
  }

  private launch(): T {
    const proc = this.options.startProcess();
    this.current = proc;
    void proc.exited.then((code) => this.handleExit(proc, code));
    return proc;
  }

  private handleExit(proc: T, code: number): void {
    if (this.stopped || proc !== this.current || this.recovery) return;
    this.options.onUnexpectedExit?.(code);
    this.recovery = this.recover(code).finally(() => {
      this.recovery = undefined;
    });
  }

  private async recover(initialCode: number): Promise<void> {
    let lastCode = initialCode;

    for (let attempt = 1; attempt <= this.options.maxRestarts; attempt++) {
      if (this.stopped) return;
      this.restarts = attempt;
      this.options.onRestart?.(attempt, this.options.maxRestarts);

      const proc = this.launch();
      try {
        await Promise.race([
          this.options.waitUntilReady(),
          proc.exited.then((code) => {
            lastCode = code;
            throw new ExitDuringRecoveryError(code);
          }),
        ]);
        if (this.stopped) return;
        this.options.onRecovered?.(attempt);
        return;
      } catch {
        if (this.stopped) return;
        try {
          proc.kill();
        } catch {
          // already exited
        }
        // Do not launch the next replacement while the previous process may
        // still own the port or the persisted D1 directory lock.
        try {
          lastCode = await proc.exited;
        } catch {
          // A rejected exit promise is equivalent to an unknown exit code.
        }
      }
    }

    this.fatal = `${this.options.name} exited with code ${lastCode} and failed to recover after ${this.options.maxRestarts} restarts`;
    this.options.onFatal?.(this.fatal);
  }
}
