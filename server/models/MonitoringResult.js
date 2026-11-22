/**
 * Sequelize Model: MonitoringResult
 *
 * Developer C — Day 2
 * Commit: feat(db): author initial database schema ddl with indexes and constraints
 *
 * Append-only result log. Mirrors `monitoring_results` from V1__init_schema.sql.
 * Records are NEVER updated — only inserted or bulk-deleted (old data pruning).
 */

'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MonitoringResult = sequelize.define('MonitoringResult', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    endpointId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'endpoint_id',
    },
    isUp: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'is_up',
    },
    statusCode: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      field: 'status_code',
    },
    responseTimeMs: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      field: 'response_time_ms',
      comment: 'Round-trip latency in milliseconds',
    },
    errorMessage: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      defaultValue: null,
      field: 'error_message',
    },
    checkedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'checked_at',
    },
  }, {
    tableName:  'monitoring_results',
    timestamps: false,       // we use custom checkedAt, not Sequelize timestamps
    underscored: true,
    updatedAt:  false,
    createdAt:  false,

    defaultScope: {
      order: [['checked_at', 'DESC']],
    },
    scopes: {
      forEndpoint: (endpointId) => ({
        where: { endpointId },
        order: [['checked_at', 'DESC']],
      }),
      failures: {
        where: { isUp: false },
        order: [['checked_at', 'DESC']],
      },
      last24h: {
        where: {
          checkedAt: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });

  MonitoringResult.associate = (models) => {
    MonitoringResult.belongsTo(models.MonitoredEndpoint, {
      foreignKey: 'endpoint_id',
      as: 'endpoint',
    });
  };

  return MonitoringResult;
};

