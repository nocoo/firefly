import { describe, expect, it, vi } from "vitest";
import { SidecarSupervisor, type SupervisedProcess } from "./e2e-sidecar";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fakeProcess(): SupervisedProcess & { exit: (code: number) => void } {
  const done = deferred<number>();
  return {
    exited: done.promise,
    exit: done.resolve,
    kill: vi.fn(() => done.resolve(0)),
  };
}

describe("SidecarSupervisor", () => {
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

  it("fails after exhausting the bounded restart budget", async () => {
    const first = fakeProcess();
    const replacementOne = fakeProcess();
    const replacementTwo = fakeProcess();
    const startProcess = vi
      .fn<() => SupervisedProcess>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(replacementOne)
      .mockReturnValueOnce(replacementTwo);
    const neverReady = () => new Promise<void>(() => {});
    const onFatal = vi.fn();
    const supervisor = new SidecarSupervisor({
      name: "wrangler",
      maxRestarts: 2,
      startProcess,
      waitUntilReady: neverReady,
      onFatal,
    });

    supervisor.start();
    first.exit(1);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(2));
    replacementOne.exit(2);
    await vi.waitFor(() => expect(startProcess).toHaveBeenCalledTimes(3));
    replacementTwo.exit(3);

    await vi.waitFor(() => expect(onFatal).toHaveBeenCalledOnce());
    await supervisor.waitForRecovery();
    expect(supervisor.fatalReason).toContain("failed to recover after 2 restarts");
    supervisor.stop();
  });
});
