import {defineConfig} from 'vite';
export default defineConfig({root:'web',worker:{format:'es'},build:{outDir:'../dist-step-prototype',emptyOutDir:true,assetsInlineLimit:0,rollupOptions:{input:'web/step-prototype.html'}},server:{host:'127.0.0.1',port:5182}});
