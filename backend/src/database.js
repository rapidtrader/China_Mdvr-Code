const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'china_mdvr',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
};

// Initialize database table
const initializeDatabase = async () => {
  try {
    // Create users table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        token TEXT,
        login_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `;
    
    await pool.execute(createTableQuery);
    console.log('Users table initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
};

// Save user login data
const saveUserLogin = async (username, loginResponse, token = null) => {
  try {
    const checkUserQuery = 'SELECT id FROM users WHERE username = ?';
    const [existingUser] = await pool.execute(checkUserQuery, [username]);
    
    if (existingUser.length > 0) {
      // Update existing user
      const updateQuery = `
        UPDATE users 
        SET token = ?, login_data = ?, last_login = CURRENT_TIMESTAMP
        WHERE username = ?
      `;
      await pool.execute(updateQuery, [token, JSON.stringify(loginResponse), username]);
      console.log('User login data updated:', username);
    } else {
      // Insert new user
      const insertQuery = `
        INSERT INTO users (username, password, token, login_data, last_login)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      await pool.execute(insertQuery, [username, '', token, JSON.stringify(loginResponse)]);
      console.log('New user created and login data saved:', username);
    }
    
    return { success: true, message: 'Login data saved successfully' };
  } catch (error) {
    console.error('Error saving user login:', error.message);
    throw error;
  }
};

