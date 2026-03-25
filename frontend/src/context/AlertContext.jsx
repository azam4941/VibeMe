import React, { createContext, useContext, useState, useCallback } from 'react';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((message, type = 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  }, []);

  const hideAlert = useCallback(() => setAlert(null), []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alert && (
        <div className={`global-alert alert-${alert.type}`}>
          <div className="alert-content">
            <span className="alert-message">{alert.message}</span>
            <button className="alert-close" onClick={hideAlert}>&times;</button>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
};
