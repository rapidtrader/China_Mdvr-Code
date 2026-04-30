import { useState } from 'react';

const DeviceCard = ({ device }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStateColor = (state) => {
    return state === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getStateText = (state) => {
    return state === 0 ? 'Active' : 'Inactive';
  };

  const getAccStateColor = (accState) => {
    return accState === 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getAccStateText = (accState) => {
    return accState === 0 ? 'OFF' : 'ON';
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-300">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{device.plateNumber}</h3>
            <p className="text-xs sm:text-sm text-gray-500">Device ID: {device.deviceId}</p>
          </div>
          <div className="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(device.state)}`}>
              {getStateText(device.state)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccStateColor(device.accState)}`}>
              ACC: {getAccStateText(device.accState)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Company:</span>
            <span className="text-gray-900 font-medium">{device.companyName}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Serial Number:</span>
            <span className="text-gray-900 font-medium text-xs">{device.sn}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Max Channels:</span>
            <span className="text-gray-900">{device.maxChannel}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Created:</span>
            <span className="text-gray-900">{formatDate(device.createdAt)}</span>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-4 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 px-4 rounded text-sm transition-colors duration-200"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-gray-500">Company ID:</span>
                <p className="text-gray-900 font-medium truncate">{device.companyId}</p>
              </div>
              <div>
                <span className="text-gray-500">Fleet ID:</span>
                <p className="text-gray-900 font-medium truncate">{device.fleetId}</p>
              </div>
              <div>
                <span className="text-gray-500">Fleet Name:</span>
                <p className="text-gray-900 font-medium truncate">{device.fleetName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Protocol:</span>
                <p className="text-gray-900 font-medium truncate">{device.protoType}</p>
              </div>
              <div>
                <span className="text-gray-500">Auto Update:</span>
                <p className="text-gray-900 font-medium">{device.isAutoUpdate ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-gray-500">Expiration:</span>
                <p className="text-gray-900 font-medium break-words">
                  {device.expirationTime > 0 ? formatDate(device.expirationTime) : 'Never'}
                </p>
              </div>
            </div>
            
            <div className="pt-2">
              <span className="text-gray-500 text-xs sm:text-sm">Last Updated:</span>
              <p className="text-gray-900 text-xs sm:text-sm break-words">{formatDate(device.updatedAt)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceCard;
