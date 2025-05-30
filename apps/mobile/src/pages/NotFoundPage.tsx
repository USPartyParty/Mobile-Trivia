import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  HomeIcon,
  ArrowLeftIcon,
  QrCodeIcon, // Relevant for mobile context
} from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    // Check if there's a previous page in history, otherwise go to /join
    if (window.history.length > 2) { // 2 because current page and initial page
      navigate(-1);
    } else {
      navigate('/join', { replace: true });
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center text-center p-5 space-y-6 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-xs">
        {/* Icon and Main Message */}
        <div className="mb-6">
          <ExclamationTriangleIcon className="w-16 h-16 text-amber-500 mx-auto mb-3 animate-pulse-once" />
          <h1 className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">404</h1>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-1">
            Page Not Found
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
            Oops! The page you're looking for doesn't seem to exist or may have been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGoBack}
            className="btn btn-outline btn-full flex items-center justify-center"
            aria-label="Go to previous page"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Go Back
          </button>
          <Link
            to="/join"
            className="btn btn-primary btn-full flex items-center justify-center"
            aria-label="Go to Join Game page"
          >
            <HomeIcon className="w-5 h-5 mr-2" />
            Join a Game
          </Link>
        </div>

        {/* Helpful Suggestions for Mobile Users */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            What you can do:
          </h3>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 text-left list-disc list-inside pl-2">
            <li>Double-check the web address (URL) if you typed it.</li>
            <li>
              If you scanned a QR code, try scanning it again.
              <QrCodeIcon className="w-3 h-3 inline-block ml-1 align-middle" />
            </li>
            <li>Ensure your internet connection is stable.</li>
            <li>
              If you followed a link, it might be outdated.
            </li>
          </ul>
        </div>
      </div>
      
      {/* Subtle footer note */}
      <p className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-slate-400 dark:text-slate-500 px-4">
        If you believe this is an error, please ensure the session ID is correct or try joining a new game.
      </p>
    </div>
  );
};

export default NotFoundPage;
