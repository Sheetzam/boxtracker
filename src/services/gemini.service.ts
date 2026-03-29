import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  async analyzeItem(imageBase64: string, userDescription: string) {
    const prompt = `
      Analyze this image and the user's description.
      Identify the item, provide a short name, a detailed description, and a list of searchable tags.
      If the image is blurry or unclear, try to guess based on context or return "Unknown Item".
      User Description: "${userDescription}"
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      return JSON.parse(response.text);
    } catch (error) {
      console.error('Gemini Analysis Error:', error);
      return {
        name: 'Unidentified Item',
        description: 'Could not analyze item. ' + userDescription,
        tags: ['unknown']
      };
    }
  }

  async determineIntent(text: string): Promise<{ intent: 'CREATE_BOX' | 'SEARCH' | 'UNKNOWN', data: string }> {
     const prompt = `
      Analyze the user's voice command: "${text}".
      Determine if they want to create/open a box OR search/find an item.
      Return JSON.
      intent: "CREATE_BOX" (if talking about making/starting a box), "SEARCH" (if looking for something), "UNKNOWN" otherwise.
      data: If CREATE_BOX, the box name. If SEARCH, the search query.
     `;

     try {
       const response = await this.ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: prompt,
         config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intent: { type: Type.STRING, enum: ['CREATE_BOX', 'SEARCH', 'UNKNOWN'] },
                data: { type: Type.STRING }
              }
            }
         }
       });
       return JSON.parse(response.text);
     } catch (e) {
       return { intent: 'UNKNOWN', data: '' };
     }
  }

  async searchInventory(query: string, items: any[]): Promise<string[]> {
    // We send a lightweight version of inventory to Gemini to filter
    const inventoryContext = items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      box: item.boxName,
      tags: item.tags.join(', ')
    }));

    const prompt = `
      User Query: "${query}"
      
      Below is a list of inventory items. Return a JSON object containing an array of 'matchIds' that are the best matches for the query. 
      Rank them by relevance. If no matches, return empty array.

      Inventory:
      ${JSON.stringify(inventoryContext)}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      const result = JSON.parse(response.text);
      return result.matchIds || [];
    } catch (error) {
      console.error('Search Error:', error);
      return [];
    }
  }
}