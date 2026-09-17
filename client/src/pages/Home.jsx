import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NavigationBar from '../components/NavigationBar';
import Footer from '../components/Footer';
import phoneMockupImg from '../assets/somnia_phone_mockup.jpg';
import {
  ChartBarIcon,
  BoltIcon,
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  LightBulbIcon,
  SparklesIcon,
  ArrowPathIcon,
  ChartPieIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

const ProcessStep = ({ number, title, description, icon: Icon, color = 'blue' }) => {
  const colorMap = {
    cyan: {
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.25)]',
    },
    blue: {
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.25)]',
    },
    purple: {
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)]',
    },
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    },
  };

  const currentTheme = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-gray-900/70 border border-gray-800/80 rounded-2xl p-6 backdrop-blur-md hover:border-gray-700 transition-all duration-300"
    >
      <div className="flex items-start space-x-4">
        <div
          className={`flex-shrink-0 w-12 h-12 ${currentTheme.bg} rounded-full flex items-center justify-center border ${currentTheme.border} ${currentTheme.glow}`}
        >
          <Icon className={`w-6 h-6 ${currentTheme.text}`} />
        </div>
        <div>
          <div className={`text-xs uppercase tracking-widest font-semibold ${currentTheme.text} mb-1`}>
            STEP {number}
          </div>
          <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.div>
  );
};

