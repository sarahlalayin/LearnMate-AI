const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
  academicYear: { type: String, required: true },
  grade: { type: String, required: true },
  subject: { type: String, required: true },
  edition: { type: String, required: true },
  content: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Syllabus', syllabusSchema);
