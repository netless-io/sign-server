import assert from "assert/strict";

// Input:
// ------boundary\r\n
// Content-Disposition: form-data; name="file"; filename="blob"\r\n
// Content-Type: application/octet-stream\r\n
// \r\n
// Hello, world!\r\n
// ------boundary\r\n
// Content-Disposition: form-data; name="field"\r\n
// \r\n
// field-content
// ------boundary--\r\n
// Output:
// { file: { name: 'blob', buffer: Buffer {} }, field: "field-content" }

export default async function parse(req) {
  let boundary = req.headers["content-type"]?.split("boundary=")[1];
  if (!boundary) return null;

  boundary = "--" + boundary;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  let buffer = Buffer.concat(chunks);

  const boundaryCRLF = boundary + "\r\n";
  const boundaryENDCRLF = boundary + "--\r\n";

  let i, j;
  chunks.length = 0;
  while (true) {
    i = buffer.indexOf(boundaryCRLF, j);
    if (i >= 0) {
      if (j) {
        chunks.push(buffer.subarray(j, i));
      }
      j = i + boundaryCRLF.length;
    } else {
      i = buffer.indexOf(boundaryENDCRLF, j);
      if (j) {
        chunks.push(buffer.subarray(j, i));
      } else {
        throw no_boundary_end(buffer);
      }
      break;
    }
  }

  const formData = Object.create(null);
  const append = (headers, body) => {
    const name = headers.match(/;\s*name="(.*?)"/i)[1];
    const filename = headers.match(/;\s*filename="(.*?)"/i)?.[1];
    formData[name] = filename
      ? { name: filename, buffer: body }
      : body.toString();
  };

  for (const chunk of chunks) {
    const i = chunk.indexOf("\r\n\r\n");
    if (i >= 0) {
      const headers = chunk.subarray(0, i).toString();
      const body = chunk.subarray(i + 4, -2); // -2: \r\n
      append(headers, body);
    } else {
      throw no_header(chunk);
    }
  }

  return formData;
}

function no_boundary_end(buffer) {
  return new Error(
    "not found boundary end in " + JSON.stringify(buffer.toString())
  );
}

function no_header(chunk) {
  return new Error(
    "not found headers in multipart " + JSON.stringify(chunk.toString())
  );
}
