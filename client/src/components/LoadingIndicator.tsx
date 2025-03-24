import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p className="mt-4 text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
};

export default LoadingIndicator;
