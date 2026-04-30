const Device = require('../models/Device');
const GpsData = require('../models/GpsData');
const DeviceStatus = require('../models/DeviceStatus');
const User = require('../models/User');

// Save device data to MongoDB
const saveDeviceData = async (username, deviceData) => {
  try {
    console.log('saveDeviceData called with:', { username, deviceData });
    
    if (deviceData && deviceData.data && deviceData.data.list && Array.isArray(deviceData.data.list)) {
      const devices = deviceData.data.list;
      
      for (const device of devices) {
        await Device.updateByDeviceId(device.deviceId, {
          username,
          ...device
        });
      }
      
      console.log(`Saved ${devices.length} devices for user: ${username}`);
      return { success: true, message: 'Device data saved successfully' };
    }
    
    return { success: false, message: 'No device data to save' };
  } catch (error) {
    console.error('Error saving device data:', error.message);
    throw error;
  }
};

// Save GPS data to MongoDB
const saveGpsData = async (username, gpsData) => {
  try {
    console.log('saveGpsData called with:', { username, gpsData });
    
    if (gpsData && gpsData.data && gpsData.data.list && Array.isArray(gpsData.data.list)) {
      const gpsDataArray = [];
      
      for (const device of gpsData.data.list) {
        const gps = device.gps;
        
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
        
        const gpsRecord = {
          username,
          deviceId: device.deviceId,
          latitude: gps.latitude || 0,
          longitude: gps.longitude || 0,
          altitude: gps.altitude || 0,
          speed: gps.speed || 0,
          direction: gps.direction || 0,
          gpsTime: gps.time || 0,
          accuracy: 0, // accuracy not in new structure
          satelliteCount: gnssCount,
          isOnline: true,
          address: 'Location from GPS',
          state: gps.statusFlags?.moving ? 'Moving' : 'Stopped',
          alarmFlags: gps.alarmFlags || {},
          statusFlags: gps.statusFlags || {},
          additionalInfos: gps.additionalInfos || [],
          lastOnlineTime: device.lastOnlineTime || 0,
          dataType: gps.dataType || 0,
          mileage,
          signalStrength,
          gnssCount
        };
        
        gpsDataArray.push(gpsRecord);
      }
      
      // Create batch GPS records
      await GpsData.createBatch(gpsDataArray);
      
      console.log(`Saved GPS data for ${gpsDataArray.length} devices for user: ${username}`);
      return { success: true, message: 'GPS data saved successfully' };
    }
    
    return { success: false, message: 'No GPS data to save' };
  } catch (error) {
    console.error('Error saving GPS data:', error.message);
    throw error;
  }
};

// Save device status data to MongoDB
const saveDeviceStatusData = async (username, statusData) => {
  try {
    console.log('saveDeviceStatusData called with:', { username, statusData });
    
    if (statusData && statusData.data && statusData.data.list && Array.isArray(statusData.data.list)) {
      const statusDataArray = [];
      
      for (const status of statusData.data.list) {
        const statusRecord = {
          username,
          deviceId: status.deviceId,
          state: status.state,
          accState: status.accState
        };
        
        statusDataArray.push(statusRecord);
      }
      
      // Create batch status records
      await DeviceStatus.createBatch(statusDataArray);
      
      console.log(`Saved device status data for ${statusDataArray.length} devices for user: ${username}`);
      return { success: true, message: 'Device status data saved successfully' };
    }
    
    return { success: false, message: 'No device status data to save' };
  } catch (error) {
    console.error('Error saving device status data:', error.message);
    throw error;
  }
};

const formatGpsDocumentsAsApiList = (gpsData) =>
  gpsData.map((gps) => ({
    _id: gps._id,
    deviceId: gps.deviceId,
    gps: {
      latitude: gps.latitude,
      longitude: gps.longitude,
      altitude: gps.altitude,
      speed: gps.speed,
      direction: gps.direction,
      time: gps.gpsTime,
      accuracy: gps.accuracy,
      satelliteCount: gps.satelliteCount,
      isOnline: gps.isOnline,
      address: gps.address,
      state: gps.state,
      alarmFlags: gps.alarmFlags,
      statusFlags: gps.statusFlags,
      additionalInfos: gps.additionalInfos,
      lastOnlineTime: gps.lastOnlineTime,
      dataType: gps.dataType,
      mileage: gps.mileage,
      signalStrength: gps.signalStrength,
      gnssCount: gps.gnssCount
    }
  }));

