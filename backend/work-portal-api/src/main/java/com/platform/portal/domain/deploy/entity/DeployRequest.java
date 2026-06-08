package com.platform.portal.domain.deploy.entity;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.entity.SubSystem;
import com.platform.portal.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "deploy_requests")
@Getter
@Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class DeployRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "system_id", nullable = false)
    private OperationSystem system;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_system_id")
    private SubSystem subSystem;

    @Column(length = 20, unique = true)
    private String deployNo;

    @Column(nullable = false)
    private String title;

    private String version;

    @Enumerated(EnumType.STRING)
    private DeployType deployType;

    @Enumerated(EnumType.STRING)
    private DeployScope deployScope;

    private String deployTarget;

    @Column(columnDefinition = "TEXT")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    private User approver;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    @OneToMany(mappedBy = "deployRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DeployRequestIssue> redmineIssues = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private RedmineSyncStatus redmineSyncStatus;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;
    @Column(columnDefinition = "TEXT")
    private String actionComment;

    private LocalDateTime scheduledAt;
    private LocalDateTime requestedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime deployedAt;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum Status {
        DRAFT, REQUESTED, APPROVED, COMPLETED, REJECTED
    }

    public enum DeployType {
        RELEASE, HOTFIX, ROLLBACK, PATCH
    }

    public enum DeployScope {
        FULL, PARTIAL
    }

    public enum RedmineSyncStatus {
        SYNCED, FAILED, SKIPPED
    }
}
