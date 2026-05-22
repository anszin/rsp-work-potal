package com.platform.portal.domain.report.entity;

import com.platform.portal.domain.system.entity.OperationSystem;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_check_reports")
@Getter
@Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class DailyCheckReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "system_id", nullable = false)
    private OperationSystem system;

    @Column(nullable = false)
    private LocalDate checkDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CheckStatus status;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = false)
    private String reporter;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum CheckStatus {
        NORMAL, WARNING, CRITICAL
    }
}
