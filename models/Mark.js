import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Mark = sequelize.define('Mark', {
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
  marks: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: { args: [0], msg: 'Marks cannot be negative' },
      max: { args: [100], msg: 'Marks cannot exceed 100' },
    },
  },
}, {
  tableName: 'marks',
  timestamps: true,
  indexes: [
    { fields: ['student_id'] },
    { fields: ['subject_id'] },
    {
      unique: true,
      fields: ['student_id', 'subject_id'],
      name: 'marks_unique_constraint',
    },
  ],
});

export default Mark;
