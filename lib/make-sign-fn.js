import os from "os";
import fs from "fs";
import path from "path";
import { exec, cache, md5, send } from "./utils.js";

export default function makeSignFn(
  signtool,
  { thumbprint, subject, store, isLocalMachine }
) {
  return async function sign({ file, hash, isNest }, res) {
    const meta = cache.meta();

    let file_hash;

    // is Blob { name, buffer }
    if (typeof file === "object") {
      file_hash = await md5(file.buffer);
      await cache.set(file_hash, file);
    }

    // is hash of file
    if (typeof file === "string") {
      file_hash = file;
      if (!cache.has(file_hash)) {
        throw not_found_error(file_hash);
      }

      const new_hash = meta[hash][file_hash];
      if (new_hash && cache.has(new_hash)) {
        return send(res, 200, await cache.get(new_hash));
      }

      file = {
        name: cache.name(file_hash),
        buffer: await cache.get(file_hash),
      };
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
          await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
        } else {
          throw error;
        }
      }
    }

    // cache $TEMP/file
    const new_file_hash = await md5(tmpfile);
    const new_file = await cache.set(new_file_hash, tmpfile);

    meta[hash][file_hash] = new_file_hash;
    cache.meta(meta);

    // return new_file
    send_file(res, new_file);
  };
}

function send_file(res, path) {
  res.writeHead(200, { "Content-Type": "application/octet-stream" });
  fs.createReadStream(path).pipe(res, { end: true });
}

function not_found_error(file_hash) {
  throw new Error("not found file with hash " + file_hash);
}
