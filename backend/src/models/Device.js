const { ObjectId } = require('mongodb');

class Device {
  static collection = 'devices';

  static async create(deviceData) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const device = {
      ...deviceData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await collection.insertOne(device);
    return { ...device, _id: result.insertedId };
  }

  static async findByUsername(username) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.find({ username }).toArray();
  }

  static async findByDeviceId(deviceId) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.findOne({ deviceId });
  }

  static async findById(id) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async updateByDeviceId(deviceId, updateData) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.updateOne(
      { deviceId },
      { 
        $set: {
          ...updateData,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
  }

  static async getAllDevices() {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.find({}).toArray();
  }
}

module.exports = Device;
