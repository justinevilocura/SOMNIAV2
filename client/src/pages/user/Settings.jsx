// import React, { useState } from 'react';
// import { motion } from 'framer-motion';
// import { Link } from 'react-router-dom';
// import {
//   Cog6ToothIcon,
//   BellIcon,
//   ShieldCheckIcon,
//   DevicePhoneMobileIcon,
//   CloudIcon,
//   LanguageIcon,
//   MoonIcon,
//   ArrowLeftIcon
// } from '@heroicons/react/24/outline';

// const Settings = () => {
//   const [settings, setSettings] = useState({
//     notifications: {
//       bedtimeReminder: true,
//       weeklyReport: true,
//       sleepGoalAlerts: true,
//       emailNotifications: false,
//     },
//     privacy: {
//       shareAnalytics: true,
//       sleepDataSync: true,
//       locationServices: false,
//     },
//     appearance: {
//       darkMode: true,
//       compactView: false,
//     },
//     language: 'English',
//     dataSync: {
//       autoSync: true,
//       syncInterval: '30',
//     },
//   });

//   const languages = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese'];
//   const syncIntervals = ['15', '30', '60'];

//   const SettingSection = ({ title, icon: Icon, children }) => (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800/50"
//     >
//       <div className="flex items-center space-x-3 mb-6">
//         <div className="p-2 bg-blue-500/10 rounded-lg">
//           <Icon className="w-6 h-6 text-blue-400" />
//         </div>
//         <h2 className="text-xl text-white font-light">{title}</h2>
//       </div>
//       <div className="space-y-4">
//         {children}
//       </div>
//     </motion.div>
//   );

//   const ToggleSetting = ({ label, description, value, onChange }) => (
//     <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl">
//       <div>
//         <p className="text-white">{label}</p>
//         <p className="text-sm text-gray-400">{description}</p>
//       </div>
//       <label className="relative inline-flex items-center cursor-pointer">
//         <input
//           type="checkbox"
//           className="sr-only peer"
//           checked={value}
//           onChange={onChange}
//         />
//         <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
//       </label>
//     </div>
//   );

//   const SelectSetting = ({ label, description, value, options, onChange }) => (
//     <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl">
//       <div>
//         <p className="text-white">{label}</p>
//         <p className="text-sm text-gray-400">{description}</p>
//       </div>
//       <select
//         value={value}
//         onChange={onChange}
//         className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
//       >
//         {options.map((option) => (
//           <option key={option} value={option}>
//             {option}
//           </option>
//         ))}
//       </select>
//     </div>
//   );

//   return (
//     <div className="min-h-screen bg-[#0A1628] p-8">
//       {/* Background gradients */}
//       <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      
//       <div className="max-w-4xl mx-auto space-y-8">
//         {/* Header */}
//         <div className="flex items-center justify-between">
//           <div className="flex items-center space-x-4">
//             <Link 
//               to="/dashboard" 
//               className="p-2 bg-gray-900/50 text-gray-400 rounded-lg hover:bg-gray-800/50 hover:text-white transition-all duration-200 border border-gray-800/50"
//             >
//               <ArrowLeftIcon className="w-5 h-5" />
//             </Link>
//             <div>
//               <h1 className="text-3xl font-light text-white">Settings</h1>
              
//             </div>
//           </div>
//         </div>

//         {/* Settings Sections */}
//         <div className="space-y-6">
//           <SettingSection title="Notifications" icon={BellIcon}>
//             <ToggleSetting
//               label="Bedtime Reminder"
//               description="Get notified before your target bedtime"
//               value={settings.notifications.bedtimeReminder}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 notifications: { ...settings.notifications, bedtimeReminder: e.target.checked }
//               })}
//             />
//             <ToggleSetting
//               label="Weekly Sleep Report"
//               description="Receive a summary of your sleep patterns"
//               value={settings.notifications.weeklyReport}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 notifications: { ...settings.notifications, weeklyReport: e.target.checked }
//               })}
//             />
//           </SettingSection>

//           <SettingSection title="Privacy" icon={ShieldCheckIcon}>
//             <ToggleSetting
//               label="Share Analytics"
//               description="Help improve SOMNiA with anonymous data"
//               value={settings.privacy.shareAnalytics}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 privacy: { ...settings.privacy, shareAnalytics: e.target.checked }
//               })}
//             />
//             <ToggleSetting
//               label="Sleep Data Sync"
//               description="Sync sleep data across devices"
//               value={settings.privacy.sleepDataSync}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 privacy: { ...settings.privacy, sleepDataSync: e.target.checked }
//               })}
//             />
//           </SettingSection>

//           <SettingSection title="Appearance" icon={MoonIcon}>
//             <ToggleSetting
//               label="Dark Mode"
//               description="Use dark theme throughout the app"
//               value={settings.appearance.darkMode}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 appearance: { ...settings.appearance, darkMode: e.target.checked }
//               })}
//             />
//           </SettingSection>

//           <SettingSection title="Language & Region" icon={LanguageIcon}>
//             <SelectSetting
//               label="Language"
//               description="Choose your preferred language"
//               value={settings.language}
//               options={languages}
//               onChange={(e) => setSettings({ ...settings, language: e.target.value })}
//             />
//           </SettingSection>

//           <SettingSection title="Data Sync" icon={CloudIcon}>
//             <ToggleSetting
//               label="Auto-Sync"
//               description="Automatically sync data with cloud"
//               value={settings.dataSync.autoSync}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 dataSync: { ...settings.dataSync, autoSync: e.target.checked }
//               })}
//             />
//             <SelectSetting
//               label="Sync Interval"
//               description="Choose how often to sync data (minutes)"
//               value={settings.dataSync.syncInterval}
//               options={syncIntervals}
//               onChange={(e) => setSettings({
//                 ...settings,
//                 dataSync: { ...settings.dataSync, syncInterval: e.target.value }
//               })}
//             />
//           </SettingSection>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Settings;