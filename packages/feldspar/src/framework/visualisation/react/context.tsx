import React, { createContext, useState, useContext, ReactNode } from 'react';
import { JSX } from 'react';

interface VisualisationState {
  elements: JSX.Element[];
}

interface VisualisationContextType {
  state: VisualisationState;
  setState: (state: VisualisationState) => void;
}

const VisualisationContext = createContext<VisualisationContextType | undefined>(undefined);

export const VisualisationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<VisualisationState>({ elements: [] });

  return (
    <VisualisationContext.Provider value={{ state, setState }}>
      {children}
    </VisualisationContext.Provider>
  );
};

export const useVisualisation = () => {
  const context = useContext(VisualisationContext);
  if (!context) {
    throw new Error('useVisualisation must be used within a VisualisationProvider');
  }
  return context;
};