// Get user by username
const getUserByUsername = async (username) => {
  try {
    const query = 'SELECT * FROM users WHERE username = ? AND is_active = TRUE';
    const [rows] = await pool.execute(query, [username]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting user:', error.message);
    throw error;
  }
};

// Save device data to database
const saveDeviceData = async (username, deviceData) => {
  try {
    // Create devices table if it doesn't exist
    const createDevicesTableQuery = `
      CREATE TABLE IF NOT EXISTS devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        deviceId VARCHAR(255) NOT NULL,
        plateNumber VARCHAR(255),
        companyId INT,
        companyName VARCHAR(255),
        fleetId INT,
        fleetName VARCHAR(255),
        maxChannel INT,
        protoType INT,
        expirationTime BIGINT,
        sn VARCHAR(255),
        isAutoUpdate BOOLEAN,
        state INT,
        accState INT,
        createdAt BIGINT,
        updatedAt BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_device_user (username, deviceId)
      )
    `;
    
    await pool.execute(createDevicesTableQuery);
    
    // Clear existing devices for this user
    const clearDevicesQuery = 'DELETE FROM devices WHERE username = ?';
    await pool.execute(clearDevicesQuery, [username]);
    
    // Insert new device data
    if (deviceData && deviceData.list && Array.isArray(deviceData.list)) {
      for (const device of deviceData.list) {
        const insertDeviceQuery = `
          INSERT INTO devices (
            username, deviceId, plateNumber, companyId, companyName, fleetId, fleetName,
            maxChannel, protoType, expirationTime, sn, isAutoUpdate, state, accState, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await pool.execute(insertDeviceQuery, [
          username,
          device.deviceId,
          device.plateNumber,
          device.companyId,
          device.companyName,
          device.fleetId,
          device.fleetName,
          device.maxChannel,
          device.protoType,
          device.expirationTime,
          device.sn,
          device.isAutoUpdate,
          device.state,
          device.accState,
          device.createdAt,
          device.updatedAt
        ]);
      }
    }
    
    console.log(`Saved ${deviceData?.list?.length || 0} devices for user: ${username}`);
    return { success: true, message: 'Device data saved successfully' };
  } catch (error) {
    console.error('Error saving device data:', error.message);
    throw error;
  }
};

// Get device data from database
const getDeviceData = async (username) => {
  try {
    const query = 'SELECT * FROM devices WHERE username = ? ORDER BY plateNumber';
    const [rows] = await pool.execute(query, [username]);
    
    if (rows.length === 0) {
      return null;
    }
    
    // Format the response to match API structure
    const deviceList = rows.map(row => ({
      deviceId: row.deviceId,
      plateNumber: row.plateNumber,
      companyId: row.companyId,
      companyName: row.companyName,
      fleetId: row.fleetId,
      fleetName: row.fleetName,
      maxChannel: row.maxChannel,
      protoType: row.protoType,
      expirationTime: row.expirationTime,
      sn: row.sn,
      isAutoUpdate: row.isAutoUpdate,
      state: row.state,
      accState: row.accState,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
    
    return {
      code: 200,
      message: "success",
      ts: Math.floor(Date.now() / 1000),
      data: {
        list: deviceList,
        total: deviceList.length
      }
    };
  } catch (error) {
    console.error('Error getting device data:', error.message);
    throw error;
  }
};

// Close database connection pool
const closeDatabase = async () => {
  await pool.end();
  console.log('Database connection closed');
};

// Save GPS data to database (updated for new complex structure)
const saveGpsData = async (username, gpsData) => {
  try {
    console.log('saveGpsData called with:', { username, gpsData });
    
    // Create GPS data table if it doesn't exist (updated schema)
    const createGpsTableQuery = `
      CREATE TABLE IF NOT EXISTS gps_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        deviceId VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        altitude DECIMAL(8, 2),
        speed DECIMAL(6, 2),
        direction INT,
        gpsTime BIGINT,
        accuracy DECIMAL(6, 2),
        satelliteCount INT,
        isOnline BOOLEAN,
        address VARCHAR(500),
        state VARCHAR(50),
        -- New fields for complex structure
        alarmFlags JSON,
        statusFlags JSON,
        additionalInfos JSON,
        lastOnlineTime BIGINT,
        dataType INT,
        mileage DECIMAL(10, 2),
        signalStrength INT,
        gnssCount INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_gps (deviceId, gpsTime),
        INDEX idx_username_device (username, deviceId)
      )
    `;
    
    await pool.execute(createGpsTableQuery);
    
   
    try {
      
      const alterQueries = [
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS alarmFlags JSON',
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS statusFlags JSON', 
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS additionalInfos JSON',
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS lastOnlineTime BIGINT',
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS dataType INT',
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS mileage DECIMAL(10, 2)',
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS signalStrength INT',
        'ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS gnssCount INT'
      ];
      
      for (const query of alterQueries) {
        try {
          await pool.execute(query);
        } catch (err) {
          // Column might already exist, ignore error
          if (!err.message.includes('Duplicate column name')) {
            console.log('Column alter query info:', err.message);
          }
        }
      }
    } catch (error) {
      console.log('Table alteration info:', error.message);
    }
    
    // Insert new GPS data with new structure (always create new rows)
    if (gpsData && gpsData.data && gpsData.data.list && Array.isArray(gpsData.data.list)) {
      // Insert new GPS data with new structure
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
        
        const insertGpsQuery = `
          INSERT INTO gps_data (
            username, deviceId, latitude, longitude, altitude, speed, direction,
            gpsTime, accuracy, satelliteCount, isOnline, address, state,
            alarmFlags, statusFlags, additionalInfos, lastOnlineTime, dataType,
            mileage, signalStrength, gnssCount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await pool.execute(insertGpsQuery, [
          username,
          device.deviceId,
          gps.latitude || 0,
          gps.longitude || 0,
          gps.altitude || 0,
          gps.speed || 0,
          gps.direction || 0,
          gps.time || 0,
          0, // accuracy not in new structure
          gnssCount,
          true, // isOnline
          'Location from GPS',
          gps.statusFlags?.moving ? 'Moving' : 'Stopped',
          JSON.stringify(gps.alarmFlags || {}),
          JSON.stringify(gps.statusFlags || {}),
          JSON.stringify(gps.additionalInfos || []),
          device.lastOnlineTime || 0,
          gps.dataType || 0,
          mileage,
          signalStrength,
          gnssCount
        ]);
      }
    }
    
    console.log(`Saved GPS data for ${gpsData?.list?.length || 0} devices for user: ${username}`);
    return { success: true, message: 'GPS data saved successfully' };
  } catch (error) {
    console.error('Error saving GPS data:', error.message);
    throw error;
  }
};

// Get GPS data from database
const getGpsData = async (username) => {
  try {
    const query = `
      SELECT * FROM gps_data 
      WHERE username = ? 
      ORDER BY gpsTime DESC, deviceId
    `;
    const [rows] = await pool.execute(query, [username]);
    
    if (rows.length === 0) {
      return null;
    }
    
    // Format the response to match API structure
    const gpsList = rows.map(row => ({
      deviceId: row.deviceId,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      altitude: parseFloat(row.altitude),
      speed: parseFloat(row.speed),
      direction: row.direction,
      gpsTime: row.gpsTime,
      accuracy: parseFloat(row.accuracy),
      satelliteCount: row.satelliteCount,
      isOnline: row.isOnline,
      address: row.address,
      state: row.state
    }));
    
    return {
      code: 200,
      message: "success",
      ts: Math.floor(Date.now() / 1000),
      data: {
        list: gpsList,
        total: gpsList.length
      }
    };
  } catch (error) {
    console.error('Error getting GPS data:', error.message);
    throw error;
  }
};

// Save device status data to database
const saveDeviceStatusData = async (username, statusData) => {
  try {
    console.log('saveDeviceStatusData called with:', { username, statusData });
    
    // Create device status table if it doesn't exist
    const createDeviceStatusTableQuery = `
      CREATE TABLE IF NOT EXISTS device_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        deviceId VARCHAR(255) NOT NULL,
        state INT,
        accState INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_status (deviceId, state),
        INDEX idx_username_status (username, deviceId)
      )
    `;
    
    await pool.execute(createDeviceStatusTableQuery);
    
    // Remove existing UNIQUE constraint if it exists
    try {
      await pool.execute('ALTER TABLE device_status DROP INDEX unique_device_status_user');
      console.log('Dropped UNIQUE constraint from device_status table');
    } catch (err) {
      // Constraint might not exist, ignore error
      if (!err.message.includes('Error in query (1091)')) {
        console.log('Constraint removal info:', err.message);
      }
    }
    
    // Insert new device status data (always create new rows)
    if (statusData && statusData.data && statusData.data.list && Array.isArray(statusData.data.list)) {
      // Insert new device status data
      for (const status of statusData.data.list) {
        const insertStatusQuery = `
          INSERT INTO device_status (username, deviceId, state, accState)
          VALUES (?, ?, ?, ?)
        `;
        
        await pool.execute(insertStatusQuery, [
          username,
          status.deviceId,
          status.state,
          status.accState
        ]);
      }
    }
    
    console.log(`Saved device status data for ${statusData?.list?.length || 0} devices for user: ${username}`);
    return { success: true, message: 'Device status data saved successfully' };
  } catch (error) {
    console.error('Error saving device status data:', error.message);
    throw error;
  }
};

// Get device status data from database
const getDeviceStatusData = async (username) => {
  try {
    const query = `
      SELECT * FROM device_status 
      WHERE username = ? 
      ORDER BY deviceId
    `;
    const [rows] = await pool.execute(query, [username]);
    
    if (rows.length === 0) {
      return null;
    }
    
    // Format the response to match API structure
    const statusList = rows.map(row => ({
      deviceId: row.deviceId,
      state: row.state,
      accState: row.accState
    }));
    
    return {
      code: 200,
      message: "success",
      ts: Math.floor(Date.now() / 1000),
      data: {
        list: statusList
      }
    };
  } catch (error) {
    console.error('Error getting device status data:', error.message);
    throw error;
  }
};

module.exports = {
  pool,
  testConnection,
  initializeDatabase,
  saveUserLogin,
  getUserByUsername,
  saveDeviceData,
  getDeviceData,
  saveGpsData,
  getGpsData,
  saveDeviceStatusData,
  getDeviceStatusData,
  closeDatabase
};
