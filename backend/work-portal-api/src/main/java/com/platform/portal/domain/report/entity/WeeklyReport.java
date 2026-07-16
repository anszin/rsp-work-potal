package com.platform.portal.domain.report.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "weekly_reports")
@Getter
@Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class WeeklyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private LocalDate weekStart;

    @Column(nullable = false)
    private LocalDate weekEnd;

    @Column(columnDefinition = "TEXT")
    private String thisWeekWork;

    @Column(columnDefinition = "TEXT")
    private String thisWeekProposal;

    @Column(columnDefinition = "TEXT")
    private String thisWeekEtc;

    @Column(columnDefinition = "TEXT")
    private String nextWeekWork;

    @Column(columnDefinition = "TEXT")
    private String nextWeekProposal;

    @Column(columnDefinition = "TEXT")
    private String nextWeekEtc;

    @Column(nullable = false)
    private String author;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
