import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    /* Le chunk de la page de notes (Tiptap + ProseMirror) est volontairement
       isolé et chargé en lazy : son poids ne pèse pas sur le chargement initial. */
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /* Sépare les grosses dépendances stables dans leurs propres chunks :
           meilleur cache navigateur (elles changent rarement) et chargement
           parallélisé. Tiptap/lowlight partent surtout dans le chunk de la
           page de notes (chargée en lazy) ; ici on isole le socle. */
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
