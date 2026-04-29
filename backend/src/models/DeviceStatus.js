const { ObjectId } = require('mongodb');

class DeviceStatus {
  static collection = 'device_status';

  static async create(statusData) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const status = {
      ...statusData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await collection.insertOne(status);
    return { ...status, _id: result.insertedId };
  }

  static async findByUsername(username, limit = 100) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ username })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  static async findByDeviceId(deviceId, limit = 100) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ deviceId })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  static async findByUsernameAndDeviceId(username, deviceId, limit = 50) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ username, deviceId })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  static async getLatestByUsername(username) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ username })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
  }

  static async getLatestByDeviceId(deviceId) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection
      .find({ deviceId })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
  }

  static async createBatch(statusDataArray) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const statusDataWithTimestamps = statusDataArray.map(data => ({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    const result = await collection.insertMany(statusDataWithTimestamps);
    return result;
  }

  static async getLatestStatusForDevices(deviceIds) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const pipeline = [
      { $match: { deviceId: { $in: deviceIds } } },
      { $sort: { created_at: -1 } },
      { $group: {
        _id: '$deviceId',
        latestStatus: { $first: '$$ROOT' }
      }},
      { $replaceRoot: { newRoot: '$latestStatus' } }
    ];
    
    return await collection.aggregate(pipeline).toArray();
  }
}

module.exports = DeviceStatus;
