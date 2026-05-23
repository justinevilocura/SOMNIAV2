// import React, { useState } from 'react';
// import { motion } from 'framer-motion';
// import { Link } from 'react-router-dom';
// import {
//   BellIcon,
//   MoonIcon,
//   ChartBarIcon,
//   ExclamationTriangleIcon,
//   CheckCircleIcon,
//   XMarkIcon,
//   ArrowLeftIcon
// } from '@heroicons/react/24/outline';

// const Notifications = () => {
//   const [notifications, setNotifications] = useState([
//     {
//       id: 1,
//       type: 'reminder',
//       title: 'Bedtime Reminder',
//       message: 'Your target bedtime is in 30 minutes. Start winding down now for better sleep.',
//       time: '9:30 PM',
//       icon: MoonIcon,
//       isRead: false,
//     },
//     {
//       id: 2,
//       type: 'alert',
//       title: 'Sleep Pattern Alert',
//       message: 'Your sleep duration has been below target for 3 consecutive nights. Consider adjusting your schedule.',
//       time: '2:15 PM',
//       icon: ExclamationTriangleIcon,
//       isRead: false,
//     },
//     {
//       id: 3,
//       type: 'insight',
//       title: 'Weekly Sleep Report',
//       message: 'Your sleep quality has improved by 15% this week. Keep up the good work!',
//       time: 'Yesterday',
//       icon: ChartBarIcon,
//       isRead: true,
//     },
//   ]);

//   const markAsRead = (id) => {
//     setNotifications(notifications.map(notif => 
//       notif.id === id ? { ...notif, isRead: true } : notif
//     ));
//   };

//   const deleteNotification = (id) => {
//     setNotifications(notifications.filter(notif => notif.id !== id));
//   };

//   const getTypeStyles = (type) => {
//     switch (type) {
//       case 'reminder':
//         return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
//       case 'alert':
//         return 'bg-red-500/10 text-red-400 border-red-500/30';
//       case 'insight':
//         return 'bg-green-500/10 text-green-400 border-green-500/30';
//       default:
//         return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
//     }
//   };

//   const NotificationCard = ({ notification }) => (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       className={`p-4 rounded-xl border ${notification.isRead ? 'bg-gray-900/30' : 'bg-gray-900/50'} 
//         border-gray-800/50 relative group`}
//     >
//       <div className="flex items-start space-x-4">
//         <div className={`p-2 rounded-lg ${getTypeStyles(notification.type)}`}>
//           <notification.icon className="w-5 h-5" />
//         </div>
//         <div className="flex-1">
//           <div className="flex items-start justify-between">
//             <div>
//               <h3 className="text-white font-light">{notification.title}</h3>
//               <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
//             </div>
//             <button
//               onClick={() => deleteNotification(notification.id)}
//               className="text-gray-500 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
//             >
//               <XMarkIcon className="w-5 h-5" />
//             </button>
//           </div>
//           <div className="flex items-center justify-between mt-4">
//             <span className="text-xs text-gray-500">{notification.time}</span>
//             {!notification.isRead && (
//               <button
//                 onClick={() => markAsRead(notification.id)}
//                 className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
//               >
//                 Mark as read
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </motion.div>
//   );

//   return (
//     <div className="min-h-screen bg-[#0A1628] p-8">
//       {/* Background gradients */}
//       <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      
//       <div className="max-w-2xl mx-auto space-y-8">
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
//               <h1 className="text-3xl font-light text-white">Notifications</h1>
//             </div>
//           </div>
//           <div className="relative">
//             <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
//               <span className="text-xs text-white">{notifications.filter(n => !n.isRead).length}</span>
//             </div>
//             <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-800/50">
//               <BellIcon className="w-6 h-6 text-gray-400" />
//             </div>
//           </div>
//         </div>

//         {/* Notifications List */}
//         <div className="space-y-4">
//           {notifications.length > 0 ? (
//             notifications.map((notification) => (
//               <NotificationCard key={notification.id} notification={notification} />
//             ))
//           ) : (
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               className="text-center py-12"
//             >
//               <CheckCircleIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
//               <p className="text-gray-400">No new notifications</p>
//             </motion.div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Notifications;