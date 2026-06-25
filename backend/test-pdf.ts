import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function test() {
  try {
    const pdfParse = require("pdf-parse");
    console.log("pdfParse function type:", typeof pdfParse);
    const buffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<\n/Title (Test)\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF");
    const result = await pdfParse(buffer);
    console.log("Result:", result.text);
  } catch (err) {
    console.error("Error import pdf:", err);
  }
}
test();
