import mongoose from 'mongoose';

const markSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  },
  subject_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true,
  },
  marks: {
    type: Number,
    required: true,
    min: [0, 'Marks cannot be negative'],
    max: [100, 'Marks cannot exceed 100'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

markSchema.index({ student_id: 1, subject_id: 1 }, { unique: true });

markSchema.virtual('student', {
  ref: 'Student',
  localField: 'student_id',
  foreignField: '_id',
  justOne: true,
});

markSchema.virtual('subject', {
  ref: 'Subject',
  localField: 'subject_id',
  foreignField: '_id',
  justOne: true,
});

export default mongoose.model('Mark', markSchema);
