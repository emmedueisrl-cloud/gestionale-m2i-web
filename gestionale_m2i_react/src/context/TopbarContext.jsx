import React, { useState } from 'react';
import { TopbarContext } from './topbarContextValue';

export const TopbarProvider = ({ children }) => {
  const [onBackClick, setOnBackClick] = useState(null);

  return (
    <TopbarContext.Provider value={{ onBackClick, setOnBackClick }}>
      {children}
    </TopbarContext.Provider>
  );
};
