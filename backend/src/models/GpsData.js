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

  /** Full history from gps_data, newest first. Caps bulk reads unless GPS_HISTORY_MAX_DOCS=0 (no limit). */
  static async findAllSortedDescending(requestedLimit) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    const rawMax = process.env.GPS_HISTORY_MAX_DOCS;
    const envMax =
      rawMax === '0' ? null : parseInt(rawMax || '200000', 10);
    let limit = envMax;
    if (requestedLimit != null && Number.isFinite(requestedLimit) && requestedLimit > 0) {
      limit =
        envMax == null
          ? requestedLimit
          : Math.min(requestedLimit, envMax);
    }
    let cursor = collection.find({}).sort({ gpsTime: -1 });
    if (limit != null && limit > 0) {
      cursor = cursor.limit(limit);
    }
    return cursor.toArray();
  }
}

module.exports = GpsData;
