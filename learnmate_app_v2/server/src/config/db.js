const mongoose = require('mongoose');
const Question = require('../models/Question');

const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnmate';
  try {
    // 關閉指令緩衝，避免資料庫未連線時 API 查詢被無限掛起
    mongoose.set('bufferCommands', false);
    
    // 設定連線超時為 3 秒，防止長時間卡住
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log('✅ MongoDB 資料庫連線成功');
    // 自動初始化題庫
    const count = await Question.countDocuments();
    if (count === 0) {
      const { SEED_QUESTIONS } = require('../../scripts/questionSeed');
      await Question.insertMany(SEED_QUESTIONS);
      console.log(`📚 題庫已初始化：共 ${SEED_QUESTIONS.length} 題`);
    } else {
      console.log(`📚 題庫已有 ${count} 題`);
    }
  } catch (err) {
    console.error('❌ MongoDB 連線失敗:', err);
  }
};

module.exports = connectDB;
