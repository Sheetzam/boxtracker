# ClutterAI Design Document

## 1. Overview
ClutterAI is a smart inventory management system designed to help users catalog and retrieve items from storage boxes using AI. By leveraging the device's camera and microphone, users can quickly scan boxes, identify contents automatically, and ask questions about their inventory using natural language.

## 2. Goals
- **Effortless Cataloging**: Reduce the friction of listing items by using computer vision to identify multiple objects in a single frame.
- **Smart Retrieval**: Allow users to ask "Where is my winter coat?" or "What's in Box 3?" using voice or text.
- **Visual Verification**: Store images of boxes and items for visual confirmation.

## 3. Architecture

### 3.1 Tech Stack
- **Framework**: Angular (Latest)
- **Styling**: Tailwind CSS
- **AI/ML**: Google Gemini API (via `@google/genai` SDK)
- **State Management**: RxJS (Angular default)
- **Build Tool**: Vite

### 3.2 Core Services
- **GeminiService**: Handles communication with the Google Gemini API.
  - Responsibilities: Sending image frames for analysis, processing natural language queries.
  - Model: `gemini-2.5-flash` for fast multimodal analysis.
- **InventoryService**: Manages the local state of items and boxes.
  - Responsibilities: CRUD operations for inventory items, searching, and filtering.

### 3.3 Key Components
- **AppComponent**: Main layout and orchestration.
- **CameraComponent**: Handles video stream capture, frame extraction, and user interaction for scanning.
- **InventoryListComponent**: Displays the cataloged items (planned).
- **VoiceInputComponent**: Handles microphone input for voice queries (planned).

## 4. User Flows

### 4.1 Scanning a Box
1. User opens the "Scan" mode.
2. Camera activates.
3. User points camera at an open box.
4. User taps "Capture" or "Analyze".
5. App sends the frame to Gemini API.
6. Gemini returns a list of identified items and a suggested label for the box.
7. User confirms or edits the list.
8. Inventory is updated.

### 4.2 Finding an Item
1. User types "Where are my hiking boots?" or uses voice input.
2. App queries the inventory state (or asks Gemini to interpret the query against the inventory data).
3. App displays the specific box containing the item.

## 5. Data Model (Draft)

```typescript
interface Item {
  id: string;
  name: string;
  category: string;
  description?: string;
  boxId: string;
  confidence: number;
}

interface Box {
  id: string;
  label: string; // e.g., "Garage Box 1"
  photoUrl?: string;
  location?: string;
  items: Item[];
}
```

## 6. Future Improvements
- Offline support using PWA capabilities.
- QR code generation for physical box labeling.
- Multi-user sync via Firebase or Supabase.
