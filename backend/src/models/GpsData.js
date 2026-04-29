const { ObjectId } = require('mongodb');

class GpsData {
  static collection = 'gps_data';

  static async create(gpsData) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const gps = {
      ...gpsData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await collection.insertOne(gps);
    return { ...gps, _id: result.insertedId };
  }

  static async findByUsername(username, limit = 100) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ username })
      .sort({ gpsTime: -1 })
      .limit(limit)
      .toArray();
  }

  static async findByDeviceId(deviceId, limit = 100) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ deviceId })
      .sort({ gpsTime: -1 })
      .limit(limit)
      .toArray();
  }

  static async findByUsernameAndDeviceId(username, deviceId, limit = 50) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ username, deviceId })
      .sort({ gpsTime: -1 })
      .limit(limit)
      .toArray();
  }

  static async getLatestByUsername(username) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ username })
      .sort({ gpsTime: -1 })
      .limit(1)
      .toArray();
  }

  static async getLatestByDeviceId(deviceId) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ deviceId })
      .sort({ gpsTime: -1 })
      .limit(1)
      .toArray();
  }

  static async createBatch(gpsDataArray) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const gpsDataWithTimestamps = gpsDataArray.map(data => ({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    const result = await collection.insertMany(gpsDataWithTimestamps);
    return result;
  }
}

module.exports = GpsData;
