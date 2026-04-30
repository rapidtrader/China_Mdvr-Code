const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { testConnection, initializeDatabase, closeDatabase } = require('./mongodb');
const User = require('./models/User');
const { saveDeviceData, saveGpsData, saveDeviceStatusData, getGpsData, getAllGpsHistoryFromDb, getDeviceData, getDeviceStatusData, saveUserLogin, getUserByUsername, getAllUsers } = require('./services/dataService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5174', 'http://localhost:3001','http://localhost:3000', 'http://127.0.0.1:3000', 'https://ops.dynacleanindustries.com', 'http://ops.dynacleanindustries.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Token']
}));
app.use(express.json());

// Dev helper: confirm requests reach this Node process (set DEBUG_GPS_HISTORY=1)
if (process.env.DEBUG_GPS_HISTORY === '1') {
  app.use((req, _res, next) => {
    const u = req.originalUrl || '';
    if (u.includes('history') || u.includes('mongo-history')) {
      console.log(`[history-debug] ${req.method} ${u} pid=${process.pid}`);
    }
    next();
  });
}

// Initialize database on server start
const initializeServer = async () => {
  try {
    await testConnection();
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Prepare request data for external API
    const loginData = {
      username: username,
      password: password,
      model: "web",
      progVersion: "0.0.1",
      platform: 4
    };

    // Make request to external API
    const response = await axios.post(
      'http://www.chinamdvr.com:9337/api/v1/user/login',
      loginData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000, // 10 second timeout
        validateStatus: () => true
      }
    );

    if (response.status < 200 || response.status >= 300) {
      return res.status(401).json({
        success: false,
        message: response.data?.message || 'Login failed',
        error: response.data
      });
    }

    // Check if the API call was actually successful based on the response code
    if (response.data.code !== 200) {
      return res.status(401).json({
        success: false,
        message: response.data.message || 'Login failed',
        error: response.data
      });
    }

    // Extract token from response (check different possible locations)
    let token = null;
    if (response.data?.data?.token) {
      token = response.data.data.token;
      console.log('Backend: Found token at data.data.token');
    } else if (response.data?.token) {
      token = response.data.token;
      console.log('Backend: Found token at data.token');
    } else if (response.data?.data?.data?.token) {
      token = response.data.data.data.token;
      console.log('Backend: Found token at data.data.data.token');
    }

    // Save login data to database
    try {
      await saveUserLogin(username, response.data, token);
      console.log('Login data saved to database for user:', username);
    } catch (dbError) {
      console.error('Failed to save login data to database:', dbError.message);
      // Continue with response even if database save fails
    }

    // Return the response from external API
    res.json({
      success: true,
      data: response.data,
      token: token
    });

  } catch (error) {
    console.error('Login error:', error.message);
    
    // Handle different types of errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Login failed',
        error: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({
        success: false,
        message: 'Unable to connect to authentication server',
        error: 'Network error'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all users (for testing)
app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get user by username
app.get('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove sensitive data
    const { password, ...safeUser } = user;
    
    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    console.error('Error fetching user:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// Get device data from database
app.get('/api/devices/db/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const deviceData = await getDeviceData(username);
    
    if (!deviceData) {
      return res.status(404).json({
        success: false,
        message: 'No device data found for user'
      });
    }
    
    res.json({
      success: true,
      data: deviceData
    });
  } catch (error) {
    console.error('Error fetching device data from database:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device data'
    });
  }
});

// Device list endpoint
app.get('/api/devices', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    console.log('Device API called with token:', token ? 'Token present' : 'No token');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Make request to external API with token
    console.log('Making request to device API...');
    console.log('Token being used:', token.substring(0, 50) + '...');
    
    // Try different API endpoints and authentication methods
    let response;
    const endpoints = [
      'http://www.chinamdvr.com:9337/api/v1/device/getList',
      'http://www.chinamdvr.com:9337/api/v1/device/list',
      'http://www.chinamdvr.com:9337/api/v1/devices',
      'http://www.chinamdvr.com:9337/api/v1/user/devices',
      'http://www.chinamdvr.com:9337/api/v1/vehicle/getList',
      'http://www.chinamdvr.com:9337/api/v1/vehicle/list'
    ];
    
    const authMethods = [
      { headers: { 'X-Token': token, 'Content-Type': 'application/json' } },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } },
      { headers: { 'Authorization': token, 'Content-Type': 'application/json' } },
      { headers: { 'token': token, 'Content-Type': 'application/json' } }
    ];

    for (const endpoint of endpoints) {
      console.log(`Trying endpoint: ${endpoint}`);
      for (const authMethod of authMethods) {
        try {
          console.log(`Trying auth method:`, Object.keys(authMethod.headers));
          response = await axios.get(endpoint, {
            ...authMethod,
            timeout: 10000
          });
          console.log(`Success with endpoint: ${endpoint}`);
          break;
        } catch (error) {
          console.log(`Failed with ${endpoint} and auth ${Object.keys(authMethod.headers).join(', ')}`);
          if (error.response?.status !== 404) {
            // If it's not a 404, the endpoint exists but auth failed, so continue trying auth methods
            continue;
          }
        }
      }
      if (response) break;
    }

    // If we got a successful response from external API, save the data
    if (response) {
      console.log('Device API response successful:', response.data);
      
      // Save device data to database (using a test username for now)
      try {
        await saveDeviceData('Apitest1', response.data);
        console.log('Device data saved to database from external API');
      } catch (dbError) {
        console.error('Failed to save device data to database:', dbError.message);
      }
      
      res.json({
        success: true,
        data: response.data
      });
      return;
    }

    if (!response) {
      console.log('All external endpoints failed, returning mock device data');
      // Return mock device data when external API fails (using real API structure)
      const mockDeviceData = {
        code: 200,
        message: "success",
        ts: Math.floor(Date.now() / 1000),
        data: {
          list: [
            {
              deviceId: "18271184969",
              plateNumber: "DL9S22443",
              companyId: 767,
              companyName: "Indiaapitest1",
              fleetId: 0,
              fleetName: "",
              maxChannel: 8,
              protoType: 0,
              expirationTime: -1728916096,
              sn: "CM017118271183969",
              isAutoUpdate: false,
              state: 0,
              accState: 0,
              createdAt: 1776248438,
              updatedAt: 1776362486
            }
          ],
          total: 1
        }
      };
      
      console.log('Returning mock device data:', mockDeviceData);
      
      // Save device data to database (using a test username for now)
      try {
        await saveDeviceData('Apitest1', mockDeviceData.data);
        console.log('Device data saved to database');
      } catch (dbError) {
        console.error('Failed to save device data to database:', dbError.message);
      }
      
      res.json({
        success: true,
        data: mockDeviceData,
        mockData: true
      });
      return;
    }

    console.log('Device API response:', response.data);
    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Device list error:', error.message);
    console.error('Error response:', error.response?.data);
    
    // Return mock data as fallback
    console.log('Error occurred, returning mock device data as fallback');
    const mockDeviceData = {
      code: 200,
      message: "success (mock data)",
      ts: Math.floor(Date.now() / 1000),
      data: {
        list: [
          {
            deviceId: "18271184969",
            plateNumber: "DL9S22443",
            companyId: 767,
            companyName: "Indiaapitest1",
            fleetId: 0,
            fleetName: "",
            maxChannel: 8,
            protoType: 0,
            expirationTime: -1728916096,
            sn: "CM017118271183969",
            isAutoUpdate: false,
            state: 0,
            accState: 0,
            createdAt: 1776248438,
            updatedAt: 1776362486
          }
        ],
        total: 1
      }
    };
    
    res.json({
      success: true,
      data: mockDeviceData,
      mockData: true,
      error: 'External API failed, showing mock data'
    });
  }
});

