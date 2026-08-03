const PYODIDE_BASE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

let runtimePromise;

function cleanTraceback(value) {
  if (!value) return "";
  return String(value)
    .replaceAll("<exec>", "你的代码")
    .replaceAll("<test>", "测试用例")
    .split("\n")
    .slice(-10)
    .join("\n")
    .trim();
}

async function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      self.postMessage({ type: "runtime-status", status: "loading", message: "正在下载 Python 运行时…" });
      importScripts(`${PYODIDE_BASE_URL}pyodide.js`);
      const runtime = await self.loadPyodide({ indexURL: PYODIDE_BASE_URL });
      self.postMessage({ type: "runtime-status", status: "loading", message: "正在加载 NumPy…" });
      await runtime.loadPackage("numpy");
      self.postMessage({ type: "runtime-status", status: "ready", message: "Python · NumPy 已就绪" });
      return runtime;
    })().catch((error) => {
      runtimePromise = null;
      self.postMessage({
        type: "runtime-status",
        status: "error",
        message: `运行时加载失败：${error?.message || error}`,
      });
      throw error;
    });
  }
  return runtimePromise;
}

async function executeTest(runtime, userCode, testCode, functionName) {
  runtime.globals.set("__practice_user_code", userCode);
  runtime.globals.set("__practice_test_code", testCode.replaceAll("{fn}", functionName));
  runtime.globals.set("__practice_function_name", functionName);

  const serialized = await runtime.runPythonAsync(`
import contextlib as __practice_contextlib
import io as __practice_io
import json as __practice_json
import time as __practice_time
import traceback as __practice_traceback

__practice_stdout = __practice_io.StringIO()
__practice_stderr = __practice_io.StringIO()
__practice_namespace = {"__name__": "__main__"}
__practice_started = __practice_time.perf_counter()

try:
    with __practice_contextlib.redirect_stdout(__practice_stdout), __practice_contextlib.redirect_stderr(__practice_stderr):
        exec(compile(__practice_user_code, "<exec>", "exec"), __practice_namespace)
        if __practice_function_name not in __practice_namespace:
            raise NameError(f"未找到 {__practice_function_name}，请保留题目要求的函数名")
        exec(compile(__practice_test_code, "<test>", "exec"), __practice_namespace)
    __practice_result = {
        "passed": True,
        "error": "",
        "stdout": __practice_stdout.getvalue()[-4000:],
        "stderr": __practice_stderr.getvalue()[-2000:],
    }
except BaseException:
    __practice_result = {
        "passed": False,
        "error": __practice_traceback.format_exc(),
        "stdout": __practice_stdout.getvalue()[-4000:],
        "stderr": __practice_stderr.getvalue()[-2000:],
    }

__practice_result["timeMs"] = round((__practice_time.perf_counter() - __practice_started) * 1000, 2)
__practice_json.dumps(__practice_result, ensure_ascii=False)
  `);

  const result = JSON.parse(serialized);
  result.error = cleanTraceback(result.error);
  return result;
}

async function judge(payload) {
  const runtime = await getRuntime();
  const startedAt = performance.now();
  const results = [];

  for (let index = 0; index < payload.tests.length; index += 1) {
    const test = payload.tests[index];
    self.postMessage({
      type: "judge-progress",
      requestId: payload.requestId,
      current: index + 1,
      total: payload.tests.length,
      name: test.name,
    });

    const outcome = await executeTest(runtime, payload.code, test.code, payload.functionName);
    results.push({
      name: test.name,
      hidden: Boolean(test.hidden),
      passed: outcome.passed,
      timeMs: outcome.timeMs,
      error: outcome.error,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
    });
  }

  const passed = results.filter((result) => result.passed).length;
  self.postMessage({
    type: "judge-complete",
    requestId: payload.requestId,
    mode: payload.mode,
    passed,
    total: results.length,
    allPassed: passed === results.length,
    totalTimeMs: Math.round((performance.now() - startedAt) * 100) / 100,
    results,
  });
}

self.addEventListener("message", (event) => {
  const payload = event.data || {};
  if (payload.type === "init") {
    getRuntime().catch(() => {});
    return;
  }

  if (payload.type === "judge") {
    judge(payload).catch((error) => {
      self.postMessage({
        type: "judge-error",
        requestId: payload.requestId,
        message: cleanTraceback(error?.stack || error?.message || error),
      });
    });
  }
});
