# <samp>SIGN SERVER</samp>

<samp>[SignTool.exe](https://learn.microsoft.com/en-us/dotnet/framework/tools/signtool-exe) as a server.</samp><br>
<samp>This tool is intended to be run locally (intranet), use with caution.</samp>

## <samp>1. Prepare the Windows Machine</samp>

<p>
  <samp>1. Install the hardware token driver, me using SafeNet;</samp><br>
  <samp>&nbsp;&nbsp;&nbsp;<strong>Note</strong>: Remember to turn on "enable single logon" in driver client settings.</samp><br>
  <samp>2. Install the certificate correctly, me using DigiCertHardwareCertificateInstaller;</samp><br>
  <samp>&nbsp;&nbsp;&nbsp;<strong>Note</strong>: Remember to also install the certificate into your PC.</samp><br>
  <samp>3. Check if you've done right by running script below in PowerShell:</samp>
</p>
<p>
  <samp>&nbsp;&nbsp;&nbsp;<strong>gci -Recurse Cert: -CodeSigningCert</strong></samp>
</p>
<p>
  <samp>&nbsp;&nbsp;&nbsp;If you see the certificate name installed from 1 and 2, then you're done.</samp><br>
  <samp>&nbsp;&nbsp;&nbsp;Otherwise, make sure you have the hardware token connected and try again.</samp><br>
</p>
<p>
  <samp>4. Install <a href="https://nodejs.org" target="_blank">Node.js</a> &gt;= 18;</samp><br>
  <samp>5. Install SignTool.exe from <a href="https://developer.microsoft.com/en-us/windows/downloads/windows-sdk" target="_blank">Windows SDK Installer</a>.</samp>
</p>

<samp><strong>Note</strong>: You cannot complete some steps above through a Windows Remote Desktop client.</samp>

## <samp>2. Run Me!</samp>

<p>
  <samp>git clone https://github.com/netless-io/sign-server</samp><br>
  <samp>cd sign-server</samp><br>
  <samp>npm start</samp><br>
  <samp>------</samp><br>
  <samp>serving http://{local-ip}:3000</samp>
</p>

<samp>Remember the {local-ip} output above, you will use it in the <a href="https://www.electron.build/tutorials/code-signing-windows-apps-on-unix#integrate-signing-with-electron-builder" target="_blank">sign.js</a>.</samp><br>
<samp>See next section.</samp>

<samp>If you see errors when running 'npm start', see the errors table below.</samp>

### <samp>Errors & Solution</samp>

<dl>
  <dt><samp>Not found SignTool.exe</samp></dt>
  <dd><samp>Go edit package.json/config.signtool.</samp></dd>
  <dt><samp>Not found certificate</samp></dt>
  <dd><samp>Make sure you have successfully completed <a href="#1-prepare-the-windows-machine">the first section</a> and your hardware token is currently connected.</samp></dd>
  <dt><samp>Found multiple certificates</samp></dt>
  <dd><samp>Go edit package.json/config.subject.</samp></dd>
</dl>

### <samp>Bonus: Web UI</samp>

<samp>You can access the built-in web UI through the address (http://{local-ip}:3000) printed above. It includes a simple example of uploading a file and sign it. You can test the code signing there before hitting the next section.</samp>

## <samp>3. Compose a sign.js for Electron Builder</samp>

<samp>See the <a href="https://www.electron.build/tutorials/code-signing-windows-apps-on-unix#integrate-signing-with-electron-builder" target="_blank">doc</a> about using custom signning.</samp>

<samp>See the example <a href="./sign.js">sign.js</a>, remember to replace the {local-ip} with the real IP address.</samp>

<samp><strong>Note</strong>: You need at least Node.js 18 to run the electron builder because this script uses the native fetch() API to upload files to the server. If you don't have one, you can import {fetch, FormData} from <a href="https://www.npmjs.com/package/undici" target="_blank">"undici"</a>.</samp>

## <samp>SignTool.exe Cheat Sheet</samp>

<samp>signtool sign<br>
&nbsp;&nbsp;/debug /td sha256 /tr http://timestamp.digicert.com /as<br>
&nbsp;&nbsp;/fd {hash} /sha1 {thumbprint} /s {store} /sm<br>
&nbsp;&nbsp;{file.exe}</samp>

## <samp>References</samp>

- [<samp>SignTool.exe (Sign Tool)</samp>](https://learn.microsoft.com/en-us/dotnet/framework/tools/signtool-exe)
- [<samp>Integrate signing with Electron Builder</samp>](https://www.electron.build/tutorials/code-signing-windows-apps-on-unix#integrate-signing-with-electron-builder)
- <samp>[app-builder-lib/src/codeSign/windowsCodeSign.ts](https://github.com/electron-userland/electron-builder/blob/-/packages/app-builder-lib/src/codeSign/windowsCodeSign.ts)</samp>

## <samp>License</samp>

<samp>The MIT license.</samp>
