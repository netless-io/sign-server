import os from "os";
import fs from "fs";
import path from "path";
import { exec, cache, md5, send } from "./utils.js";

export default function makeSignFn(
  signtool,
  { thumbprint, subject, store, isLocalMachine }
) {
  function by_value(record, value) {
    for (const key in record) {
      if (record[key] === value) return key;
    }
  }

  function edit_meta(fn) {
    const meta = cache.meta();
    fn(meta);
    cache.meta(meta);
  }

  function is_signed(file_hash, method) {
    const meta = cache.meta();
    const key1 = by_value(meta.sha1, file_hash);
    if (key1) {
      if (method === "sha1") return true;
      else {
        if (by_value(meta.sha256, key1)) return true;
      }
    }
    const key2 = by_value(meta.sha256, file_hash);
    if (key2) {
      if (method === "sha256") return true;
      else {
        if (by_value(meta.sha1, key2)) return true;
      }
    }
    return false;
  }

  //
  // file   = { name, buffer } or "hash"
  // hash   = "sha1" or "sha256"
  // isNest = "" or "1"
  //
  // 1. resolve file
  //    if file is hash, read file
  //    if file is blob, try save file
  //       if isNest, save file to temp
  //       else       save file to keep
  //
  // 2. sign file
  //    if file is signed, return signed file (maybe itself)
  //    else               sign it
  //                       save new_file to temp, save meta
  //                       return new_file
  //
  return async function sign({ file, hash, isNest }, res) {
    let meta;
    let file_hash;

    // is hash of file
    if (typeof file === "string") {
      file_hash = file;
      if (!cache.has(file_hash)) {
        throw not_found_error(file_hash);
      }
      const name = cache.name(file_hash);
      console.log("Signing (cached)", file_hash, name);

      file = {
        name,
        buffer: await cache.get(file_hash),
      };
    }

    // is Blob { name, buffer }
    if (typeof file === "object") {
      file_hash = await md5(file.buffer);
      if (cache.has(file_hash)) {
        console.log("Signing (cached)", file_hash, file.name);
      } else {
        console.log("Signing (new)", file_hash, file.name);
        // save file to "keep" or "temp"
        edit_meta((meta) => {
          (isNest ? meta.temp : meta.keep)[file_hash] = file.name;
        });
        await cache.set(file_hash, file);
      }
    }

    // is signed? as src
    meta = cache.meta();
    const new_hash = meta[hash][file_hash];
    if (new_hash && cache.has(new_hash)) {
      console.log("Returning cached", file_hash, "->", new_hash);
      return send(res, 200, await cache.get(new_hash));
    }

    // is signed? as dest
    if (is_signed(file_hash, hash)) {
      console.log("Already signed", file_hash);
      return send(res, 200, file.buffer);
    }

    // write file to $TEMP/file
    const dummy = Math.random().toString(36).slice(2);
    const tmpdir = path.join(os.tmpdir(), dummy);
    fs.mkdirSync(tmpdir, { recursive: true });
    const tmpfile = path.join(tmpdir, file.name);
    await fs.promises.writeFile(tmpfile, file.buffer);

    // signtool {...options} $TEMP/file
    // -----------------------------------
    const args = ["sign", "/debug"];
    args.push("/tr", "http://timestamp.digicert.com", "/td", "sha256");
    args.push("/sha1", thumbprint, "/s", store, "/fd", hash);
    if (isLocalMachine) args.push("/sm");
    if (isNest) args.push("/as");
    args.push(tmpfile);

    const options = { timeout: 10 * 60 * 1000 };
    for (let i = 0; i < 2; ++i) {
      try {
        await exec(signtool, args, options);
      } catch (error) {
        // the file is being used by another process (maybe windows defender)
        // wait 15s and try again.
        if (i === 0) {
          console.error(error.message);
          console.log("Trying again", file_hash);
          await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
        } else {
          throw error;
        }
      }
    }

    // cache $TEMP/file
    const new_file_hash = await md5(tmpfile);
    const new_file = await cache.set(new_file_hash, tmpfile);
    edit_meta((meta) => {
      meta.temp[new_file_hash] = new_file;
      meta[hash][file_hash] = new_file_hash;
    });

    console.log("Signed", file_hash, "->", new_file_hash);

    // return new_file
    send_file(res, cache.path(new_file_hash, new_file));
  };
}

function send_file(res, path) {
  res.writeHead(200, { "Content-Type": "application/octet-stream" });
  fs.createReadStream(path).pipe(res, { end: true });
}

function not_found_error(file_hash) {
  throw new Error("not found file with hash " + file_hash);
}
