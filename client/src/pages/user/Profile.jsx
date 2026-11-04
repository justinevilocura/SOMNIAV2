import React, { useContext, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { AppContext } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import {
  UserCircleIcon,
  DevicePhoneMobileIcon,
  KeyIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import Sidebar from '../../components/sidebar.jsx';

// Frontend-only age calculator
const calculateAge = (birthdate) => {
  if (!birthdate) return null;

  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

const Profile = () => {
  const { userData, backendUrl, refreshUserData } = useContext(AppContext);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, or WEBP)');
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be under 2MB');
      return;
    }

    try {
      setIsUploading(true);

      // Resize/compress and convert to Base64 via Canvas
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Get optimized base64 jpeg
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

          try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const { data } = await axios.post(
              `${backendUrl}/api/user/update-avatar`,
              { avatar: compressedBase64 },
              {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              }
            );

            if (data.success) {
              toast.success('Profile photo updated!');
              await refreshUserData();
            } else {
              toast.error(data.message || 'Failed to update photo');
            }
          } catch (err) {
            toast.error(err.response?.data?.message || 'Error uploading profile photo');
          } finally {
            setIsUploading(false);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      toast.error('Failed to read image file');
    }
  };

  const SettingItem = ({
    icon: Icon,
    title,
    description,
    action,
    type = 'link',
    to,
  }) => (
    <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl hover:bg-gray-900/50 transition-colors group">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="text-white">{title}</p>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
      {type === 'toggle' ? (
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" defaultChecked />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      ) : to ? (
        <Link
          to={to}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-sm">{action}</span>
        </Link>
      ) : (
        <button className="text-gray-400 hover:text-white transition-colors">
          <span className="text-sm">{action}</span>
        </button>
      )}
    </div>
  );

  // While user data is loading
  if (!userData) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading profile...
        </div>
      </div>
    );
  }

  const isVerified =
    userData?.isAccountVerified ||
    userData?.isVerified ||
    userData?.emailVerified;

  const age = calculateAge(userData?.birthdate);
  const gender = userData?.gender || 'Not set';

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      {/* Sidebar (fixed / overlay) */}
      <Sidebar />

      {/* Main content – add left padding so it never hides under sidebar */}
      <div
        className="
          flex-1 relative
          pl-20 pr-3          /* mobile: leave room for sidebar */
          sm:pl-24 sm:pr-6    /* tablet */
          lg:pl-55 lg:pr-12   /* desktop */
          py-4 sm:py-8
          overflow-y-auto
        "
      >
        {/* Background gradients */}
        <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-6xl w-full mx-auto space-y-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-light text-white">
              Profile Settings
            </h1>
          </div>

          {/* Profile Card */}
          <div className="bg-gray-900/50 rounded-2xl p-5 sm:p-6 lg:p-8 border border-gray-800/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Avatar + name */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div
                  onClick={handleAvatarClick}
                  className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-500/20 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-blue-500/30 hover:border-blue-400 transition-all shadow-lg"
                  title="Click to change profile photo"
                >
                  {userData.avatar ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400" />
                  )}

                  {/* Hover / Uploading Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-200">
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CameraIcon className="w-6 h-6 text-white mb-0.5" />
                        <span className="text-[10px] text-white font-medium">Change</span>
                      </>
                    )}
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />   <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl sm:text-2xl text-white font-light">
                      {userData.name}
                    </h2>

                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-gray-400">
                    Manage your personal information and account security.
                  </p>
                </div>
              </div>
            </div>

            {/* Info grid: Email / Age / Gender */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Email */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                  Email
                </p>
                <p className="text-sm text-gray-100 break-all">
                  {userData.email}
                </p>
              </div>

              {/* Age */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                  Age
                </p>
                <p className="text-sm text-gray-100">
                  {age !== null ? `${age} years` : '—'}
                </p>
              </div>

              {/* Gender */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                  Gender
                </p>
                <p className="text-sm text-gray-100">{gender}</p>
              </div>
            </div>
          </div>

          {/* Account Settings Card */}
          <div className="bg-gray-900/50 rounded-2xl p-5 sm:p-6 lg:p-8 border border-gray-800/50">
            <h3 className="text-lg sm:text-xl text-white font-light mb-4">
              Account Settings
            </h3>
            <div className="space-y-4">
              <SettingItem
                icon={KeyIcon}
                title="Change Password"
                description="Update your account password"
                action="Change >"
                to="/reset-password"
              />
              {/*
              <SettingItem
                icon={DevicePhoneMobileIcon}
                title="Connected Devices"
                description="Manage your connected devices"
                action="Manage >"
              />
              */}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
