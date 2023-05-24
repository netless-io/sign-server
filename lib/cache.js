import fs from "fs";
import url from "url";
import path from "path";
import crypto from "crypto";
import cp from "child_process";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const cache_dir = path.join(__dirname, "../node_modules/.sign-temp");
// Folder structure:
//   ./[hash]/file.exe   cached files
//   ./meta.json         meta file
//
// Meta = {
//   keep: { [hash]: name },     // all file either at keep or temp
//   temp: { [hash]: name },
//   sha1: { [hash1]: hash2 },   // lookup table for signed files
//   sha256: { [hash2]: hash3 },
// }
//
// Strategy:
//   if not isNest: (it is original file)
//      Meta.keep[hash] = file
//   else:
//      Meta.temp[hash] = file
//
//   new_file = signed(file)
//   Meta.temp[hash(file)] = hash(new_file)
//

// fs.rmSync(cache_dir, { force: true, recursive: true });
fs.mkdirSync(cache_dir, { recursive: true });

export function cache_clear() {
  const meta = cache_meta();
  for (const hash in meta.temp) {
    const dir = path.join(cache_dir, hash);
    fs.rmSync(dir, { force: true, recursive: true });
  }
  meta.temp = {};
  meta.sha1 = {};
  meta.sha256 = {};
  cache_meta(meta);
}

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
    return { keep: {}, temp: {}, sha1: {}, sha256: {} };
  }
}

export function cache_name(hash) {
  const dir = path.join(cache_dir, hash);
  return fs.readdirSync(dir)[0];
}

export const cache = {
  dir: cache_dir,
  clear: cache_clear,
  has: cache_has,
  get: cache_get,
  set: cache_set,
  meta: cache_meta,
  name: cache_name,
};
