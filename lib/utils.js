import fs from "fs";
import url from "url";
import path from "path";
import crypto from "crypto";
import cp from "child_process";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const cache_dir = path.join(__dirname, "../node_modules/.sign-temp");

// fs.rmSync(cache_dir, { force: true, recursive: true });
fs.mkdirSync(cache_dir, { recursive: true });

export function cache_has(hash) {
  const dir = path.join(cache_dir, hash);
  return fs.existsSync(dir) && fs.readdirSync(dir).length === 1;
}

export async function cache_get(hash) {
  const dir = path.join(cache_dir, hash);
  try {
    const file = fs.readdirSync(dir)[0];
    if (!file) return;
    const full_path = path.join(dir, file);
    return await fs.promises.readFile(full_path);
  } catch {}
}

export async function cache_set(hash, obj) {
  const dir = path.join(cache_dir, hash);
  fs.mkdirSync(dir, { recursive: true });
  if (typeof obj === "string") {
    const file = path.join(dir, path.basename(obj));
    try {
      fs.renameSync(obj, file);
    } catch {
      // maybe cross disk renaming C:\ -> D:\
      // fallback to copy and delete
      await fs.promises.copyFile(obj, file);
      fs.rmSync(obj);
    }
    return file;
  } else {
    const { name, buffer } = obj;
    const file = path.join(dir, name);
    await fs.promises.writeFile(file, buffer);
    return file;
  }
}

export function cache_meta(to_save) {
  const file = path.join(cache_dir, "meta.json");
  if (to_save) {
    fs.writeFileSync(file, JSON.stringify(to_save, null, 2));
    return to_save;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { sha1: {}, sha256: {} };
  }
}

export function cache_name(hash) {
  const dir = path.join(cache_dir, hash);
  return fs.readdirSync(dir)[0];
}

export const cache = {
  dir: cache_dir,
  has: cache_has,
  get: cache_get,
  set: cache_set,
  meta: cache_meta,
  name: cache_name,
};

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
