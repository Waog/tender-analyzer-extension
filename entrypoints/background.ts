import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";

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
      const id = uuidv4();
      if (item) {
        browser.runtime
          .sendMessage({
            type: "add-item",
            payload: {
              id,
              filename: item.filename,
              fileSize: item.fileSize,
              mime: item.mime,
              state: "downloaded",
            },
          })
          .catch(() => {});
        processFile(item);
      }
    }
  });
});

async function processFile(item: DownloadItem): Promise<void> {
  if (isZipFile(item)) {
    await processZipFile(item);
  }
}

async function processZipFile(item: DownloadItem): Promise<void> {
  const zipData = await fetchFileData(item.url);
  const zip = await JSZip.loadAsync(zipData);
  const fileEntries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of fileEntries) {
    const content = await entry.async("arraybuffer");
    browser.runtime
      .sendMessage({
        type: "add-item",
        payload: {
          id: uuidv4(),
          filename: entry.name,
          fileSize: content.byteLength,
          mime: "",
          state: "downloaded",
        },
      })
      .catch(() => {});
  }
}

function isZipFile(item: DownloadItem): boolean {
  return item.mime === "application/zip" || item.filename.endsWith(".zip");
}

async function fetchFileData(url: string): Promise<ArrayBuffer> {
  console.log(`Fetching file data from URL: ${url}`);
  const response = await fetch(url);
  return response.arrayBuffer();
}
