import React, { createContext, useState } from 'react';

export const TopbarContext = createContext();

export const TopbarProvider = ({ children }) => {
  const [onBackClick, setOnBackClick] = useState(null);

  return (
    <TopbarContext.Provider value={{ onBackClick, setOnBackClick }}>
      {children}
    </TopbarContext.Provider>
  );
};
