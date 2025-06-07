import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  plugins: {
    tailwindcss: {
      config: path.resolve(__dirname, '../feldspar/tailwind.config.js')
    },
    autoprefixer: {}
  }
}
