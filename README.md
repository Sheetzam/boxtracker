<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a0b96797-fe8e-4f1f-b2ca-8a15ac6191e2

## Getting Started

Follow these instructions to get the app running locally on your machine.

### Prerequisites
* Node.js (v18 or higher recommended)
* npm (comes with Node.js)
* A Gemini API key (get one at [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd boxtracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Open your browser and navigate to `http://localhost:3000/`.
