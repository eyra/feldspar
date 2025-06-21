import { useEffect, useRef } from "react";
import Assembly from "../framework/assembly";
import { Bridge } from "../framework/types/modules";
import { LiveBridge } from "../live_bridge";
import FakeBridge from "../fake_bridge";
import React from "react";
import {
  VisualizationProvider,
  useVisualization,
} from "../framework/visualization/react/context";
import { PageFactory } from "../framework/visualization/react/factories/base";

export interface ScriptHostProps {
  workerUrl: string;
  locale?: string;
  standalone?: boolean;
  className?: string;
  factories?: PageFactory[];
}

const FeldsparContent: React.FC<ScriptHostProps> = ({
  workerUrl,
  locale = "en",
  standalone = false,
  className,
  factories = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const assemblyRef = useRef<Assembly | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const { setState, state } = useVisualization();

  useEffect(() => {
    if (!containerRef.current) return;

    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    const run = (bridge: Bridge, selectedLocale: string = locale) => {
      const assembly = new Assembly(worker, bridge, factories);
      assembly.visualizationEngine.start(
        containerRef.current!,
        selectedLocale,
        setState
      );
      assembly.processingEngine.start();
      assemblyRef.current = assembly;
    };

    if (!standalone && process.env.NODE_ENV === "production") {
      console.log("Initializing bridge system");
      LiveBridge.create(window, run);
    } else {
      console.log("Running with fake bridge");
      run(new FakeBridge());
    }

    const observer = new ResizeObserver(() => {
      const height = window.document.documentElement.getBoundingClientRect().height;
      window.parent.postMessage({ action: "resize", height }, "*");
    });

    observer.observe(window.document.body);

    // Send a message to the parent window indicating that the app has loaded. This is used
    // to trigger the setup of the channel between the iframe and the parent window.
    window.parent.postMessage({ action: 'app-loaded' }, '*')


    return () => {
      observer.disconnect();
      setTimeout(() => {
        assemblyRef.current?.visualizationEngine.terminate();
        assemblyRef.current?.processingEngine.terminate();
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
      }, 0);
    };
  }, [workerUrl, locale, standalone, setState, factories]);

  return (
    <div ref={containerRef} className={className}>
      {state.elements}
    </div>
  );
};

export const ScriptHostComponent = React.memo<ScriptHostProps>((props) => (
  <VisualizationProvider>
    <FeldsparContent {...props} />
  </VisualizationProvider>
), (prevProps, nextProps) => {
  // Don't re-render on factories change, since they always change every time 
  // they are created, which would cause unnecessary re-renders.
  return prevProps.workerUrl === nextProps.workerUrl &&
         prevProps.standalone === nextProps.standalone &&
         prevProps.locale === nextProps.locale &&
         prevProps.className === nextProps.className;
});
