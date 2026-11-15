package com.apimonitor.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

/**
 * Explicit DataSource / HikariCP configuration bean.
 *
 * Spring Boot auto-configures HikariCP from application.properties, but
 * declaring it explicitly gives us:
 *   - Programmatic validation of pool properties at startup
 *   - Easier unit testing (the bean can be swapped in test context)
 *   - Fine-grained control over metric registration
 *
 * Developer A — Day 2
 * Commit: feat(db): configure spring data jpa and datasource connection pooling
 */
@Configuration
public class DataSourceConfig {

    @Value("${spring.datasource.url}")
    private String jdbcUrl;

    @Value("${spring.datasource.username}")
    private String username;

    @Value("${spring.datasource.password}")
    private String password;

    @Value("${spring.datasource.hikari.pool-name:APIVitalsPool}")
    private String poolName;

    @Value("${spring.datasource.hikari.minimum-idle:5}")
    private int minimumIdle;

    @Value("${spring.datasource.hikari.maximum-pool-size:20}")
    private int maximumPoolSize;

    @Value("${spring.datasource.hikari.idle-timeout:600000}")
    private long idleTimeout;

    @Value("${spring.datasource.hikari.connection-timeout:30000}")
    private long connectionTimeout;

    @Value("${spring.datasource.hikari.max-lifetime:1800000}")
    private long maxLifetime;

    @Value("${spring.datasource.hikari.keepalive-time:60000}")
    private long keepaliveTime;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");

        // Pool sizing
        config.setPoolName(poolName);
        config.setMinimumIdle(minimumIdle);
        config.setMaximumPoolSize(maximumPoolSize);

        // Timeouts
        config.setIdleTimeout(idleTimeout);
        config.setConnectionTimeout(connectionTimeout);
        config.setMaxLifetime(maxLifetime);
        config.setKeepaliveTime(keepaliveTime);

        // Validation
        config.setConnectionTestQuery("SELECT 1");
        config.setInitializationFailTimeout(10_000); // fail fast if DB unreachable

        // Performance: MySQL-specific settings
        config.addDataSourceProperty("cachePrepStmts",          "true");
        config.addDataSourceProperty("prepStmtCacheSize",       "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit",   "2048");
        config.addDataSourceProperty("useServerPrepStmts",      "true");
        config.addDataSourceProperty("useLocalSessionState",    "true");
        config.addDataSourceProperty("rewriteBatchedStatements","true");
        config.addDataSourceProperty("cacheResultSetMetadata",  "true");
        config.addDataSourceProperty("cacheServerConfiguration","true");
        config.addDataSourceProperty("elideSetAutoCommits",     "true");
        config.addDataSourceProperty("maintainTimeStats",       "false");

        return new HikariDataSource(config);
    }
}

