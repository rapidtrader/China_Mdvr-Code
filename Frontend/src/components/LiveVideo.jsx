import { useState, useEffect, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import flvjs from 'flv.js';

const getVideoListFromResponse = (videoResult) => {
  const possibleLists = [
    videoResult?.data?.data?.videos,
    videoResult?.data?.videos,
    videoResult?.data?.data?.list,
    videoResult?.data?.list
  ];

  const firstList = possibleLists.find((list) => Array.isArray(list));
  return firstList || [];
};

const buildZlmHttpFallbackUrl = (rawUrl, targetType) => {
  try {
    const parsedUrl = new URL(rawUrl);
    const app = parsedUrl.searchParams.get('app');
    const stream = parsedUrl.searchParams.get('stream');

    if (!app || !stream) {
      return '';
    }

    if (targetType === 'flv') {
      return `${parsedUrl.protocol}//${parsedUrl.host}/${app}/${stream}.live.flv`;
    }

    if (targetType === 'hls') {
      return `${parsedUrl.protocol}//${parsedUrl.host}/${app}/${stream}/hls.m3u8`;
    }

    return '';
  } catch (_error) {
    return '';
  }
};

const getPlayableCandidates = (video) => {
  const directCandidates = [
    video?.hlsUrl,
    video?.hlsURL,
    video?.flvUrl,
    video?.flvURL,
    video?.wsFlv,
    video?.playUrl,
    video?.playURL,
    video?.url,
    video?.videoUrl
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);

  const webrtcCandidate = directCandidates.find((item) =>
    item.toLowerCase().includes('/index/api/webrtc')
  );

  if (webrtcCandidate) {
    const hlsFallback = buildZlmHttpFallbackUrl(webrtcCandidate, 'hls');
    const flvFallback = buildZlmHttpFallbackUrl(webrtcCandidate, 'flv');
    return [hlsFallback, flvFallback, ...directCandidates].filter(Boolean);
  }

  return directCandidates;
};

const getPlayableUrl = (video) => getPlayableCandidates(video)[0] || '';
const isWebRtcOnlyUrl = (url) => typeof url === 'string' && url.toLowerCase().includes('/index/api/webrtc');

const StreamPlayer = ({ video, uniqueKey }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const flvRef = useRef(null);
  const playCandidates = useMemo(() => getPlayableCandidates(video), [video]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const playUrl = playCandidates[candidateIndex] || '';

  useEffect(() => {
    setCandidateIndex(0);
  }, [uniqueKey]);

  const tryNextCandidate = () => {
    setCandidateIndex((prev) => {
      if (prev < playCandidates.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  };

  useEffect(() => {
    const player = videoRef.current;

    if (!player || !playUrl) {
      return undefined;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (flvRef.current) {
      flvRef.current.destroy();
      flvRef.current = null;
    }

    const lowerUrl = playUrl.toLowerCase();
    const isHlsStream = lowerUrl.includes('.m3u8');
    const isFlvStream = lowerUrl.includes('.flv');

    if (isFlvStream && flvjs.isSupported()) {
      const flvPlayer = flvjs.createPlayer(
        {
          type: 'flv',
          url: playUrl,
          isLive: true
        },
        {
          enableStashBuffer: false
        }
      );
      flvPlayer.attachMediaElement(player);
      flvPlayer.load();
      flvPlayer.play().catch(() => {
        tryNextCandidate();
      });
      flvPlayer.on(flvjs.Events.ERROR, () => {
        tryNextCandidate();
      });
      flvRef.current = flvPlayer;
    } else if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(playUrl);
      hls.attachMedia(player);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) {
          tryNextCandidate();
        }
      });
      hlsRef.current = hls;
    } else {
      player.src = playUrl;
    }

    const onVideoError = () => {
      console.error('Video playback error:', {
        url: playUrl,
        candidates: playCandidates,
        candidateIndex,
        mediaError: player.error,
        deviceId: video?.deviceId,
        channel: video?.channel
      });
      tryNextCandidate();
    };

    player.addEventListener('error', onVideoError);
    player.play().catch(() => {
      // Autoplay may fail due to browser policies.
    });

    return () => {
      player.removeEventListener('error', onVideoError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (flvRef.current) {
        flvRef.current.destroy();
        flvRef.current = null;
      }
    };
  }, [candidateIndex, playCandidates, playUrl, uniqueKey]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain"
      controls
      autoPlay
      muted
      playsInline
    >
      Your browser does not support the video tag.
    </video>
  );
};

const LiveVideo = () => {
  const [videoData, setVideoData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [token, setToken] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(6);
  const [deviceIds, setDeviceIds] = useState([]);

  useEffect(() => {
    // Get token from localStorage
    const storedToken = localStorage.getItem('authToken');
    if (!storedToken) {
      setError('No authentication token found. Please login again.');
      setLoading(false);
      return;
    }
    
    setToken(storedToken);
    fetchDeviceData(storedToken);

    // Set up auto-refresh interval (every 1 minute)
    const interval = setInterval(() => {
      fetchDeviceData(storedToken);
    }, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const fetchDeviceData = async (authToken) => {
    try {
      setLoading(true);
      setError('');
      setWarning('');

      // Get device data to get device IDs
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
      setDeviceIds(deviceIds);
      
      if (deviceIds.length > 0) {
        setSelectedDevice(deviceIds[0]);
        fetchVideoPreview(authToken, deviceIds[0]);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Device fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideoPreview = async (authToken, deviceId, channel = selectedChannel) => {
    try {
      setLoading(true);
      setError('');

      const playFormatCandidates = [2, 1, 0, 3];
      let selectedVideoResult = null;
      let selectedVideoList = [];

      for (const playFormat of playFormatCandidates) {
        const videoResponse = await fetch('http://localhost:3001/api/media/previewVideo', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            deviceId,
            channels: [channel],
            dataType: 1,
            streamType: 1,
            playFormat
          })
        });

        const videoResult = await videoResponse.json();
        if (!videoResult.success) {
          continue;
        }

        const videoList = getVideoListFromResponse(videoResult);
        if (videoList.length === 0) {
          continue;
        }

        selectedVideoResult = videoResult;
        selectedVideoList = videoList;

        // Prefer non-WebRTC media URLs for browser playback.
        const hasDirectMediaUrl = videoList.some((item) => !isWebRtcOnlyUrl(getPlayableUrl(item)));
        if (hasDirectMediaUrl) {
          break;
        }
      }

      if (selectedVideoResult) {
        setVideoData(selectedVideoList);
        console.log('Real video preview data fetched:', selectedVideoResult.data);

        const onlyWebRtc = selectedVideoList.every((item) => isWebRtcOnlyUrl(getPlayableUrl(item)));
        if (onlyWebRtc) {
          setWarning('Server is returning WebRTC-only URL. HLS/FLV stream is not available on this channel.');
        }
      } else {
        setError('Failed to fetch video preview');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Video preview fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceChange = (deviceId) => {
    setSelectedDevice(deviceId);
    if (token) {
      fetchVideoPreview(token, deviceId);
    }
  };

  const handleChannelChange = (channel) => {
    setSelectedChannel(channel);
    if (token && selectedDevice) {
      fetchVideoPreview(token, selectedDevice, channel);
    }
  };

  const handleRefresh = () => {
    if (token && selectedDevice) {
      fetchVideoPreview(token, selectedDevice);
    }
  };

  if (loading && videoData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video preview...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Live Video Preview</h1>
          <p className="text-gray-600 mt-1">Real-time video streaming from MDVR devices</p>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow transition-colors duration-200"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {warning && (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {warning}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Device</label>
            <select
              value={selectedDevice}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {deviceIds.map(deviceId => (
                <option key={deviceId} value={deviceId}>{deviceId}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Channel</label>
            <select
              value={selectedChannel}
              onChange={(e) => handleChannelChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1}>Channel 1</option>
              <option value={2}>Channel 2</option>
              <option value={3}>Channel 3</option>
              <option value={4}>Channel 4</option>
              <option value={5}>Channel 5</option>
              <option value={6}>Channel 6</option>
              <option value={7}>Channel 7</option>
              <option value={8}>Channel 8</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${videoData.length > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm text-gray-600">
                {videoData.length > 0 ? 'Stream Active' : 'No Stream'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videoData.map((video, index) => (
          <div key={`${video.deviceId}_${video.channel}`} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-900 aspect-video relative">
              {video.errCode === 0 && getPlayableUrl(video) ? (
                <StreamPlayer
                  video={video}
                  uniqueKey={`${video.deviceId}_${video.channel}_${selectedChannel}`}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-white">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400">Video Stream Unavailable</p>
                    <p className="text-sm text-gray-500 mt-2">{video.errDesc || 'Connection error'}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Channel {video.channel}</h3>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  video.errCode === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {video.errCode === 0 ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Device ID:</span>
                  <span className="font-medium text-gray-900">{video.deviceId}</span>
                </div>
                {video.plateNumber && (
                  <div className="flex justify-between">
                    <span>Plate Number:</span>
                    <span className="font-medium text-gray-900">{video.plateNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Stream URL:</span>
                  <span className="text-xs text-blue-600 truncate max-w-[200px]" title={getPlayableUrl(video)}>
                    {getPlayableUrl(video) ? getPlayableUrl(video) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {videoData.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600 text-lg">No video streams available</p>
          <p className="text-gray-500 text-sm mt-2">Select a device and channel to start streaming</p>
        </div>
      )}
    </div>
  );
};

export default LiveVideo;
