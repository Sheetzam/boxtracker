import { Component, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InventoryService, Item, Box } from './services/inventory.service';
import { GeminiService } from './services/gemini.service';
import { CameraComponent } from './components/camera.component';

declare var webkitSpeechRecognition: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CameraComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  inventory = inject(InventoryService);
  gemini = inject(GeminiService);

  @ViewChild(CameraComponent) camera!: CameraComponent;

  currentMode = signal<'add' | 'find'>('add');
  
  // State for Add Mode
  itemDescriptionControl = new FormControl('');
  isProcessing = signal(false);
  isListeningForItem = signal(false);
  isListeningForBox = signal(false);

  // State for Search Mode
  searchResults = signal<Item[]>([]);
  isSearching = signal(false);
  searchPerformed = signal(false);
  isListeningForSearch = signal(false);

  private recognition: any;

  constructor() {
    this.initSpeech();
  }

  setMode(mode: 'add' | 'find') {
    this.currentMode.set(mode);
    // Reset temporary states
    this.searchResults.set([]);
    this.searchPerformed.set(false);
    this.itemDescriptionControl.setValue('');
  }

  backToBoxList() {
    this.inventory.currentBoxId.set(null);
  }

  createNewBox(name: string) {
    if (!name.trim()) return;
    this.inventory.addBox(name.trim());
  }

  toggleBoxStatus(event: Event, box: Box) {
    event.stopPropagation(); // Prevent entering the box
    this.inventory.updateBoxStatus(box.id, !box.isFull);
  }

  finishOrOpenBox() {
    const currentBox = this.inventory.currentBox();
    if (!currentBox) return;

    if (currentBox.isFull) {
      // It is currently sealed, so we are "Re-opening" it
      this.inventory.updateBoxStatus(currentBox.id, false);
    } else {
      // It is active, so we are "Closing & Sealing" it
      this.inventory.updateBoxStatus(currentBox.id, true);
      // When sealing from the detail view, we typically go back to the list
      this.inventory.currentBoxId.set(null);
    }
  }

  triggerCapture() {
    if (this.camera) {
      this.camera.capture();
    }
  }

  async onImageCaptured(base64Image: string) {
    if (!this.inventory.currentBoxId()) return;
    
    // Double check sealed status
    if (this.inventory.currentBox()?.isFull) {
      alert('This box is sealed. Please re-open it to add items.');
      return;
    }

    this.isProcessing.set(true);
    const desc = this.itemDescriptionControl.value || 'No description provided.';
    
    try {
      // Analyze with Gemini
      const analysis = await this.gemini.analyzeItem(base64Image, desc);
      
      // Save to inventory
      this.inventory.addItem(this.inventory.currentBoxId()!, {
        imageUrl: base64Image,
        name: analysis.name,
        description: analysis.description,
        tags: analysis.tags
      });

      // Reset
      this.itemDescriptionControl.setValue('');
    } catch (e) {
      console.error(e);
      alert('Failed to analyze item. Please try again.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async performSearch(query: string) {
    if (!query.trim()) return;
    
    this.isSearching.set(true);
    this.searchPerformed.set(true);
    
    try {
      const allItems = this.inventory.items();
      const matchIds = await this.gemini.searchInventory(query, allItems);
      
      // Filter items based on returned IDs and preserve order if possible (or just filter)
      const results = allItems.filter(item => matchIds.includes(item.id));
      
      this.searchResults.set(results);
    } finally {
      this.isSearching.set(false);
    }
  }

  // --- Voice / Speech Logic ---

  private initSpeech() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.handleVoiceResult(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech error', event);
        this.stopListeningAll();
      };
      
      this.recognition.onend = () => {
        this.stopListeningAll();
      };
    }
  }

  private handleVoiceResult(text: string) {
    if (this.isListeningForBox()) {
      this.createNewBox(text);
    } 
    else if (this.isListeningForItem()) {
      // Append to description
      const current = this.itemDescriptionControl.value || '';
      this.itemDescriptionControl.setValue(current + (current ? ' ' : '') + text);
    } 
    else if (this.isListeningForSearch()) {
      // Execute search
      this.performSearch(text);
    }
    this.stopListeningAll();
  }

  toggleListeningForBox() {
    if (this.isListeningForBox()) {
      this.stopListeningAll();
    } else {
      this.startListening('box');
    }
  }

  toggleListeningForItem() {
    if (this.isListeningForItem()) {
      this.stopListeningAll();
    } else {
      this.startListening('item');
    }
  }

  toggleListeningForSearch() {
    if (this.isListeningForSearch()) {
      this.stopListeningAll();
    } else {
      this.startListening('search');
    }
  }

  private startListening(mode: 'box' | 'item' | 'search') {
    if (!this.recognition) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    
    // Stop any existing
    this.stopListeningAll();

    // Set flags
    if (mode === 'box') this.isListeningForBox.set(true);
    if (mode === 'item') this.isListeningForItem.set(true);
    if (mode === 'search') this.isListeningForSearch.set(true);

    this.recognition.start();
  }

  private stopListeningAll() {
    this.isListeningForBox.set(false);
    this.isListeningForItem.set(false);
    this.isListeningForSearch.set(false);
    try {
      this.recognition.stop();
    } catch(e) {}
  }
}