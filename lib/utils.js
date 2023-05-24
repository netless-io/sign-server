import fs from "fs";
import crypto from "crypto";
import cp from "child_process";

export * from "./cache.js";

export async function compute_hash(file) {
  if (Buffer.isBuffer(file)) {
    return crypto.createHash("md5").update(file).digest("hex");
  } else if (typeof file === "string") {
    return new Promise((resolve) => {
      const hash = crypto.createHash("md5");
      const input = fs.createReadStream(file);
      input.on("readable", () => {
        const data = input.read();
        data ? hash.update(data) : resolve(hash.digest("hex"));
      });
    });
  } else {
    throw new Error(
      "unknown hash target " + Object.prototype.toString.call(file)
    );
  }
}

export const md5 = compute_hash;

export function exec(file, args, options) {
  return new Promise((resolve, reject) => {
    cp.execFile(
      file,
      args,
      {
        ...options,
        maxBuffer: 1000 * 1024 * 1024,
        env: process.env,
      },
      (error, stdout, stderr) => {
        if (error) {
          let message = `Exit code: ${error.code}. ${error.message}`;
          if (stdout.length > 0) {
            message += "\n" + stdout.toString();
          }
          if (stderr.length > 0) {
            message += "\n" + stderr.toString();
          }
          // console.error(message);
          reject(new Error(message));
        } else {
          resolve(stdout.toString());
        }
      }
    );
  });
}

export async function text(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

export async function json(req) {
  return JSON.parse(await text(req));
}

export async function send(res, status, body) {
  res.statusCode = status;
  if (Buffer.isBuffer(body)) {
    res.setHeader("Content-Type", "application/octet-stream");
    res.end(body);
  } else if (
    typeof body === "object" ||
    typeof body === "boolean" ||
    typeof body === "number"
  ) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  } else if (typeof body === "string") {
    res.setHeader("Content-Type", "text/plain");
    res.end(body);
  } else {
    res.statusCode = 400;
    res.end("Unknown body " + typeof body + " " + body);
  }
}
