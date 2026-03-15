import { writeFileSync } from 'fs';

const apiKey = process.env.GEMINI_API_KEY || '';
const content = `export const environment = {\n  API_KEY: '${apiKey}'\n};\n`;

writeFileSync('src/env.ts', content);
console.log('Generated src/env.ts with current environment variables.');
