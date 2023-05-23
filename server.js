import os from "os";
import fs from "fs";
import http from "http";
import { join } from "path";
import { fileURLToPath } from "url";
import parseFormData from "./lib/parse-formdata.js";
import findSignTool from "./lib/find-signtool.js";
import findCertificate from "./lib/find-certificate.js";
import { exec } from "./lib/utils.js";

const packageJSON = new URL("package.json", import.meta.url);
const indexHTML = new URL("index.html", import.meta.url);
const tmpdir = new URL("node_modules/.sign-temp", import.meta.url);

const { config } = JSON.parse(fs.readFileSync(packageJSON, "utf8"));
const signtool = await findSignTool(config.signtool);
const certificates = await findCertificate(config.subject).catch(() => []);

if (!signtool) {
  console.error("Not found SignTool.exe");
}

if (certificates.length === 0) {
  console.error("Not found certificate");
}

if (certificates.length > 1) {
  console.error(
    "Found multiple certificates:",
    certificates.map((e) => e.subject)
  );
}

if (!signtool || certificates.length !== 1) {
  process.exit(1);
}

fs.rmSync(tmpdir, { force: true, recursive: true });
fs.mkdirSync(tmpdir, { recursive: true });

const certificate = certificates[0];

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && req.url === "/") {
    return index_html(res);
  }

  if (req.method === "POST" && req.url === "/sign") {
    const body = await parseFormData(req);
    if (body) {
      return sign(body, res);
    }
  }

  res.statusCode = 404;
  res.end();
});

server.listen({ host: "0.0.0.0", port: 3000 }, () => {
  // stolen from npm:local-access
  let k, tmp;
  let nets = os.networkInterfaces();
  for (k in nets) {
    if ((tmp = nets[k].find((x) => x.family === "IPv4" && !x.internal))) {
      console.log(`serving http://${tmp.address}:3000`);
    }
  }
});

const write = fs.promises.writeFile;
// file   = { name, buffer }
// hash   = sha1 | sha256
// isNest = () | 1
async function sign({ file, hash, isNest }, res) {
  console.log("Signing", file.name, hash, file.buffer.length);

  res.writeHead(200, { "Content-Type": "application/octet-stream" });

  // 1. Write to temp file.
  const dummy = Math.random().toString(36).slice(2);
  const tmpfile = new URL(
    join("node_modules/.sign-temp", dummy, file.name),
    import.meta.url
  );
  await write(tmpfile, file.buffer);

  // 2. Invoke signtool.
  // signtool    = "path/to/signtool.exe"
  // certificate = { thumbprint: 'sha1', subject, store, isLocalMachine }
  const args = ["sign", "/debug"];
  args.push(isNest || hash === "sha256" ? "/tr" : "/t");
  args.push("http://timestamp.digicert.com");

  const { thumbprint, subject, store, isLocalMachine } = certificate;
  args.push("/sha1", thumbprint);
  args.push("/s", store);
  if (isLocalMachine) args.push("/sm");

  if (hash !== "sha1") args.push("/fd", hash, "/td", "sha256");

  if (isNest) args.push("/as");

  args.push(fileURLToPath(tmpfile));

  const options = { timeout: 10 * 60 * 1000 };

  try {
    await exec(signtool, args, options);
  } catch {
    // the file is being used by another process (maybe windows defender)
    // wait 15s and try again.
    await new Promsie((resolve) => setTimeout(resolve, 15 * 1000));
    await exec(signtool, args, options);
  }

  console.log("Signed", file.name, hash);

  // 3. Pipe new file back.
  fs.createReadStream(tmpfile).pipe(res, { end: true });
}

function index_html(res) {
  res.writeHead(200, { "Content-Type": "text/html" });
  fs.createReadStream(indexHTML).pipe(res, { end: true });
}
