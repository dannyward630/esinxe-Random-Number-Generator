import { generateChunk } from "./generator.js";

function reply(send, requestId, request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    send({ kind: "error", requestId, error: { name: "TypeError", message: "request must be an object" } });
    return;
  }
  try {
    const chunk = generateChunk(request);
    send({ kind: "generated", requestId, chunk });
  } catch (error) {
    send({
      kind: "error",
      requestId,
      error: { name: error?.name ?? "Error", message: error?.message ?? String(error) },
    });
  }
}

function handleMessage(message, send) {
  if (message?.kind !== "generate") {
    send({
      kind: "error",
      requestId: message?.requestId ?? null,
      error: { name: "TypeError", message: "unsupported worker message kind" },
    });
    return;
  }
  reply(send, message.requestId ?? null, message.request);
}

if (typeof process !== "undefined" && process.versions?.node) {
  const { parentPort } = await import("node:worker_threads");
  parentPort.on("message", (message) => handleMessage(message, (response) => parentPort.postMessage(response)));
} else {
  globalThis.addEventListener("message", (event) => handleMessage(event.data, (response) => globalThis.postMessage(response)));
}
