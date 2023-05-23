import cp from "child_process";

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
          reject(new Error(message));
        } else {
          resolve(stdout.toString());
        }
      }
    );
  });
}
