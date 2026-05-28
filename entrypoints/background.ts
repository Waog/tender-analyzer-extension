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
        browser.runtime
          .sendMessage({
            type: "download-complete",
            download: {
              filename: item.filename,
              fileSize: item.fileSize,
              mime: item.mime,
            },
          })
          .catch(() => {});
      }
    }
  });
});
