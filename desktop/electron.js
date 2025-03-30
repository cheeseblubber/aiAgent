// This is a simple entry point for the built Electron app
import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import './dist/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This file is just a wrapper for the compiled main.js
// All the actual application logic is in main.js
