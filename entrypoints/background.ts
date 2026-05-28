import { fileTypeFromBuffer } from "file-type";
import JSZip from "jszip";
import hash from "stable-hash";

type DownloadItem = globalThis.Browser.downloads.DownloadItem;

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
        processFile(file);
      }
    }
  });
});

async function processFile(file: File): Promise<void> {
  if (isZipFile(file)) {
    await processZipFile(file);
  } else {
    await addFileItem(file, "to be implemented...");
  }
}

async function processZipFile(zipFile: File): Promise<void> {
  await addFileItem(zipFile, "unzipping");

  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const jsZipEntries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of jsZipEntries) {
    const entryFile = await jsZipEntryToFile(entry);
    processFile(entryFile);
  }

  await updateFileItem(zipFile, "done");
}

function isZipFile(file: File): boolean {
  return file.type === "application/zip" || file.name.endsWith(".zip");
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

async function addFileItem(file: File, state?: string): Promise<void> {
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

async function updateFileItem(file: File, state: string): Promise<void> {
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
