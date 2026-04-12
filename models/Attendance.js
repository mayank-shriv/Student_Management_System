import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'students',
      key: 'id',
    },
  },
  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'subjects',
      key: 'id',
    },
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('present', 'absent'),
    allowNull: false,
  },
}, {
  tableName: 'attendance',
  timestamps: true,
  indexes: [
    { fields: ['student_id'] },
    { fields: ['subject_id'] },
    { fields: ['date'] },
    {
      unique: true,
      fields: ['student_id', 'subject_id', 'date'],
      name: 'attendance_unique_constraint',
    },
  ],
});

export default Attendance;
