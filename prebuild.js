import fs from 'fs';
const key = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
fs.writeFileSync('src/env.ts', `export const GEMINI_API_KEY = ${JSON.stringify(key)};\n`);
