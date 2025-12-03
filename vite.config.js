import { defineConfig } from 'vite';
// Se você usa React, descomente a linha abaixo
// import react from '@vitejs/plugin-react'; 

export default defineConfig({
  // Se estiver usando o plugin, descomente esta linha:
  // plugins: [react()], 

  build: {
    rollupOptions: {
      external: [
        'fs',    
        'path',  
      ],
    },
  },
})