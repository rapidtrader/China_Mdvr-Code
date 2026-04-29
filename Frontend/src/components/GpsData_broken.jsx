import { useState, useEffect } from 'react';

const GpsData = () => {
  const [gpsData, setGpsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    // Get token from localStorage
    const storedToken = localStorage.getItem('authToken');
    if (!storedToken) {
      setError('No authentication token found. Please login again.');
      setLoading(false);
      return;
    }
    
    setToken(storedToken);
    fetchGpsData(storedToken);
  }, []);

  const fetchGpsData = async (authToken) => {
    try {
      setLoading(true);
      setError('');

      // First get device data to get device IDs
      const deviceResponse = await fetch('http://localhost:3001/api/devices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const deviceData = await deviceResponse.json();
      
      if (!deviceData.success || !deviceData.data?.data?.list) {
        setError('Failed to fetch device data');
        setLoading(false);
        return;
      }

      const deviceIds = deviceData.data.data.list.map(device => device.deviceId);
      
      if (deviceIds.length === 0) {
        setError('No devices found');
        setLoading(false);
        return;
      }

      // Now fetch GPS data for these devices
      const gpsResponse = await fetch('http://localhost:3001/api/gps/latest', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceIds })
      });

      const gpsResult = await gpsResponse.json();

      if (gpsResult.success) {
        // Handle real API response structure
        const gpsList = gpsResult.data?.data?.list || [];
        setGpsData(gpsList);
        console.log('Real GPS data fetched:', gpsResult.data);
      } else {
        setError(gpsResult.message || 'Failed to fetch GPS data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('GPS fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (token) {
      fetchGpsData(token);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getDirectionIcon = (direction) => {
    const icons = {
      'N': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      'S': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      'E': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      'W': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
    };
    return icons[direction] || icons['N'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GPS data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Latest GPS Data</h1>
          <p className="text-gray-600 mt-1">Real-time location tracking for all devices</p>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* GPS Statistics (updated for new structure) */
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Devices</dt>
                  <dd className="text-lg font-medium text-gray-900">{gpsData.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">ACC ON</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {gpsData.filter(device => device.gps?.statusFlags?.acc).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-600 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Moving</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {gpsData.filter(device => device.gps?.statusFlags?.moving).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Alarms</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {gpsData.filter(device => {
                      const alarms = device.gps?.alarmFlags;
                      return alarms && Object.values(alarms).some(alarm => alarm === true);
                    }).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-600 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">GPS Signal</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {gpsData.filter(device => device.gps?.statusFlags?.gpsPositioned).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

     
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gpsData.map((device) => {
          const gps = device.gps || {};
          const alarms = gps.alarmFlags || {};
          const status = gps.statusFlags || {};
          
          // Extract additional info
          let mileage = 0;
          let signalStrength = 0;
          let gnssCount = 0;
          
          if (gps.additionalInfos && Array.isArray(gps.additionalInfos)) {
            gps.additionalInfos.forEach(info => {
              if (info.id === 1) mileage = info.mileage || 0;
              if (info.id === 48) signalStrength = info.signalStrength || 0;
              if (info.id === 49) gnssCount = info.gnssCount || 0;
            });
          }

          return (
            <div key={device.deviceId} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{device.deviceId}</h3>
                    <p className="text-sm text-gray-500">GPS Tracking Device</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    status.acc 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {status.acc ? 'ACC ON' : 'ACC OFF'}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Coordinates:</span>
                    <span className="text-gray-900 font-medium">
                      {(gps.latitude || 0).toFixed(6)}, {(gps.longitude || 0).toFixed(6)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Speed:</span>
                    <span className="text-gray-900">{gps.speed || 0} km/h</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Direction:</span>
                    <span className="text-gray-900">{gps.direction || 0}°</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Altitude:</span>
                    <span className="text-gray-900">{gps.altitude || 0}m</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GNSS Count:</span>
                    <span className="text-gray-900">{gnssCount}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Signal:</span>
                    <span className="text-gray-900">{signalStrength}/31</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mileage:</span>
                    <span className="text-gray-900">{mileage} km</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Moving:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      status.moving 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {status.moving ? 'Moving' : 'Stopped'}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GPS Signal:</span>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-1 ${
                        status.gpsPositioned ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
                      <span className="text-gray-900">
                        {status.gpsPositioned ? 'Good' : 'Poor'}
                      </span>
                    </div>
                  </div>

                  {/* Show critical alarms */}
                  {Object.entries(alarms).filter(([key, value]) => value === true).length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <span className="text-sm font-medium text-red-600">Active Alarms:</span>
                      <div className="mt-1">
                        {Object.entries(alarms)
                          .filter(([key, value]) => value === true)
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <span key={key} className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          ))}
                        {Object.entries(alarms).filter(([key, value]) => value === true).length > 3 && (
                          <span className="text-xs text-gray-500">+{Object.entries(alarms).filter(([key, value]) => value === true).length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-sm text-gray-500 pt-2 border-t border-gray-100">
                    <span>Last Update: {gps.time ? formatDate(gps.time) : 'Not available'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GpsData;
