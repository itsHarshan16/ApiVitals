/**
 * Sequelize Model: MonitoredEndpoint
 *
 * Developer C — Day 2
 * Commit: feat(db): author initial database schema ddl with indexes and constraints
 *
 * Mirrors `monitored_endpoints` table from V1__init_schema.sql.
 */

'use strict';

const { DataTypes, Op } = require('sequelize');

const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

module.exports = (sequelize) => {
  const MonitoredEndpoint = sequelize.define('MonitoredEndpoint', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Endpoint name cannot be empty' },
        len: { args: [1, 100], msg: 'Name must be 1–100 characters' },
      },
    },
    url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'URL cannot be empty' },
        isUrl:    { msg: 'Must be a valid URL (https:// or http://)' },
        isHttpOrHttps(value) {
          if (!/^https?:\/\//i.test(value)) {
            throw new Error('URL must start with http:// or https://');
          }
        },
      },
    },
    httpMethod: {
      type: DataTypes.ENUM(...VALID_METHODS),
      allowNull: false,
      defaultValue: 'GET',
      field: 'http_method',
      validate: {
        isIn: { args: [VALID_METHODS], msg: `HTTP method must be one of: ${VALID_METHODS.join(', ')}` },
      },
    },
    checkIntervalSeconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 60,
      field: 'check_interval_seconds',
      validate: {
        min: { args: [10],    msg: 'Check interval must be at least 10 seconds' },
        max: { args: [86400], msg: 'Check interval must not exceed 86400 seconds (24 hours)' },
      },
    },
    expectedStatusCode: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      field: 'expected_status_code',
      validate: {
        min: { args: [100], msg: 'Status code must be ≥ 100' },
        max: { args: [599], msg: 'Status code must be ≤ 599' },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName:  'monitored_endpoints',
    timestamps: true,
    underscored: true,
    createdAt:  'created_at',
    updatedAt:  'updated_at',

    defaultScope: {
      where: { isActive: true },
      order: [['created_at', 'DESC']],
    },
    scopes: {
      all: {},  // override defaultScope's isActive filter
      inactive: { where: { isActive: false } },
      byUser: (userId) => ({ where: { userId } }),
    },
  });

  MonitoredEndpoint.associate = (models) => {
    MonitoredEndpoint.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    MonitoredEndpoint.hasMany(models.MonitoringResult, {
      foreignKey: 'endpoint_id',
      as: 'results',
      onDelete: 'CASCADE',
    });
  };

  return MonitoredEndpoint;
};

