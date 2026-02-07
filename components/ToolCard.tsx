import React from 'react';
import { ToolExecution } from '../types';

interface ToolCardProps {
  tool: ToolExecution;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const isEmergency = tool.name === 'dialEmergency';

  return (
    <div className={`w-full p-4 rounded-xl shadow-lg border ${
      isEmergency ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isEmergency ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
        }`}>
          {isEmergency ? (
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>
        
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${isEmergency ? 'text-red-700' : 'text-gray-900'}`}>
            {isEmergency ? 'Emergency Call' : 'Processing...'}
          </h3>
          <p className={`text-xs ${isEmergency ? 'text-red-600' : 'text-gray-500'}`}>
            {tool.name === 'dialEmergency' && 'Contacting 191...'}
            {tool.name === 'fileComplaint' && `Filing case: ${tool.args.category || 'General'}`}
            {tool.name === 'getNearestStation' && 'Locating station...'}
            {tool.name === 'checkReportStatus' && 'Checking status...'}
            {tool.name === 'bookAppointment' && 'Booking slot...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToolCard;