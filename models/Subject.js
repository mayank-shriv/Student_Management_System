import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Subject = sequelize.define('Subject', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Subject name is required' },
      len: { args: [2, 100], msg: 'Subject name must be between 2 and 100 characters' },
    },
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: { msg: 'Subject code already exists' },
    validate: {
      notEmpty: { msg: 'Subject code is required' },
    },
  },
  faculty_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'subjects',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'] },
    { fields: ['faculty_id'] },
  ],
});

export default Subject;