// GPS data endpoint
app.post('/api/gps/latest', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { deviceIds } = req.body;
    
    console.log('GPS API called with token:', token ? 'Token present' : 'No token');
    console.log('Device IDs:', deviceIds);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'deviceIds array is required'
      });
    }

    // Make request to external GPS API
    console.log('Making request to GPS API...');
    const response = await axios.post(
      'http://www.chinamdvr.com:9337/api/v2/gps/getLatestGPS',
      { deviceIds },
      {
        headers: {
          'X-Token': token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('GPS API response:', response.data);

    // Save real GPS data to database
    try {
      console.log('Attempting to save GPS data:', response.data);
      await saveGpsData('Apitest1', response.data);
      console.log('GPS data saved to database successfully');
    } catch (dbError) {
      console.error('Failed to save GPS data to database:', dbError.message);
      console.error('Full error details:', dbError);
    }

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('GPS data error:', error.message);
    
    // Return mock data as fallback
    console.log('Error occurred, returning mock GPS data as fallback');
    const mockGpsData = {
      code: 200,
      message: "success (mock data)",
      ts: Math.floor(Date.now() / 1000),
      data: {
        list: [
          {
            deviceId: "18271184969",
            latitude: 28.6139,
            longitude: 77.2090,
            altitude: 220,
            speed: 45,
            direction: 180,
            gpsTime: Math.floor(Date.now() / 1000),
            accuracy: 7.5,
            satelliteCount: 12,
            isOnline: true,
            address: "Delhi, India",
            state: "Moving"
          }
        ],
        total: 1
      }
    };
    
    res.json({
      success: true,
      data: mockGpsData,
      mockData: true,
      error: 'External API failed, showing mock data'
    });
  }
});

