import { Injectable, signal, computed, effect } from '@angular/core';

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
  name: string;
  description: string;
  tags: string[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly STORAGE_KEY_BOXES = 'clutter_boxes';
  private readonly STORAGE_KEY_ITEMS = 'clutter_items';

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
    this.loadFromStorage();
    
    // Auto-save effect
    effect(() => {
      localStorage.setItem(this.STORAGE_KEY_BOXES, JSON.stringify(this.boxes()));
      localStorage.setItem(this.STORAGE_KEY_ITEMS, JSON.stringify(this.items()));
    });
  }

  private loadFromStorage() {
    const boxesData = localStorage.getItem(this.STORAGE_KEY_BOXES);
    const itemsData = localStorage.getItem(this.STORAGE_KEY_ITEMS);
    
    if (boxesData) this.boxes.set(JSON.parse(boxesData));
    if (itemsData) this.items.set(JSON.parse(itemsData));
  }

  addBox(name: string) {
    const newBox: Box = {
      id: crypto.randomUUID(),
      name,
      isFull: false,
      createdAt: Date.now()
    };
    this.boxes.update(boxes => [newBox, ...boxes]);
    this.currentBoxId.set(newBox.id);
  }

  addItem(boxId: string, itemData: Partial<Item>) {
    const box = this.boxes().find(b => b.id === boxId);
    if (!box) return;

    const newItem: Item = {
      id: crypto.randomUUID(),
      boxId,
      boxName: box.name,
      imageUrl: itemData.imageUrl || '',
      name: itemData.name || 'Unknown Item',
      description: itemData.description || '',
      tags: itemData.tags || [],
      timestamp: Date.now()
    };

    this.items.update(items => [newItem, ...items]);
  }

  updateBoxStatus(boxId: string, isFull: boolean) {
    this.boxes.update(boxes => 
      boxes.map(b => b.id === boxId ? { ...b, isFull } : b)
    );
  }

  selectBox(boxId: string) {
    this.currentBoxId.set(boxId);
  }

  updateItem(itemId: string, updates: Partial<Omit<Item, 'id'>>) {
    this.items.update(items =>
      items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }

  deleteItem(itemId: string) {
    this.items.update(items => items.filter(item => item.id !== itemId));
  }
}