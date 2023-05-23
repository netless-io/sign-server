const fs = require("fs/promises");
const { basename } = require("path");

/** @type {import('app-builder-lib').CustomWindowsSign} */
module.exports = async function sign({ path, hash, isNest }) {
  // path = "path/to/file.exe", hash = "sha1" | "sha256", isNest = append "/as"
  const body = new FormData();
  body.append("file", await fileAsBlob(path), basename(path));
  body.append("hash", hash);
  body.append("isNest", isNest ? "1" : "");

  const resp = await fetch("http://{local-ip}:3000/sign", {
    method: "POST",
    body,
  });

  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(path);
};

async function fileAsBlob(path) {
  const buffer = await fs.readFile(path);
  return new Blob([buffer]);
}