// All GPS history rows from MongoDB gps_data (newest first)
const getAllGpsHistoryFromDb = async (limit) => {
  const rows = await GpsData.findAllSortedDescending(limit);
  const list = formatGpsDocumentsAsApiList(rows);
  return {
    code: 200,
    message: 'success',
    ts: Math.floor(Date.now() / 1000),
    data: {
      list,
      total: list.length
    }
  };
};

// Get GPS data from MongoDB
const getGpsData = async (username) => {
  try {
    const gpsData = await GpsData.findByUsername(username, 100);
    
    if (gpsData.length === 0) {
      return null;
    }
    
    // Format the response to match API structure
    const formattedData = {
      code: 200,
      message: 'success',
      ts: Date.now(),
      data: {
        list: formatGpsDocumentsAsApiList(gpsData),
        total: gpsData.length
      }
    };
    
    return formattedData;
  } catch (error) {
    console.error('Error getting GPS data:', error.message);
    throw error;
  }
};

// Get device data from MongoDB
const getDeviceData = async (username) => {
  try {
    const devices = await Device.findByUsername(username);
    
    if (devices.length === 0) {
      return null;
    }
    
    // Format the response to match API structure
    const formattedData = {
      code: 200,
      message: 'success',
      ts: Date.now(),
      data: {
        list: devices.map(device => ({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          sn: device.sn,
          maxChannel: device.maxChannel,
          protoType: device.protoType,
          expirationTime: device.expirationTime,
          isAutoUpdate: device.isAutoUpdate,
          state: device.state,
          accState: device.accState,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt
        })),
        total: devices.length
      }
    };
    
    return formattedData;
  } catch (error) {
    console.error('Error getting device data:', error.message);
    throw error;
  }
};

// Get device status data from MongoDB
const getDeviceStatusData = async (username) => {
  try {
    const statusData = await DeviceStatus.findByUsername(username, 100);
    
    if (statusData.length === 0) {
      return null;
    }
    
    // Format the response to match API structure
    const formattedData = {
      code: 200,
      message: 'success',
      ts: Date.now(),
      data: {
        list: statusData.map(status => ({
          deviceId: status.deviceId,
          state: status.state,
          accState: status.accState,
          created_at: status.created_at,
          updated_at: status.updated_at
        })),
        total: statusData.length
      }
    };
    
    return formattedData;
  } catch (error) {
    console.error('Error getting device status data:', error.message);
    throw error;
  }
};

// Save user login data to MongoDB
const saveUserLogin = async (username, loginResponse, token) => {
  try {
    console.log('saveUserLogin called with:', { username, token });
    
    // Check if user already exists
    const existingUser = await User.findByUsername(username);
    
    if (existingUser) {
      // Update last login
      await User.updateLastLogin(username);
      console.log('Updated last login for existing user:', username);
    } else {
      // Create new user
      const userData = {
        username,
        password: '', // We don't store password from external API
        token,
        last_login: new Date(),
        is_active: true
      };
      
      await User.create(userData);
      console.log('Created new user:', username);
    }
    
    return { success: true, message: 'User login data saved successfully' };
  } catch (error) {
    console.error('Error saving user login data:', error.message);
    throw error;
  }
};

// Get user by username from MongoDB
const getUserByUsername = async (username) => {
  try {
    const user = await User.findByUsername(username);
    return user;
  } catch (error) {
    console.error('Error getting user by username:', error.message);
    throw error;
  }
};

// Get all users from MongoDB
const getAllUsers = async () => {
  try {
    const db = require('../mongodb').getDatabase();
    const usersCollection = db.collection('users');
    
    const users = await usersCollection
      .find({})
      .project({ password: 0 }) // Exclude password from results
      .sort({ created_at: -1 })
      .toArray();
    
    return users;
  } catch (error) {
    console.error('Error getting all users:', error.message);
    throw error;
  }
};

module.exports = {
  saveDeviceData,
  saveGpsData,
  saveDeviceStatusData,
  getGpsData,
  getAllGpsHistoryFromDb,
  getDeviceData,
  getDeviceStatusData,
  saveUserLogin,
  getUserByUsername,
  getAllUsers
};
