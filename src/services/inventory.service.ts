import { Injectable, signal, computed } from '@angular/core';

export interface Box {
  id: string;
  name: string;
  isFull: boolean;
  createdAt: number;
}

export interface Item {
  id: string;
  boxId: string;
  boxName: string; // denormalized for easier search context
  imageUrl: string;
  imageBlob?: Blob;
  name: string;
  description: string;
  tags: string[];
  timestamp: number;
}

function base64ToBlob(base64DataUri: string): Blob {
  const parts = base64DataUri.split(',');
  if (parts.length !== 2) return new Blob();
  const metadata = parts[0];
  const base64Data = parts[1];
  
  const mimeType = metadata.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  
  return new Blob([byteArray], { type: mimeType });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly DB_NAME = 'ClutterAI_DB';
  private readonly DB_VERSION = 2;
  private db: IDBDatabase | null = null;

  boxes = signal<Box[]>([]);
  items = signal<Item[]>([]);
  
  currentBoxId = signal<string | null>(null);

  currentBox = computed(() => 
    this.boxes().find(b => b.id === this.currentBoxId()) || null
  );

  itemsInCurrentBox = computed(() => 
    this.items()
      .filter(i => i.boxId === this.currentBoxId())
      .sort((a, b) => b.timestamp - a.timestamp)
  );

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      
      if (!db.objectStoreNames.contains('boxes')) {
        db.createObjectStore('boxes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' });
      }

      if (event.oldVersion > 0 && event.oldVersion < 2 && transaction) {
        console.log('Migrating IndexedDB to version 2 (Base64 to Blob)...');
        const store = transaction.objectStore('items');
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const item = cursor.value as Item;
            if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
              item.imageBlob = base64ToBlob(item.imageUrl);
              item.imageUrl = ''; // Clear the large string
              cursor.update(item);
            }
            cursor.continue();
          }
        };
      }
    };

    request.onsuccess = async (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      await this.migrateFromLocalStorage();
      this.loadData();
    };
  }

  private async migrateFromLocalStorage() {
    const boxesJson = localStorage.getItem('clutter_boxes');
    const itemsJson = localStorage.getItem('clutter_items');

    if (!boxesJson && !itemsJson) return;

    console.log('Migrating data from LocalStorage to IndexedDB...');

    if (boxesJson) {
      try {
        const boxes: Box[] = JSON.parse(boxesJson);
        for (const box of boxes) {
          await this.putToStore('boxes', box);
        }
        localStorage.removeItem('clutter_boxes');
      } catch (e) {
        console.error('Error migrating boxes', e);
      }
    }

    if (itemsJson) {
      try {
        const items: Item[] = JSON.parse(itemsJson);
        for (const item of items) {
          await this.putToStore('items', item);
        }
        localStorage.removeItem('clutter_items');
      } catch (e) {
        console.error('Error migrating items', e);
      }
    }
  }

  private async loadData() {
    if (!this.db) return;

    try {
      const boxes = await this.getAllFromStore<Box>('boxes');
      const items = await this.getAllFromStore<Item>('items');

      // Generate Object URLs for Blobs
      items.forEach(item => {
        if (item.imageBlob && !item.imageUrl.startsWith('blob:')) {
          item.imageUrl = URL.createObjectURL(item.imageBlob);
        }
      });

      // Sort to ensure latest are first, matching original logic
      this.boxes.set(boxes.sort((a, b) => b.createdAt - a.createdAt));
      this.items.set(items.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error('Error loading data from DB', e);
    }
  }

  // --- Public API ---

  async addBox(name: string) {
    const newBox: Box = {
      id: crypto.randomUUID(),
      name,
      isFull: false,
      createdAt: Date.now()
    };

    // Optimistic update for UI responsiveness
    this.boxes.update(boxes => [newBox, ...boxes]);
    this.currentBoxId.set(newBox.id);

    await this.putToStore('boxes', newBox);
  }

  async addItem(boxId: string, itemData: Partial<Item>) {
    const box = this.boxes().find(b => b.id === boxId);
    if (!box) return;

    let imageBlob: Blob | undefined;
    let imageUrl = itemData.imageUrl || '';

    if (imageUrl.startsWith('data:image')) {
      imageBlob = base64ToBlob(imageUrl);
      imageUrl = URL.createObjectURL(imageBlob);
    }

    const newItem: Item = {
      id: crypto.randomUUID(),
      boxId,
      boxName: box.name,
      imageUrl,
      imageBlob,
      name: itemData.name || 'Unknown Item',
      description: itemData.description || '',
      tags: itemData.tags || [],
      timestamp: Date.now()
    };

    // Optimistic update
    this.items.update(items => [newItem, ...items]);

    await this.putToStore('items', newItem);
  }

  async updateBoxStatus(boxId: string, isFull: boolean) {
    const box = this.boxes().find(b => b.id === boxId);
    if (!box) return;
    
    const updatedBox = { ...box, isFull };
    
    // Optimistic update
    this.boxes.update(boxes => 
      boxes.map(b => b.id === boxId ? updatedBox : b)
    );

    await this.putToStore('boxes', updatedBox);
  }

  selectBox(boxId: string) {
    this.currentBoxId.set(boxId);
  }

  async updateItem(itemId: string, updates: Partial<Omit<Item, 'id'>>) {
    const item = this.items().find(i => i.id === itemId);
    if (!item) return;

    const updatedItem = { ...item, ...updates };

    if (updates.imageUrl && updates.imageUrl.startsWith('data:image')) {
      if (item.imageUrl && item.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.imageUrl);
      }
      updatedItem.imageBlob = base64ToBlob(updates.imageUrl);
      updatedItem.imageUrl = URL.createObjectURL(updatedItem.imageBlob);
    }

    // Optimistic update
    this.items.update(items =>
      items.map(i => i.id === itemId ? updatedItem : i)
    );

    await this.putToStore('items', updatedItem);
  }

  async deleteItem(itemId: string) {
    const item = this.items().find(i => i.id === itemId);
    if (item && item.imageUrl && item.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.imageUrl);
    }

    // Optimistic update
    this.items.update(items => items.filter(item => item.id !== itemId));
    
    await this.deleteFromStore('items', itemId);
  }

  async exportData(): Promise<string> {
    const boxes = await this.getAllFromStore<Box>('boxes');
    const items = await this.getAllFromStore<Item>('items');
    
    const exportItems = await Promise.all(items.map(async item => {
      const exportItem = { ...item };
      if (exportItem.imageBlob) {
        exportItem.imageUrl = await blobToBase64(exportItem.imageBlob);
        delete exportItem.imageBlob;
      }
      return exportItem;
    }));

    return JSON.stringify({ boxes, items: exportItems });
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      if (data.boxes && Array.isArray(data.boxes)) {
        for (const box of data.boxes) {
          await this.putToStore('boxes', box);
        }
      }
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
            item.imageBlob = base64ToBlob(item.imageUrl);
            item.imageUrl = '';
          }
          await this.putToStore('items', item);
        }
      }
      await this.loadData();
    } catch (e) {
      console.error('Failed to import data', e);
      throw e;
    }
  }

  // --- IndexedDB Helpers ---

  private putToStore(storeName: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('Database not initialized');
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('Database not initialized');
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private deleteFromStore(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('Database not initialized');
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}