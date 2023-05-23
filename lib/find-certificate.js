import { exec } from "./utils.js";

export default async function findCertificate(subject) {
  // stolen from npm:app-builder-lib/src/codeSign/windowsCodeSign.ts
  const raw = await exec("powershell.exe", [
    "-NoProfile",
    "-NonInteractve",
    "-Command",
    "Get-ChildItem -Recurse Cert: -CodeSigningCert | Select-Object -Property Subject,PSParentPath,Thumbprint | ConvertTo-Json -Compress",
  ]);
  const certList = raw.length === 0 ? [] : toArray(JSON.parse(raw));
  let result = [];
  for (const certInfo of certList) {
    const parentPath = certInfo.PSParentPath;
    const store = parentPath.slice(parentPath.lastIndexOf("\\") + 1);
    const isLocalMachine = parentPath.includes("Certificate::LocalMachine");
    result.push({
      thumbprint: certInfo.Thumbprint,
      subject: certInfo.Subject,
      store,
      isLocalMachine,
    });
  }
  if (subject) {
    result = result.filter((e) => e.subject.includes(subject));
  }
  return result;
}

function toArray(a) {
  return a == null ? [] : Array.isArray(a) ? a : [a];
}
