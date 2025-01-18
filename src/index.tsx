import './fonts.css'
import './framework/styles.css'
import { createRoot } from 'react-dom/client'
import { FeldsparComponent } from './components/FeldsparComponent'

const rootElement = document.getElementById('root') as HTMLElement
const root = createRoot(rootElement)

const workerUrl = new URL('./framework/processing/py_worker.js', import.meta.url).href

root.render(
  <FeldsparComponent 
    workerUrl={workerUrl}
    standalone={process.env.REACT_APP_BUILD === 'standalone'}
  />
)
