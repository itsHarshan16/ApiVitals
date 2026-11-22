package com.apimonitor.backend.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * JPA Entity mapping to `monitoring_results` table.
 *
 * Developer A — Day 2
 * Commit: feat(db): configure spring data jpa and datasource connection pooling
 */
@Entity
@Table(
    name = "monitoring_results",
    indexes = {
        @Index(name = "idx_results_endpoint_id", columnList = "endpoint_id"),
        @Index(name = "idx_results_checked_at",  columnList = "checked_at"),
        @Index(name = "idx_results_is_up",        columnList = "is_up")
    }
)
public class MonitoringResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "endpoint_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_results_endpoint"))
    private MonitoredEndpoint endpoint;

    @Column(name = "is_up", nullable = false)
    private Boolean isUp;

    @Column(name = "status_code")
    private Integer statusCode;

    /** Round-trip response time in milliseconds */
    @Column(name = "response_time_ms")
    private Long responseTimeMs;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "checked_at", nullable = false, updatable = false)
    private LocalDateTime checkedAt;

    protected MonitoringResult() {}

    public MonitoringResult(MonitoredEndpoint endpoint, boolean isUp,
                            Integer statusCode, Long responseTimeMs,
                            String errorMessage) {
        this.endpoint       = endpoint;
        this.isUp           = isUp;
        this.statusCode     = statusCode;
        this.responseTimeMs = responseTimeMs;
        this.errorMessage   = errorMessage;
    }

    // Getters
    public Long              getId()             { return id; }
    public MonitoredEndpoint getEndpoint()       { return endpoint; }
    public Boolean           getIsUp()           { return isUp; }
    public Integer           getStatusCode()     { return statusCode; }
    public Long              getResponseTimeMs() { return responseTimeMs; }
    public String            getErrorMessage()   { return errorMessage; }
    public LocalDateTime     getCheckedAt()      { return checkedAt; }
}

