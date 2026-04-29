import { useState, useEffect } from 'react';

const GpsData = () => {
  const [gpsData, setGpsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (!storedToken) {
      setError('No authentication token found. Please login again.');
      setLoading(false);
      return;
    }
    
    setToken(storedToken);
    fetchGpsData(storedToken);

    // Set up auto-refresh interval (every 1 minute)
    const interval = setInterval(() => {
      fetchGpsData(storedToken);
    }, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              GPS Tracking Dashboard
            </h1>
            <p className="text-gray-600 mt-2 text-lg">Real-time location monitoring and vehicle tracking</p>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center shadow-lg transform transition-all duration-200 hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      {/* GPS Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-gradient-to-br from-white to-blue-50 border border-blue-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Devices</dt>
                  <dd className="text-2xl font-bold text-gray-900">{gpsData.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-blue-50 border border-blue-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">ACC ON</dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {gpsData.filter(device => device.gps?.statusFlags?.acc).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-yellow-50 border border-yellow-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Moving</dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {gpsData.filter(device => device.gps?.statusFlags?.moving).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-red-50 border border-red-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Alarms</dt>
                  <dd className="text-2xl font-bold text-gray-900">
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

        <div className="bg-gradient-to-br from-white to-purple-50 border border-purple-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">GPS Signal</dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {gpsData.filter(device => device.gps?.statusFlags?.gpsPositioned).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Data Cards - Modern Design */}
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
            <div key={device.deviceId} className="bg-gradient-to-br from-white via-white to-blue-50 border border-blue-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{device.deviceId}</h3>
                    <p className="text-blue-100 text-sm">GPS Tracking Device</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    status.acc 
                      ? 'bg-green-500 text-white shadow-lg' 
                      : 'bg-gray-500 text-white shadow-lg'
                  }`}>
                    {status.acc ? 'ACC ON' : 'ACC OFF'}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                {/* Location Info */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="font-semibold text-gray-700">Coordinates</span>
                  </div>
                  <p className="text-lg font-mono text-gray-900">
                    {(gps.latitude || 0).toFixed(6)}, {(gps.longitude || 0).toFixed(6)}
                  </p>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl border border-green-200">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Speed</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{gps.speed || 0} km/h</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Direction</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{gps.direction || 0}°</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl border border-purple-200">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Altitude</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{gps.altitude || 0}m</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 rounded-xl border border-yellow-200">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Signal</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{signalStrength}/31</p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">GNSS Satellites</span>
                    <span className="text-lg font-bold text-gray-900">{gnssCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">Mileage</span>
                    <span className="text-lg font-bold text-gray-900">{mileage} km</span>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex gap-3 mb-6">
                  <div className={`flex-1 text-center p-3 rounded-xl font-semibold ${
                    status.moving 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {status.moving ? 'Moving' : 'Stopped'}
                  </div>
                  <div className={`flex-1 text-center p-3 rounded-xl font-semibold flex items-center justify-center ${
                    status.gpsPositioned 
                      ? 'bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg'
                      : 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-lg'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${status.gpsPositioned ? 'bg-white' : 'bg-white'}`}></div>
                    {status.gpsPositioned ? 'GPS Good' : 'GPS Poor'}
                  </div>
                </div>

                {/* Active Alarms */}
                {Object.entries(alarms).filter(([key, value]) => value === true).length > 0 && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="font-bold text-red-700">Active Alarms</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(alarms)
                        .filter(([key, value]) => value === true)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <span key={key} className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold shadow">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        ))}
                      {Object.entries(alarms).filter(([key, value]) => value === true).length > 3 && (
                        <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow">
                          +{Object.entries(alarms).filter(([key, value]) => value === true).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Last Update</span>
                    <span className="font-medium text-gray-900">
                      {gps.time ? formatDate(gps.time) : 'Not available'}
                    </span>
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
