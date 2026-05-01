import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiUrl } from '../api';
import { reverseGeocode } from '../utils/geocode';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Direction arrow icon
const createDirectionIcon = (direction) => {
  return L.divIcon({
    className: 'direction-arrow',
    html: `<div style="
      transform: rotate(${direction}deg);
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Start marker icon (green)
const startIcon = L.divIcon({
  className: 'start-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #10B981;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 12px;
  ">S</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// End marker icon (red)
const endIcon = L.divIcon({
  className: 'end-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #EF4444;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 12px;
  ">E</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to auto-fit map bounds
const MapBounds = ({ positions }) => {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  
  return null;
};

const GpsTrackingTrail = ({ deviceId, token, onBack }) => {
  const [trailData, setTrailData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all'); // 'all', '1h', '6h', '24h', '7d'
  const [endPointAddress, setEndPointAddress] = useState('');

  useEffect(() => {
    fetchTrailData();
  }, [deviceId, token, selectedTimeRange]);

  const fetchTrailData = async () => {
    try {
      setLoading(true);
      setError('');

      const historyResponse = await fetch(apiUrl('/api/gps/mongo-history'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const historyResult = await historyResponse.json();

      if (historyResult.success) {
        const allHistory = historyResult.data?.data?.list || [];
        
        // Filter by device ID
        const deviceHistory = allHistory.filter(record => record.deviceId === deviceId);
        
        // Filter by time range
        const now = Date.now();
        let filteredData = deviceHistory;
        
        if (selectedTimeRange !== 'all') {
          const timeRanges = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
          };
          
          const cutoffTime = now - timeRanges[selectedTimeRange];
          filteredData = deviceHistory.filter(record => {
            const recordTime = record.gps?.time ? record.gps.time * 1000 : 0;
            return recordTime >= cutoffTime;
          });
        }
        
        // Sort by time (oldest first for trail)
        const sortedData = filteredData.sort((a, b) => {
          const timeA = a.gps?.time || 0;
          const timeB = b.gps?.time || 0;
          return timeA - timeB;
        });
        
        setTrailData(sortedData);
        
        // Fetch address for the end point (last position)
        if (sortedData.length > 0) {
          const lastPoint = sortedData[sortedData.length - 1];
          if (lastPoint.gps?.latitude && lastPoint.gps?.longitude) {
            try {
              const address = await reverseGeocode(lastPoint.gps.latitude, lastPoint.gps.longitude);
              setEndPointAddress(address);
            } catch (error) {
              console.error('Failed to fetch end point address:', error);
              setEndPointAddress('Address not available');
            }
          }
        }
      } else {
        setError(historyResult.message || 'Failed to fetch trail data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Trail fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Extract positions for the polyline
  const positions = useMemo(() => {
    return trailData
      .filter(record => record.gps?.latitude && record.gps?.longitude)
      .map(record => [record.gps.latitude, record.gps.longitude]);
  }, [trailData]);

  // Get statistics
  const stats = useMemo(() => {
    if (trailData.length === 0) return null;
    
    const validPoints = trailData.filter(r => r.gps?.latitude && r.gps?.longitude);
    if (validPoints.length === 0) return null;
    
    const totalDistance = validPoints.reduce((acc, curr, idx) => {
      if (idx === 0) return 0;
      const prev = validPoints[idx - 1];
      const dist = calculateDistance(
        prev.gps.latitude, prev.gps.longitude,
        curr.gps.latitude, curr.gps.longitude
      );
      return acc + dist;
    }, 0);
    
    const avgSpeed = validPoints.reduce((acc, curr) => acc + (curr.gps?.speed || 0), 0) / validPoints.length;
    const maxSpeed = Math.max(...validPoints.map(r => r.gps?.speed || 0));
    
    return {
      totalPoints: validPoints.length,
      totalDistance: totalDistance.toFixed(2),
      avgSpeed: avgSpeed.toFixed(1),
      maxSpeed: maxSpeed.toFixed(1),
      startTime: validPoints[0].gps?.time ? formatTime(validPoints[0].gps.time) : 'N/A',
      endTime: validPoints[validPoints.length - 1].gps?.time ? formatTime(validPoints[validPoints.length - 1].gps.time) : 'N/A',
    };
  }, [trailData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading GPS trail...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
            <button
              onClick={onBack}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              GPS Tracking Trail
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base lg:text-lg">
              Device: {deviceId} • {trailData.length} data points
            </p>
          </div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {['all', '1h', '6h', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedTimeRange === range
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === 'all' ? 'All Time' : 
               range === '1h' ? 'Last 1 Hour' :
               range === '6h' ? 'Last 6 Hours' :
               range === '24h' ? 'Last 24 Hours' : 'Last 7 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Total Distance</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalDistance} km</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Data Points</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalPoints}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Avg Speed</div>
            <div className="text-2xl font-bold text-gray-900">{stats.avgSpeed} km/h</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Max Speed</div>
            <div className="text-2xl font-bold text-gray-900">{stats.maxSpeed} km/h</div>
          </div>
        </div>
      )}

      {/* Map */}
      {positions.length > 0 ? (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-6">
          <div className="h-[500px] sm:h-[600px]">
            <MapContainer
              center={positions[0]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapBounds positions={positions} />
              
              {/* Draw the trail path */}
              <Polyline
                positions={positions}
                color="#667eea"
                weight={4}
                opacity={0.8}
                lineCap="round"
                lineJoin="round"
              />
              
              {/* Start marker */}
              {positions.length > 0 && (
                <Marker position={positions[0]} icon={startIcon}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold mb-1">Start Point</div>
                      <div>Time: {stats?.startTime}</div>
                      <div>Lat: {positions[0][0].toFixed(6)}</div>
                      <div>Lng: {positions[0][1].toFixed(6)}</div>
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* End marker */}
              {positions.length > 1 && (
                <Marker position={positions[positions.length - 1]} icon={endIcon}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold mb-1">End Point</div>
                      <div>Time: {stats?.endTime}</div>
                      <div>Lat: {positions[positions.length - 1][0].toFixed(6)}</div>
                      <div>Lng: {positions[positions.length - 1][1].toFixed(6)}</div>
                      {endPointAddress && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="font-semibold text-gray-700">Location:</div>
                          <div className="text-gray-600 leading-relaxed">{endPointAddress}</div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* Direction arrows at regular intervals */}
              {trailData
                .filter((record, idx) => idx % Math.max(1, Math.floor(trailData.length / 10)) === 0)
                .filter(record => record.gps?.latitude && record.gps?.longitude && record.gps?.direction)
                .map((record, idx) => (
                  <Marker
                    key={`dir-${idx}`}
                    position={[record.gps.latitude, record.gps.longitude]}
                    icon={createDirectionIcon(record.gps.direction || 0)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold mb-1">Direction: {record.gps.direction}°</div>
                        <div>Speed: {record.gps.speed || 0} km/h</div>
                        <div>Time: {formatTime(record.gps.time)}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 7m0 13V7" />
          </svg>
          <p className="text-gray-600 text-lg">No GPS trail data available</p>
          <p className="text-gray-500 text-sm mt-2">Select a different time range or check back later</p>
        </div>
      )}

      {/* Data Points Table */}
      {trailData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">GPS Data Points</h2>
          </div>
          <div className="max-h-[400px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr className="text-left text-gray-700">
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Latitude</th>
                  <th className="px-4 py-3 font-semibold">Longitude</th>
                  <th className="px-4 py-3 font-semibold">Speed</th>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Altitude</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trailData.map((record, idx) => {
                  const gps = record.gps || {};
                  return (
                    <tr key={idx} className="hover:bg-blue-50">
                      <td className="px-4 py-2 whitespace-nowrap">{gps.time ? formatTime(gps.time) : '—'}</td>
                      <td className="px-4 py-2 font-mono">{(gps.latitude ?? 0).toFixed(6)}</td>
                      <td className="px-4 py-2 font-mono">{(gps.longitude ?? 0).toFixed(6)}</td>
                      <td className="px-4 py-2">{gps.speed ?? 0} km/h</td>
                      <td className="px-4 py-2">{gps.direction ?? 0}°</td>
                      <td className="px-4 py-2">{gps.altitude ?? 0}m</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GpsTrackingTrail;