// GPS history from MongoDB gps_data (all stored rows, newest first)
const handleGpsHistoryFromDb = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    const limitRaw =
      req.query.limit !== undefined && req.query.limit !== ''
        ? req.query.limit
        : req.body?.limit;
    const limit =
      limitRaw !== undefined && limitRaw !== ''
        ? parseInt(String(limitRaw), 10)
        : undefined;

    const payload = await getAllGpsHistoryFromDb(
      Number.isFinite(limit) && limit > 0 ? limit : undefined
    );

    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('GPS history DB error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load GPS history from database',
      error: error.message
    });
  }
};

app.get('/api/gps/history/db', handleGpsHistoryFromDb);
app.post('/api/gps/history/db', handleGpsHistoryFromDb);
// Alternate path (same handler) — use if a proxy blocks nested `/history/db`
app.get('/api/gps/mongo-history', handleGpsHistoryFromDb);
app.post('/api/gps/mongo-history', handleGpsHistoryFromDb);

// Device status endpoint
app.post('/api/device/states', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { deviceIds } = req.body;
    
    console.log('Device status API called with token:', token ? 'Token present' : 'No token');
    console.log('Device IDs:', deviceIds);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'deviceIds array is required'
      });
    }

    // Make request to external device status API
    console.log('Making request to device status API...');
    const response = await axios.post(
      'http://www.chinamdvr.com:9337/api/v1/device/states',
      { deviceIds },
      {
        headers: {
          'X-Token': token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('Device status API response:', response.data);

    // Save real device status data to database
    try {
      console.log('Attempting to save device status data:', response.data);
      await saveDeviceStatusData('Apitest1', response.data);
      console.log('Device status data saved to database successfully');
    } catch (dbError) {
      console.error('Failed to save device status data to database:', dbError.message);
      console.error('Full error details:', dbError);
    }

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Device status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device status data',
      error: error.message
    });
  }
});

// Video preview endpoint
app.post('/api/media/previewVideo', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    // Default streamType to main-stream (0) to match vendor demo (sub-stream can yield WebRTC "stream not found").
    const { deviceId, channels = [6], dataType = 1, streamType = 0, playFormat = 2 } = req.body;
    
    console.log('Video preview API called with token:', token ? 'Token present' : 'No token');
    console.log('Device ID:', deviceId);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required'
      });
    }

    // Make request to external video preview API
    // Important: don't throw on non-2xx so the frontend can retry other playFormat values.
    console.log('Making request to video preview API...');
    const response = await axios.post(
      'http://www.chinamdvr.com:9337/api/v1/media/previewVideo',
      { deviceId, channels, dataType, streamType, playFormat },
      {
        headers: {
          'X-Token': token,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    
    console.log('Video preview API response:', response.data);

    // Preserve upstream HTTP status + body for debugging.
    if (response.status < 200 || response.status >= 300) {
      return res.status(200).json({
        success: false,
        message: 'Upstream previewVideo failed',
        upstreamStatus: response.status,
        data: response.data
      });
    }

    return res.json({
      success: true,
      data: response.data,
      replacedUrls: response.data?.data?.list?.map(video => ({
        ...video,
        videoUrl: video?.videoUrl?.replace(
  /http:\/\/(www\.)?chinamdvr\.com:9330/,
  "https://ops.dynacleanindustries.com/video"
),
hlsUrl: video?.hlsUrl?.replace(
  /http:\/\/(www\.)?chinamdvr\.com:9330/,
  "https://ops.dynacleanindustries.com/video"
)
      }))
    });

  } catch (error) {
    const upstreamStatus = error.response?.status;
    const upstreamData = error.response?.data;
    console.error('Video preview error:', {
      message: error.message,
      upstreamStatus,
      upstreamData
    });

    // Return 200 with a structured error payload so the frontend can keep trying other formats.
    return res.status(200).json({
      success: false,
      message: 'Failed to fetch video preview data',
      upstreamStatus,
      error: error.message,
      data: upstreamData
    });
  }
});

// Start server with database initialization
initializeServer().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(
      'GPS history from DB: GET|POST /api/gps/history/db or /api/gps/mongo-history'
    );
  });
}).catch(error => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});
