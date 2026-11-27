import {defineConfig} from 'vite';
import {buildUpdateWorker} from './build-update-worker.js';
export default defineConfig({base:'./',plugins:[buildUpdateWorker()]});
