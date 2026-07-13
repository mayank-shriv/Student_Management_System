import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  enrollment_no: {
    type: String,
    required: [true, 'Enrollment number is required'],
    unique: true,
    trim: true,
  },
  department: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

studentSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true,
});

export default mongoose.model('Student', studentSchema);
