const fs = require("fs");
const { basename } = require("path");
const crypto = require("crypto");

/** @type {import('app-builder-lib').CustomWindowsSign} */
module.exports = async function sign({ path, hash, isNest }) {
  let resp;

  const fileHash = await computeHash(path);
  resp = await fetch("http://{local-ip}:3000/exists", {
    method: "POST",
    body: fileHash,
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const exist = await resp.json();
  const body = new FormData();
  if (exist) {
    body.append("file", fileHash);
  } else {
    body.append("file", await fileAsBlob(path), basename(path));
  }
  body.append("hash", hash);
  body.append("isNest", isNest ? "1" : "");

  resp = await fetch("http://{local-ip}:3000/sign", {
    method: "POST",
    body,
  });

  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(path, buffer);
};

async function fileAsBlob(path) {
  const buffer = await fs.promises.readFile(path);
  return new Blob([buffer]);
}

function computeHash(path) {
  return new Promise((resolve) => {
    const hash = crypto.createHash("md5");
    const input = fs.createReadStream(path);
    input.on("readable", () => {
      const data = input.read();
      data ? hash.update(data) : resolve(hash.digest("hex"));
    });
  });
}