const BenefitCard = ({ icon: Icon, title, description }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="bg-gray-900/80 rounded-2xl p-8 border border-gray-800 hover:border-blue-500/50 transition-all duration-300 hover:bg-gray-900/90"
  >
    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/10">
      <Icon className="w-7 h-7 text-white" />
    </div>
    <h3 className="text-xl font-light text-white mb-3">{title}</h3>
    <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

const Home = () => {
  const navigate = useNavigate();
  const [downloadModal, setDownloadModal] = useState({ open: false, platform: 'android' });

  const openDownload = (platform) => {
    setDownloadModal({ open: true, platform });
  };

  const closeDownload = () => {
    setDownloadModal({ open: false, platform: 'android' });
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[60%] left-0 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[180px] pointer-events-none" />

      {/* Subtle Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0v60M60 30H0' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10">
        <NavigationBar />

        {/* ===================== HERO SECTION ===================== */}
        <section className="pt-32 sm:pt-40 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="hero-section">
          <div className="text-center max-w-4xl mx-auto">
            {/* Pill Badge */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center px-4 py-1.5 bg-blue-500/10 rounded-full mb-6 border border-blue-500/25 backdrop-blur-md"
            >
              <ShieldCheckIcon className="w-4 h-4 text-blue-400 mr-2" />
              <span className="text-blue-300 text-xs sm:text-sm font-medium tracking-wider uppercase">
                AI-Powered Insomnia Prediction
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-light text-white mb-4 tracking-tight leading-tight"
            >
              Discover Your Insomnia Probability <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 text-transparent bg-clip-text font-normal">
                We Predict What You Might Not Feel
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed font-light mb-10"
            >
              Using advanced AI and your smartwatch data, <strong className="text-white font-medium">SOMNiA</strong>{' '}
              predicts potential sleep insomnia and provides personalized recommendations for better rest.
            </motion.p>

            {/* 3D Phone Mockup Showcase */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative max-w-md sm:max-w-lg mx-auto my-6"
            >
              {/* Glowing Aura behind the phone */}
              <div className="absolute inset-0 bg-gradient-to-t from-blue-500/25 via-indigo-500/20 to-transparent blur-3xl -z-10 transform scale-110" />

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(37,99,235,0.25)] border border-blue-500/20"
              >
                <img
                  src={phoneMockupImg}
                  alt="SOMNiA Mobile App Experience"
                  className="w-full h-auto object-cover select-none"
                  loading="eager"
                />
              </motion.div>
            </motion.div>

            {/* Download CTA Buttons matching Mobile Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
            >
              {/* Google Play / Android Button */}
              <button
                onClick={() => openDownload('android')}
                className="w-full sm:w-auto min-w-[210px] px-6 py-3.5 bg-[#0B1528] hover:bg-[#121F38] border border-gray-700/80 hover:border-blue-500/60 rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 transform hover:scale-[1.03] shadow-lg shadow-black/40 group"
              >
                {/* Android Robot Icon */}
                <svg className="w-7 h-7 text-[#3DDC84] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5802 8.423 13.849 8.087 12 8.087c-1.849 0-3.5802.336-5.1328.8627L4.8449 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
                </svg>
                <div className="text-left">
                  <div className="text-[11px] text-gray-400 font-light uppercase tracking-wider leading-none">Get it on</div>
                  <div className="text-base font-semibold text-white tracking-wide">Google Play / APK</div>
                </div>
              </button>

              {/* App Store / iOS Button */}
              <button
                onClick={() => openDownload('ios')}
                className="w-full sm:w-auto min-w-[210px] px-6 py-3.5 bg-[#0B1528] hover:bg-[#121F38] border border-gray-700/80 hover:border-blue-500/60 rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 transform hover:scale-[1.03] shadow-lg shadow-black/40 group"
              >
                {/* Apple Icon */}
                <svg className="w-7 h-7 text-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-2 .6-2.64 1.35-.56.65-.95 1.72-.82 2.74 1.01.08 1.91-.49 2.53-1.24z" />
                </svg>
                <div className="text-left">
                  <div className="text-[11px] text-gray-400 font-light uppercase tracking-wider leading-none">Get it on</div>
                  <div className="text-base font-semibold text-white tracking-wide">App Store / TestFlight</div>
                </div>
              </button>

              {/* Web Dashboard Direct Access */}
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 transform hover:scale-[1.03] shadow-lg shadow-blue-500/20 font-medium text-sm"
              >
                <span>Launch Web Dashboard</span>
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </section>

        {/* ===================== HOW IT WORKS SECTION ===================== */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto" id="how-it-works">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center space-x-3 mb-3">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-blue-400" />
              <h2 className="text-2xl sm:text-3xl font-light tracking-wide text-white uppercase">
                HOW <span className="text-blue-400 font-medium">SOMNiA</span> WORKS
              </h2>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-blue-400" />
            </div>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Our advanced AI system analyzes your wearable data to predict and prevent sleep issues
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProcessStep
              number="1"
              color="cyan"
              icon={DevicePhoneMobileIcon}
              title="Connect Your Device"
              description="Sync your smartwatch or fitness tracker to start collecting sleep and activity data."
            />
            <ProcessStep
              number="2"
              color="blue"
              icon={ChartPieIcon}
              title="Data Analysis"
              description="Our AI analyzes your sleep patterns, heart rate, movement, and other vital signs."
            />
            <ProcessStep
              number="3"
              color="purple"
              icon={LightBulbIcon}
              title="Risk Assessment"
              description="Advanced algorithms calculate your probability of developing sleep issues."
            />
            <ProcessStep
              number="4"
              color="emerald"
              icon={SparklesIcon}
              title="Personalized Insights"
              description="Receive tailored recommendations and early warnings based on your unique patterns."
            />
          </div>
        </section>

        {/* ===================== BENEFITS SECTION ===================== */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="why-choose">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl font-light text-white mb-3">Why Choose SOMNiA</h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
              Experience the clinical benefits of predictive sleep analysis
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <BenefitCard
              icon={BoltIcon}
              title="Early Detection"
              description="Identify potential sleep issues before they impact your daily cognitive performance."
            />
            <BenefitCard
              icon={ChartBarIcon}
              title="Smart Analytics"
              description="Gain comprehensive visibility into deep sleep, sleep debt, and autonomic recovery."
            />
            <BenefitCard
              icon={ArrowPathIcon}
              title="Real-time Updates"
              description="Continuous synchronization keeps your clinician or research portfolio updated."
            />
          </div>
        </section>

        <Footer />
      </div>

      {/* ===================== DOWNLOAD MODAL ===================== */}
      <AnimatePresence>
        {downloadModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0D1829] border border-gray-700/80 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative"
            >
              <button
                onClick={closeDownload}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>

              {downloadModal.platform === 'android' ? (
                <div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-[#3DDC84]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5802 8.423 13.849 8.087 12 8.087c-1.849 0-3.5802.336-5.1328.8627L4.8449 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Download for Android</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    Install the standalone SOMNiA Android APK on your phone or tablet. Connect your Mi Fitness or Health Connect app to sync your sleep telemetry.
                  </p>

                  <div className="space-y-3">
                    <a
                      href="https://expo.dev/accounts/jscvilocura/projects/somnia/builds/250d17a6-28fb-4975-8ebb-89f155b397bd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-medium text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <ArrowDownTrayIcon className="w-5 h-5" />
                      <span>Download Android APK (Direct)</span>
                    </a>

                    <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-3 text-xs text-gray-400">
                      <strong className="text-gray-300">Quick Note:</strong> Since this is a research preview build, your phone will prompt <em>&ldquo;Download anyway&rdquo;</em> and <em>&ldquo;Allow installs from this source&rdquo;</em>.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-2 .6-2.64 1.35-.56.65-.95 1.72-.82 2.74 1.01.08 1.91-.49 2.53-1.24z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Join SOMNiA for iOS</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    SOMNiA for iOS is distributed via Apple TestFlight for beta testing and research. Tap below to join our public testing channel.
                  </p>

                  <div className="space-y-3">
                    <a
                      href="https://testflight.apple.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <span>Join Apple TestFlight Beta</span>
                      <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                    </a>

                    <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-3 text-xs text-gray-400">
                      <strong className="text-gray-300">How to install:</strong> Download the official TestFlight app from the App Store, then click the link above to accept your invite.
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;