import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ExtractError, extractText, hasReadableText, markupToText, rtfToText, sniff } from "./index";

const bytes = (s: string) => new TextEncoder().encode(s);

/** A one-page PDF with two lines of text, offsets computed so the xref table is valid. */
function tinyPdf(lines: string[]): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td ${lines.map((l, i) => `${i ? "0 -16 Td " : ""}(${l}) Tj`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return bytes(out);
}

function tinyDocx(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  return zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  });
}

function tinyOdt(paragraphs: string[]): Uint8Array {
  return zipSync({
    mimetype: [strToU8("application/vnd.oasis.opendocument.text"), { level: 0 }],
    "content.xml": strToU8(`<office:document-content><office:body><office:text>${paragraphs.map((p) => `<text:p>${p}</text:p>`).join("")}</office:text></office:body></office:document-content>`),
  });
}

describe("markup and RTF to text", () => {
  it("reads HTML and OpenDocument markup as lines", () => {
    expect(markupToText("<h1>Ayesha Khan</h1><p>Engineer &amp; mentor</p><ul><li>Built APIs</li><li>Led team</li></ul>")).toBe("Ayesha Khan\nEngineer & mentor\n- Built APIs\n- Led team");
    expect(markupToText("<text:p>Skills</text:p><text:list-item><text:p>React</text:p></text:list-item>")).toBe("Skills\n- React");
  });

  it("drops scripts and styles", () => {
    expect(markupToText("<style>p{color:red}</style><p>Hi</p><script>alert(1)</script>")).toBe("Hi");
  });

  it("reads RTF paragraphs and drops formatting", () => {
    const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}\f0\fs24 Ayesha Khan\par Software Engineer \'96 Lahore\par}`;
    expect(rtfToText(rtf)).toBe("Ayesha Khan\nSoftware Engineer – Lahore");
  });
});

describe("sniff", () => {
  it("recognises each readable type from its bytes", () => {
    expect(sniff(tinyPdf(["x"]), "cv.bin")).toBe("application/pdf");
    expect(sniff(tinyDocx(["x"]), "cv")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(sniff(tinyOdt(["x"]), "cv.zip")).toBe("application/vnd.oasis.opendocument.text");
    expect(sniff(bytes("{\\rtf1 hello}"), "cv.txt")).toBe("application/rtf");
    expect(sniff(bytes('{"personal":{}}'), "backup")).toBe("application/json");
    expect(sniff(bytes("<!DOCTYPE html><p>x</p>"), "cv")).toBe("text/html");
    expect(sniff(bytes("Plain text"), "cv.htm")).toBe("text/html");
    expect(sniff(bytes("\uFEFFAyesha Khan\nEngineer"), "cv.txt")).toBe("text/plain");
  });

  it("explains files it can't read", () => {
    expect(sniff(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2]), "cv.doc")).toEqual({ error: expect.stringContaining(".doc") });
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "cv.jpg")).toEqual({ error: expect.stringContaining("photo or scan") });
    expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "cv.png")).toEqual({ error: expect.stringContaining("photo or scan") });
    expect(sniff(new Uint8Array([1, 0, 2, 0, 3]), "cv.txt")).toEqual({ error: expect.stringContaining("Only PDF") });
  });

  it("accepts a Node Buffer", () => {
    expect(sniff(Buffer.from("%PDF-1.7"), "cv.pdf")).toBe("application/pdf");
  });
});

describe("extractText", () => {
  it("reads a PDF and counts its pages", async () => {
    const out = await extractText(tinyPdf(["Ayesha Khan", "Software Engineer"]), "application/pdf");
    expect(out.pages).toBe(1);
    expect(out.text).toContain("Ayesha Khan");
    expect(out.text).toContain("Software Engineer");
  });

  it("reads Word and OpenDocument files", async () => {
    expect((await extractText(tinyDocx(["Ayesha Khan", "Engineer"]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).text.trim()).toBe("Ayesha Khan\n\nEngineer");
    expect((await extractText(tinyOdt(["Ayesha Khan", "Engineer"]), "application/vnd.oasis.opendocument.text")).text).toBe("Ayesha Khan\nEngineer");
  });

  it("reads RTF, HTML and text", async () => {
    expect((await extractText(bytes(String.raw`{\rtf1 Ayesha\par Khan}`), "application/rtf")).text).toBe("Ayesha\nKhan");
    expect((await extractText(bytes("<p>Ayesha</p><p>Khan</p>"), "text/html")).text).toBe("Ayesha\nKhan");
    expect((await extractText(bytes("\uFEFFAyesha\r\nKhan"), "text/plain")).text).toBe("Ayesha\nKhan");
  });

  it("throws ExtractError for a damaged file", async () => {
    await expect(extractText(bytes("PK\u0003\u0004 not really a zip"), "application/vnd.oasis.opendocument.text")).rejects.toBeInstanceOf(ExtractError);
    await expect(extractText(bytes("%PDF-1.4 broken"), "application/pdf")).rejects.toBeInstanceOf(ExtractError);
  });

  it("knows when there is too little text to read", () => {
    expect(hasReadableText("  Ayesha \n ")).toBe(false);
    expect(hasReadableText("Ayesha Khan, Software Engineer in Lahore, Pakistan")).toBe(true);
  });
});
