import { useEffect, useRef } from 'react'
import Assembly from '../framework/assembly'
import { Bridge } from '../framework/types/modules'
import LiveBridge from '../live_bridge'
import FakeBridge from '../fake_bridge'

interface FeldsparProps {
  workerUrl: string
  locale?: string
  standalone?: boolean
  className?: string
}

export const FeldsparComponent: React.FC<FeldsparProps> = ({
  workerUrl,
  locale = 'en',
  standalone = false,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const assemblyRef = useRef<Assembly | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const worker = new Worker(workerUrl)
    
    const run = (bridge: Bridge) => {
      const assembly = new Assembly(worker, bridge)
      assembly.visualisationEngine.start(containerRef.current!, locale)
      assembly.processingEngine.start()
      assemblyRef.current = assembly
    }

    if (!standalone && process.env.NODE_ENV === 'production') {
      LiveBridge.create(window, run)
    } else {
      run(new FakeBridge())
    }

    const observer = new ResizeObserver(() => {
      const height = window.document.body.scrollHeight
      window.parent.postMessage({ action: 'resize', height }, '*')
    })

    observer.observe(window.document.body)

    return () => {
      assemblyRef.current?.visualisationEngine.terminate()
      assemblyRef.current?.processingEngine.terminate()
      worker.terminate()
      observer.disconnect()
    }
  }, [workerUrl, locale, standalone])

  return <div ref={containerRef} className={className} />
}
