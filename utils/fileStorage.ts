const DB_NAME = "tender-files";
const STORE_NAME = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFile(file: File): Promise<string> {
  const id = crypto.randomUUID();
  const buffer = await file.arrayBuffer();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(
      { name: file.name, mime: file.type, buffer },
      id,
    );
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function retrieveAndDeleteFile(id: string): Promise<File> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const { name, mime, buffer } = req.result as {
        name: string;
        mime: string;
        buffer: ArrayBuffer;
      };
      store.delete(id);
      resolve(new File([buffer], name, { type: mime }));
    };
    req.onerror = () => reject(req.error);
  });
}
