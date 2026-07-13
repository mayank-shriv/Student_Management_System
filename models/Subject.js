import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
    minlength: [2, 'Subject name must be between 2 and 100 characters'],
    maxlength: [100, 'Subject name must be between 2 and 100 characters'],
  },
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  faculty_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

subjectSchema.virtual('faculty', {
  ref: 'User',
  localField: 'faculty_id',
  foreignField: '_id',
  justOne: true,
});

export default mongoose.model('Subject', subjectSchema);
