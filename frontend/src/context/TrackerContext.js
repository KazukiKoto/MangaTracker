import { createContext, useContext } from "react";

export const TrackerContext = createContext(null);

export const useTracker = () => {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error("useTracker must be used within a TrackerContext.Provider");
  }
  return context;
};
