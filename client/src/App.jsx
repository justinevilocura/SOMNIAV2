import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import EmailVerify from './pages/EmailVerify';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

// Import user pages
import Profile from './pages/user/Profile';
import SleepTips from './pages/user/SleepTips';
// import Notifications from './pages/user/Notifications';
import Help from './pages/user/Help';
// import Settings from './pages/user/Settings';

// Import components
import ProtectedRoute from './components/ProtectedRoute';
import {ToastContainer} from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const App = () => {
  return (
    <div>
      <ToastContainer/>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/register" element={<Register/>} />
        <Route path="/verify-email" element={<EmailVerify/>} />
        <Route path="/reset-password" element={<ResetPassword/>} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard/>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile/>
          </ProtectedRoute>
        } />
        <Route path="/sleep-tips" element={
          <ProtectedRoute>
            <SleepTips/>
          </ProtectedRoute>
        } />
        {/* <Route path="/notifications" element={
          <ProtectedRoute>
            <Notifications/>
          </ProtectedRoute>
        } /> */}
        <Route path="/help" element={
          <ProtectedRoute>
            <Help/>
          </ProtectedRoute>
        } />
        {/* <Route path="/settings" element={
          <ProtectedRoute>
            <Settings/>
          </ProtectedRoute>
        } /> */}
      </Routes>
    </div>
  );
};

export default App;
  