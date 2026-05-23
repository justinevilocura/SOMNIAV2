import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NavigationBar from '../components/NavigationBar';
import Footer from '../components/Footer';
import {
  ChartBarIcon,
  BoltIcon,
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  LightBulbIcon,
  SparklesIcon,
  ArrowPathIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline';

const ProcessStep = ({ number, title, description, icon: Icon }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="flex items-start space-x-4"
  >
    <div className="flex-shrink-0 w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
      <Icon className="w-6 h-6 text-blue-400" />
    </div>
    <div>
      <div className="text-sm text-blue-400 font-medium mb-1">Step {number}</div>
      <h3 className="text-lg text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

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

  return (
    <div className="min-h-screen bg-[#0A1628]">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-gray-900/50" />
      
      {/* Medical cross pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0v60M60 30H0' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px'
        }}
      />

      {/* Radial gradient for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-gray-900/80" />

      <div className="relative z-10">
        <NavigationBar />

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pt-40 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
          id="hero-section"
        >
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center px-4 py-2 bg-blue-500/10 rounded-full mb-8 border border-blue-500/20"
            >
              <ShieldCheckIcon className="w-5 h-5 text-blue-400 mr-2" />
              <span className="text-blue-400 text-sm font-light tracking-wider uppercase">AI-Powered Insomnia Prediction</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-6xl font-light text-white mb-6 tracking-tight"
            >
              Discover Your Insomnia Probability  <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-blue-400 to-blue-500 text-transparent bg-clip-text">We Predict What You Might Not Feel</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed font-light"
            >
              Using advanced AI and your smartwatch data, SOMNiA predicts potential sleep insomnia
              and provides personalized recommendations for better rest.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            >
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-xl shadow-blue-500/20 font-medium"
              >
                Start Tracking Your Sleep
              </button>
             
            </motion.div>
          </div>
        </motion.section>

        {/* How It Works Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="how-it-works">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-light text-white mb-4">How SOMNiA Works</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Our advanced AI system analyzes your wearable data to predict and prevent sleep issues
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <ProcessStep
              number="1"
              icon={DevicePhoneMobileIcon}
              title="Connect Your Device"
              description="Sync your smartwatch or fitness tracker to start collecting sleep and activity data."
            />
            <ProcessStep
              number="2"
              icon={ChartPieIcon}
              title="Data Analysis"
              description="Our AI analyzes your sleep patterns, heart rate, movement, and other vital signs."
            />
            <ProcessStep
              number="3"
              icon={LightBulbIcon}
              title="Risk Assessment"
              description="Advanced algorithms calculate your probability of developing sleep issues."
            />
            <ProcessStep
              number="4"
              icon={SparklesIcon}
              title="Personalized Insights"
              description="Receive tailored recommendations and early warnings based on your unique patterns."
            />
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="why-choose">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-light text-white mb-4">Why Choose SOMNiA</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Experience the benefits of predictive sleep analysis
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <BenefitCard
              icon={BoltIcon}
              title="Early Detection"
              description="Identify potential sleep issues before they become serious problems."
            />
            <BenefitCard
              icon={ChartBarIcon}
              title="Smart Analytics"
              description="Get detailed insights into your sleep patterns and risk factors."
            />
            <BenefitCard
              icon={ArrowPathIcon}
              title="Real-time Updates"
              description="Continuous monitoring and updates to your sleep risk assessment."
            />
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
};

export default Home;