const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://learnmate:learnmate2024@cluster0.mongodb.net/learnmate?retryWrites=true&w=majority';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;

  // 1. Find the family ID for DEMO999
  const Family = mongoose.model('Family', new mongoose.Schema({}, { strict: false }));
  const demoFamily = await Family.findOne({ familyCode: 'DEMO999' });

  if (!demoFamily) {
    console.log('DEMO999 family not found in the database. Nothing to delete.');
    await mongoose.disconnect();
    return;
  }

  const familyId = demoFamily._id;
  console.log(`Found DEMO999 family ID: ${familyId}`);

  // 2. Delete associated documents from other collections
  const Task = mongoose.model('Task', new mongoose.Schema({}, { strict: false }));
  const Reward = mongoose.model('Reward', new mongoose.Schema({}, { strict: false }));
  const QuizFeedback = mongoose.model('QuizFeedback', new mongoose.Schema({}, { strict: false }));
  const ErrorLog = mongoose.model('ErrorLog', new mongoose.Schema({}, { strict: false }));
  const Alert = mongoose.model('Alert', new mongoose.Schema({}, { strict: false }));

  console.log('Deleting associated tasks...');
  const taskRes = await Task.deleteMany({ familyId });
  console.log(`Deleted ${taskRes.deletedCount} tasks.`);

  console.log('Deleting associated rewards...');
  const rewardRes = await Reward.deleteMany({ familyId });
  console.log(`Deleted ${rewardRes.deletedCount} rewards.`);

  console.log('Deleting associated quiz feedbacks...');
  const feedbackRes = await QuizFeedback.deleteMany({ familyId });
  console.log(`Deleted ${feedbackRes.deletedCount} quiz feedbacks.`);

  console.log('Deleting associated error logs...');
  const errorLogRes = await ErrorLog.deleteMany({ familyId });
  console.log(`Deleted ${errorLogRes.deletedCount} error logs.`);

  console.log('Deleting associated alerts...');
  const alertRes = await Alert.deleteMany({ familyId });
  console.log(`Deleted ${alertRes.deletedCount} alerts.`);

  // 3. Delete the family itself
  console.log('Deleting DEMO999 family document...');
  const familyRes = await Family.deleteOne({ _id: familyId });
  console.log(`Deleted DEMO999 family: ${familyRes.deletedCount}`);

  console.log('Database cleanup completed successfully!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error cleaning up database:', err);
  mongoose.disconnect();
});
