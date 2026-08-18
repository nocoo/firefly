import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidecarSupervisor, type SupervisedProcess } from "./e2e-sidecar";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type FakeProcess = SupervisedProcess & {
  exit: (code: number) => void;
  kill: ReturnType<typeof vi.fn>;
};

function fakeProcess(exitOnKill = true): FakeProcess {
  const done = deferred<number>();
  return {
    exited: done.promise,
    exit: done.resolve,
    kill: vi.fn(() => {
      if (exitOnKill) done.resolve(0);
    }),
  };
}

describe("SidecarSupervisor", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restarts an unexpectedly exited sidecar and waits for readiness", async () => {
    const first = fakeProcess();
    const replacement = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(replacement);
    const waitUntilReady = vi.fn().mockResolvedValue(undefined);
    const onRecovered = vi.fn();
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 2,
      startProcess,
      waitUntilReady,
      onRecovered,
    });

    supervisor.start();
    first.exit(1);

    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(2));
    await supervisor.waitForRecovery();
    expect(waitUntilReady).toHaveBeenCalledOnce();
    expect(onRecovered).toHaveBeenCalledWith(1);
    expect(supervisor.restartCount).toBe(1);
    expect(supervisor.fatalReason).toBeUndefined();
    supervisor.stop();
  });

  it("retries when a replacement exits before becoming ready", async () => {
    const first = fakeProcess();
    const failedReplacement = fakeProcess();
    const healthyReplacement = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(failedReplacement)
      .mockReturnValueOnce(healthyReplacement);
    const readiness = deferred<void>();
    const waitUntilReady = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(readiness.promise)
      .mockResolvedValueOnce(undefined);
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 2,
      startProcess,
      waitUntilReady,
    });

    supervisor.start();
    first.exit(1);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(2));
    failedReplacement.exit(2);

    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(3));
    await supervisor.waitForRecovery();
    expect(supervisor.restartCount).toBe(2);
    expect(supervisor.fatalReason).toBeUndefined();
    supervisor.stop();
  });

  it("spends one restart budget across separate successful recovery cycles", async () => {
    const first = fakeProcess();
    const replacementOne = fakeProcess();
    const replacementTwo = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(replacementOne)
      .mockReturnValueOnce(replacementTwo);
    const onFatal = vi.fn();
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 2,
      startProcess,
      waitUntilReady: vi.fn().mockResolvedValue(undefined),
      onFatal,
    });

    supervisor.start();
    first.exit(1);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(2));
    await supervisor.waitForRecovery();
    replacementOne.exit(2);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(3));
    await supervisor.waitForRecovery();
    replacementTwo.exit(3);

    await vi.waitFor(() => expect(onFatal).toHaveBeenCalledOnce());
    await supervisor.waitForRecovery();
    expect(startProcess).toHaveBeenCalledTimes(3);
    expect(supervisor.restartCount).toBe(2);
    expect(supervisor.fatalReason).toContain("failed to recover after 2 restarts");
    supervisor.stop();
  });

  it("does not lose an exit resolved in the same turn as readiness", async () => {
    const first = fakeProcess();
    const racedReplacement = fakeProcess();
    const healthyReplacement = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(racedReplacement)
      .mockReturnValueOnce(healthyReplacement);
    const firstReadiness = deferred<void>();
    const waitUntilReady = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstReadiness.promise)
      .mockResolvedValueOnce(undefined);
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 2,
      startProcess,
      waitUntilReady,
    });

    supervisor.start();
    first.exit(1);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(2));
    firstReadiness.resolve();
    racedReplacement.exit(9);

    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(3));
    await supervisor.waitForRecovery();
    expect(supervisor.restartCount).toBe(2);
    expect(supervisor.fatalReason).toBeUndefined();
    supervisor.stop();
  });

  it("waits for a killed generation to exit before launching the next", async () => {
    const first = fakeProcess();
    const stuckReplacement = fakeProcess(false);
    const healthyReplacement = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(stuckReplacement)
      .mockReturnValueOnce(healthyReplacement);
    const waitUntilReady = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("health timeout"))
      .mockResolvedValueOnce(undefined);
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 2,
      startProcess,
      waitUntilReady,
    });

    supervisor.start();
    first.exit(1);
    await vi.waitFor(() => expect(stuckReplacement.kill).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(startProcess).toHaveBeenCalledTimes(2);

    stuckReplacement.exit(7);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(3));
    await supervisor.waitForRecovery();
    expect(supervisor.fatalReason).toBeUndefined();
    supervisor.stop();
  });

  it("waits when called immediately after an exit before recovery starts", async () => {
    const first = fakeProcess();
    const replacement = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(replacement);
    const readiness = deferred<void>();
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 1,
      startProcess,
      waitUntilReady: () => readiness.promise,
    });

    supervisor.start();
    first.exit(1);
    const recovery = supervisor.waitForRecovery();

    let recovered = false;
    void recovery.then(() => {
      recovered = true;
    });

    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    await Promise.resolve();
    expect(recovered).toBe(false);

    readiness.resolve();
    await recovery;
    expect(recovered).toBe(true);
    expect(supervisor.restartCount).toBe(1);
    expect(supervisor.fatalReason).toBeUndefined();
    supervisor.stop();
  });
});
