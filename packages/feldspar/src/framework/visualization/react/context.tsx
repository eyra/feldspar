import React, { createContext, useState, useContext, ReactNode } from "react";
import { JSX } from "react";

interface VisualizationState {
  elements: JSX.Element[];
}

interface VisualizationContextType {
  state: VisualizationState;
  setState: (state: VisualizationState) => void;
}

const VisualizationContext = createContext<
  VisualizationContextType | undefined
>(undefined);

export const VisualizationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<VisualizationState>({ elements: [] });

  return (
    <VisualizationContext.Provider value={{ state, setState }}>
      {children}
    </VisualizationContext.Provider>
  );
};

export const useVisualization = () => {
  const context = useContext(VisualizationContext);
  if (!context) {
    throw new Error(
      "useVisualization must be used within a VisualizationProvider"
    );
  }
  return context;
};
