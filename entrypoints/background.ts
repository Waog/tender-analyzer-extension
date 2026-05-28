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
        await addDownloadItem({ item, state: "source found" });
        processDownloadItem(item);
      }
    }
  });
});

async function processDownloadItem(item: DownloadItem): Promise<void> {
  if (isZipFile(item)) {
    await processDownloadItemZipFile(item);
  }
}

async function processDownloadItemZipFile(item: DownloadItem): Promise<void> {
  await updateDownloadItem({ item, state: "fetching data" });

  const zipData = await fetchFileData(item.url);

  await updateDownloadItem({ item, state: "unzipping" });

  const zip = await JSZip.loadAsync(zipData);
  const jsZipEntries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of jsZipEntries) {
    await addJsZipEntryItem(entry);
  }

  await updateDownloadItem({ item, state: "done" });
}

function isZipFile(item: DownloadItem): boolean {
  return item.mime === "application/zip" || item.filename.endsWith(".zip");
}

async function fetchFileData(url: string): Promise<ArrayBuffer> {
  console.log(`Fetching file data from URL: ${url}`);
  const response = await fetch(url);
  return response.arrayBuffer();
}

async function addDownloadItem({
  item,
  state,
}: {
  item: DownloadItem;
  state?: string;
}): Promise<void> {
  return await browser.runtime
    .sendMessage({
      type: "add-item",
      payload: {
        id: hash([item.filename, item.fileSize]),
        filename: item.filename,
        fileSize: item.fileSize,
        mime: item.mime,
        state,
      },
    })
    .catch(() => {});
}

async function updateDownloadItem({
  item,
  state,
}: {
  item: DownloadItem;
  state?: string;
}): Promise<void> {
  return await browser.runtime.sendMessage({
    type: "update-item",
    payload: {
      id: hash([item.filename, item.fileSize]),
      state,
    },
  });
}

async function addJsZipEntryItem(entry: JSZip.JSZipObject) {
  const content = await entry.async("arraybuffer");
  return await browser.runtime.sendMessage({
    type: "add-item",
    payload: {
      id: hash([entry.name, content.byteLength]),
      filename: entry.name,
      fileSize: content.byteLength,
      mime: "",
      state: "to be implemented...",
    },
  });
}
