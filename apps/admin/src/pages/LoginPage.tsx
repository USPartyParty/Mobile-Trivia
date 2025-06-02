import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCodeIcon, KeyIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useToast } from '../context/ToastContext';

const LoginPage = () => {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Check if already logged in
  useEffect(() => {
    const existingToken = localStorage.getItem('adminToken');
    if (existingToken) {
      // Verify token validity before redirecting
      verifyToken(existingToken);
    }
  }, []);

  // Verify token by making a test request to the admin API
  const verifyToken = async (tokenToVerify: string) => {
    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`
        }
      });

      if (response.ok) {
        // Token is valid, redirect to admin dashboard
        localStorage.setItem('adminToken', tokenToVerify);
        showToast('Login successful', 'success');
        navigate('/admin');
      } else {
        // Token is invalid
        if (response.status === 401) {
          setError('Invalid admin token. Please try again.');
          localStorage.removeItem('adminToken');
        } else {
          setError(`Server error: ${response.statusText}`);
        }
      }
    } catch (err) {
      setError('Connection error. Please check your network and try again.');
      console.error('Login verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Admin token is required');
      return;
    }
    
    setError(null);
    verifyToken(token);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <QrCodeIcon className="h-16 w-16 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-blue-800 mb-2">Taps Tokens Trivia</h1>
          <h2 className="text-xl text-gray-600">Admin Access</h2>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="token" className="block text-gray-700 font-medium mb-2">
                Admin Token
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your admin token"
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Enter the admin token provided by your system administrator.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <span>Access Admin Panel</span>
                  <ArrowRightIcon className="h-5 w-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Taps Tokens Trivia
          <br />
          <span className="text-xs">Secure admin access only</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
