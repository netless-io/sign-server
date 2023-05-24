// The server provides a /sign API that returns signed file.
// Caches are stored at node_modules/.sign-temp, here's how the cache works:
//
// upload-fast(file content hash):
//    return exists node_modules/.sign-temp/{file content hash}
//
// sign(file = hash or blob, method = sha1):
//    graph = read node_modules/.sign-temp/meta.json/{method}
//    if file is blob, write node_modules/.sign-temp/{hash of file}/{file}
//    if file is hash {
//       if exists node_modules/.sign-temp/{graph[file]} then return that file
//       file = read node_modules/.sign-temp/{file}/*
//    }
//    new_file = {
//       write file to $TEMP/file
//       signtool {options(method)} $TEMP/file
//       read $TEMP/file
//    }
//    write node_modules/.sign-temp/{hash of new_file}/{new_file}
//    graph[hash of file] = hash(new_file)
//    save graph
//    return new_file
//
// client.sign(file, method):
//    POST /upload-fast "hash(file)"
//       => true,  use that hash
//       => false, use file blob
//
//    POST /sign { file = hash or blob, method }
//       => new_file blob
//

import os from "os";
import fs from "fs";
import http from "http";
import parseFormData from "./lib/parse-formdata.js";
import findSignTool from "./lib/find-signtool.js";
import findCertificate from "./lib/find-certificate.js";
import makeSignFn from "./lib/make-sign-fn.js";
import { cache, text, send } from "./lib/utils.js";

const packageJSON = new URL("package.json", import.meta.url);
const indexHTML = new URL("index.html", import.meta.url);

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

const certificate = certificates[0];

const index_html = (res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  fs.createReadStream(indexHTML).pipe(res, { end: true });
};

const sign = makeSignFn(signtool, certificate);

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && req.url === "/") {
    return index_html(res);
  }

  // POST /exists "hash of file" => (json) true | false
  if (req.method === "POST" && req.url === "/exists") {
    return send(req, 200, cache.has(await text(req)));
  }

  // POST /sign FormData { file, hash, isNest } => (octet-stream) signed file
  //            file   = "hash of exist file" or (new file) { name, buffer }
  //            hash   = "sha1" or "sha256"
  //            isNest = "" or "1"
  if (req.method === "POST" && req.url === "/sign") {
    const body = await parseFormData(req);
    if (body) {
      return sign(body, res).catch((error) => {
        send(res, 400, error.message);
      });
    } else {
      return send(res, 400, "expected form data");
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
