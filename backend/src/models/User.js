const { ObjectId } = require('mongodb');

class User {
  static collection = 'users';

  static async create(userData) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    const user = {
      ...userData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await collection.insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  static async findByUsername(username) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.findOne({ username });
  }

  static async findById(id) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async updateLastLogin(username) {
    const db = require('../mongodb').getDatabase();
    const collection = db.collection(this.collection);
    
    return await collection.updateOne(
      { username },
      { $set: { last_login: new Date(), updated_at: new Date() } }
    );
  }
}

module.exports = User;
