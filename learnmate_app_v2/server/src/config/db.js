const mongoose = require('mongoose');
const Question = require('../models/Question');

const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnmate';
  try {
    await mongoose.connect(MONGODB_URI);
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
