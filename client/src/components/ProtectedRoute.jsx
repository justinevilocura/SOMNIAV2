import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const ProtectedRoute = ({ children }) => {
  const { isLoggedin, userData } = useContext(AppContext);
  const location = useLocation();

  // Redirect to login/home if not logged in
  if (!isLoggedin) {
    return <Navigate to="/" replace />;
  }

  // If user is logged in but hasn't verified their email, gate them to /verify-email
  if (userData && !userData.isAccountVerified && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
};

export default ProtectedRoute;