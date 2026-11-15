package com.apimonitor.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA Entity mapping to `monitored_endpoints` table.
 *
 * Developer A — Day 2
 * Commit: feat(db): configure spring data jpa and datasource connection pooling
 */
@Entity
@Table(
    name = "monitored_endpoints",
    indexes = {
        @Index(name = "idx_endpoints_user_id",   columnList = "user_id"),
        @Index(name = "idx_endpoints_is_active",  columnList = "is_active")
    }
)
public class MonitoredEndpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    // FK → users.id
    @NotNull(message = "User is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_endpoints_user"))
    private User user;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @NotBlank(message = "URL is required")
    @Size(max = 2048, message = "URL must not exceed 2048 characters")
    @Column(name = "url", nullable = false, length = 2048)
    private String url;

    public enum HttpMethod { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS }

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "http_method", nullable = false, length = 10,
            columnDefinition = "ENUM('GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS') DEFAULT 'GET'")
    private HttpMethod httpMethod = HttpMethod.GET;

    /** Polling interval in seconds. Min 10s to avoid hammering targets. */
    @Min(value = 10, message = "Check interval must be at least 10 seconds")
    @Max(value = 86400, message = "Check interval must not exceed 86400 seconds (24h)")
    @Column(name = "check_interval_seconds", nullable = false)
    private Integer checkIntervalSeconds = 60;

    /** Expected HTTP status code — null means any 2xx is considered healthy */
    @Column(name = "expected_status_code")
    private Integer expectedStatusCode;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "endpoint", cascade = CascadeType.ALL,
               orphanRemoval = true, fetch = FetchType.LAZY)
    private List<MonitoringResult> results = new ArrayList<>();

    protected MonitoredEndpoint() {}

    public MonitoredEndpoint(User user, String name, String url) {
        this.user = user;
        this.name = name;
        this.url  = url;
    }

    // Getters & Setters
    public Long         getId()                                     { return id; }
    public User         getUser()                                   { return user; }
    public void         setUser(User user)                          { this.user = user; }
    public String       getName()                                   { return name; }
    public void         setName(String name)                        { this.name = name; }
    public String       getUrl()                                    { return url; }
    public void         setUrl(String url)                          { this.url = url; }
    public HttpMethod   getHttpMethod()                             { return httpMethod; }
    public void         setHttpMethod(HttpMethod m)                 { this.httpMethod = m; }
    public Integer      getCheckIntervalSeconds()                   { return checkIntervalSeconds; }
    public void         setCheckIntervalSeconds(Integer s)          { this.checkIntervalSeconds = s; }
    public Integer      getExpectedStatusCode()                     { return expectedStatusCode; }
    public void         setExpectedStatusCode(Integer code)         { this.expectedStatusCode = code; }
    public Boolean      getIsActive()                               { return isActive; }
    public void         setIsActive(Boolean active)                 { this.isActive = active; }
    public LocalDateTime getCreatedAt()                             { return createdAt; }
    public LocalDateTime getUpdatedAt()                             { return updatedAt; }
    public List<MonitoringResult> getResults()                      { return results; }
}

