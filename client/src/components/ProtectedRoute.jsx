import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const ProtectedRoute = ({ children }) => {
  const { isLoggedin } = useContext(AppContext);

  // Simple redirect if not logged in
  if (!isLoggedin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute; 