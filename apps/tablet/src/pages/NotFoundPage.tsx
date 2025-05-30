import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  HomeIcon,
  ArrowLeftIcon,
  QuestionMarkCircleIcon,
  QrCodeIcon,
  TrophyIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Handle back navigation
  const handleGoBack = () => {
    navigate(-1);
  };
  
  // Common paths that users might be looking for
  const commonPaths = [
    {
      name: 'Home Page',
      description: 'Return to the main page',
      path: '/',
      icon: <HomeIcon className="w-5 h-5" />,
    },
    {
      name: 'QR Display',
      description: 'Show QR code for session joining',
      path: '/qr/new',
      icon: <QrCodeIcon className="w-5 h-5" />,
    },
    {
      name: 'Leaderboard',
      description: 'View top scores',
      path: '/leaderboard',
      icon: <TrophyIcon className="w-5 h-5" />,
    },
    {
      name: 'Start Game',
      description: 'Create a new game session',
      path: '/',
      icon: <PlayIcon className="w-5 h-5" />,
    },
  ];
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 text-center">
      {/* 404 Header */}
      <div className="mb-8">
        <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full dark:bg-red-900/30">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="mb-2 text-6xl font-extrabold text-indigo-600 dark:text-indigo-400">
          404
        </h1>
        <h2 className="mb-4 text-3xl font-bold text-slate-800 dark:text-slate-200">
          Page Not Found
        </h2>
        <p className="max-w-md mx-auto text-lg text-slate-600 dark:text-slate-300">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
        <button
          onClick={handleGoBack}
          className="flex items-center px-6 py-3 font-medium transition-colors border-2 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Go Back
        </button>
        
        <Link
          to="/"
          className="flex items-center px-6 py-3 font-medium text-white transition-colors rounded-lg bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <HomeIcon className="w-5 h-5 mr-2" />
          Go Home
        </Link>
      </div>
      
      {/* Suggested Pages */}
      <div className="w-full max-w-2xl">
        <h3 className="flex items-center justify-center mb-6 text-xl font-bold text-slate-800 dark:text-slate-200">
          <QuestionMarkCircleIcon className="w-6 h-6 mr-2 text-indigo-500" />
          Looking for one of these pages?
        </h3>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {commonPaths.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              className="flex items-center p-4 transition-all duration-200 bg-white border rounded-lg shadow-sm dark:bg-slate-800 dark:border-slate-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700"
            >
              <div className="flex items-center justify-center w-10 h-10 mr-4 bg-indigo-100 rounded-full dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                {item.icon}
              </div>
              <div className="text-left">
                <h4 className="font-medium text-slate-800 dark:text-slate-200">{item.name}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Help Text */}
      <div className="mt-12 text-sm text-slate-500 dark:text-slate-400">
        If you believe this is an error, please contact support or try refreshing the page.
      </div>
    </div>
  );
};

export default NotFoundPage;
