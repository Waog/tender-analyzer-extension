import { fileTypeFromBuffer } from "file-type";
import JSZip from "jszip";
import * as mammoth from "mammoth";
import readExcelFile from "read-excel-file/web-worker";
import hash from "stable-hash";
import { extractText, getDocumentProxy } from "unpdf";
import { retrieveAndDeleteFile } from "~/utils/fileStorage";
import { instructionPromptSnippet } from "./instructionPromptSnippet";

type DownloadItem = globalThis.Browser.downloads.DownloadItem;

const state: Record<string, { file: File; promptSnippet: string }> = {};

export default defineBackground(() => {
  browser.contextMenus.create({
    id: "tender-analyzer",
    title: "Tender Analyzer",
    contexts: ["page"],
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "tender-analyzer" && tab?.id) {
      (browser as any).sidePanel.open({ tabId: tab.id });
    }
  });

  browser.downloads.onChanged.addListener(async (delta) => {
    if (delta.state?.current === "complete") {
      const [item] = await browser.downloads.search({ id: delta.id });
      if (item) {
        const file = await downloadItemToFile(item);
        await processFile(file);
      }
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "get-prompt") {
      sendResponse(buildPrompt());
      return true;
    }
    if (message.type === "process-file") {
      retrieveAndDeleteFile(message.payload.id)
        .then((file) => processFile(file))
        .then(() => sendResponse());
      return true;
    }
  });
});

async function processFile(file: File): Promise<void> {
  if (isZipFile(file)) {
    await processZipFile(file);
  } else if (isPdfFile(file)) {
    await processPdfFile(file);
  } else if (isDocxFile(file)) {
    await processDocxFile(file);
  } else if (isXlsxFile(file)) {
    await processXlsxFile(file);
  } else {
    await addFileItem({
      file,
      state: "❌ unknown file type,to be implemented...",
    });
  }
}

async function processZipFile(file: File): Promise<void> {
  await addFileItem({ file, state: "⌛ unzipping" });

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const jsZipEntries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of jsZipEntries) {
    const entryFile = await jsZipEntryToFile(entry);
    processFile(entryFile);
  }

  await updateFileItem({ file, state: "✅ done" });
}

async function processPdfFile(file: File): Promise<void> {
  await addFileItem({ file, state: "⌛ reading PDF" });
  const data = await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  await updateFileItem({
    file,
    state: `⌛ extracted ${totalPages} pages and ${text.length} characters, creating prompt snippet...`,
  });
  const promptSnippet = `

    ---
    ${file.name}:

    ${text}
    ---

    `;
  state[toId(file)] = { file, promptSnippet };
  await updateFileItem({ file, state: `✅ done (${totalPages} pages)` });
}

export async function processDocxFile(file: File): Promise<void> {
  await addFileItem({ file, state: "⌛ reading DOCX" });
  const arrayBuffer = await file.arrayBuffer();
  const mammothResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = mammothResult.value;
  await updateFileItem({
    file,
    state: `⌛ extracted html (${html.length} characters), creating prompt snippet...`,
  });
  const promptSnippet = `

    ---
    ${file.name}:

    ${html}
    ---

    `;
  state[toId(file)] = { file, promptSnippet };
  await updateFileItem({ file, state: `✅ done (${html.length} characters)` });
}

export async function processXlsxFile(file: File): Promise<void> {
  await addFileItem({ file, state: "⌛ reading XLSX" });
  const sheets = await readExcelFile(file);
  await updateFileItem({
    file,
    state: `⌛ extracted XLSX (${sheets.length} sheets), creating prompt snippet...`,
  });
  const promptSnippet = `

    ---
    ${file.name}:

    ${JSON.stringify(sheets, null, 2)}
    ---

    `;
  state[toId(file)] = { file, promptSnippet };
  await updateFileItem({ file, state: `✅ done (${sheets.length} sheets)` });
}

function buildPrompt(): string {
  const snippets = Object.values(state).map((s) => s.promptSnippet);
  return [instructionPromptSnippet, ...snippets].join("\n");
}

function isZipFile(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf";
}

function isDocxFile(file: File): boolean {
  return (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isXlsxFile(file: File): boolean {
  return (
    file.type ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

async function downloadItemToFile(item: DownloadItem): Promise<File> {
  const data = await fetchFileData(item.url);
  const fileType = await fileTypeFromBuffer(data);
  return new File([data], item.filename, { type: fileType?.mime });
}

async function jsZipEntryToFile(entry: JSZip.JSZipObject): Promise<File> {
  const data = await entry.async("arraybuffer");
  const fileType = await fileTypeFromBuffer(data);
  return new File([data], entry.name, { type: fileType?.mime });
}

async function fetchFileData(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}

async function addFileItem({
  file,
  state,
}: {
  file: File;
  state?: string;
}): Promise<void> {
  return await browser.runtime.sendMessage({
    type: "add-item",
    payload: {
      id: toId(file),
      filename: file.name,
      fileSize: file.size,
      mime: file.type,
      state,
    },
  });
}

async function updateFileItem({
  file,
  state,
}: {
  file: File;
  state: string;
}): Promise<void> {
  return await browser.runtime.sendMessage({
    type: "update-item",
    payload: {
      id: toId(file),
      state,
    },
  });
}

function toId(file: File): string {
  return hash([file.name, file.size]);
}
