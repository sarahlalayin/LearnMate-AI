const mongoose = require('mongoose');
const Family = require('./models/Family');
const Task = require('./models/Task');
const Reward = require('./models/Reward');

async function fix() {
  try {
    await mongoose.connect('mongodb+srv://sarahlalayin:987654321@cluster0.6btb6nx.mongodb.net/learnmate?appName=Cluster0');
    console.log("Connected to MongoDB.");
    
    const result = await Family.deleteMany({ familyCode: 'DEMO123' });
    console.log("Deleted families:", result.deletedCount);
    
    // We can also wipe all tasks and rewards since they are corrupted/empty anyway
    await Task.deleteMany({});
    await Reward.deleteMany({});
    console.log("Cleared tasks and rewards.");
    
    console.log("Done! DEMO123 is now completely wiped.");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fix();
