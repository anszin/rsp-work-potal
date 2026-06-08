package com.platform.portal.domain.request.entity;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.entity.SubSystem;
import com.platform.portal.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "change_requests")
@Getter
@Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class ChangeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "system_id", nullable = false)
    private OperationSystem system;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_system_id")
    private SubSystem subSystem;

    @Column(unique = true, length = 20)
    private String requestNo;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    private String requesterDept;
    private String requesterName;
    private LocalDate targetDate;
    private String attachmentLink;
    private String attachmentPath;
    private String attachmentOriginalName;
    @Column(columnDefinition = "TEXT")
    private String rejectionReason;
    @Column(columnDefinition = "TEXT")
    private String actionComment;
    private LocalDateTime requestedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime completedAt;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum Status {
        DRAFT, REQUESTED, APPROVED, COMPLETED, REJECTED
    }
}
