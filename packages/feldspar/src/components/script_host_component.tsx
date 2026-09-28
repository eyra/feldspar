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
import { LogLevel } from "../framework/logging";

export interface ScriptHostProps {
  workerUrl: string;
  locale?: string;
  standalone?: boolean;
  className?: string;
  factories?: PageFactory[];
  logLevel?: LogLevel;
}

const defaultFactories: PageFactory[] = [];

const FeldsparContent: React.FC<ScriptHostProps> = ({
  workerUrl,
  locale = "en",
  standalone = false,
  className,
  factories = defaultFactories,
  logLevel = "info",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setState, state } = useVisualization();

  useEffect(() => {
    if (!containerRef.current) return;

    let assembly: Assembly | null = null;
    let disposeBridge: (() => void) | undefined;

    const terminateAssembly = () => {
      if (!assembly) return;
      assembly.windowLogSource.dispose();
      assembly.visualizationEngine.terminate();
      assembly.processingEngine.terminate();
      assembly = null;
    };

    const run = (bridge: Bridge, selectedLocale: string = locale) => {
      terminateAssembly();
      setState({ elements: [] });
      const worker = new Worker(workerUrl);
      assembly = new Assembly(worker, bridge, selectedLocale, factories, logLevel);
      assembly.visualizationEngine.start(
        containerRef.current!,
        selectedLocale,
        setState
      );
      assembly.processingEngine.start();
    };

    if (!standalone && process.env.NODE_ENV === "production") {
      console.log("Initializing bridge system");
      disposeBridge = LiveBridge.create(window, run);
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
      disposeBridge?.();
      observer.disconnect();
      terminateAssembly();
    };
  }, [workerUrl, locale, standalone, setState, factories, logLevel]);

  return (
    <div ref={containerRef} className={className}>
      {state.elements}
    </div>
  );
};

export const ScriptHostComponent: React.FC<ScriptHostProps> = (props) => (
  <VisualizationProvider>
    <FeldsparContent {...props} />
  </VisualizationProvider>
);
