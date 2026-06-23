package com.platform.portal.domain.keytask.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "key_tasks")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class KeyTask {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer year;

    private String taskLevel; // "팀" | "담당부서" | "담당자"
    private String teamName;
    private String assigneeName;

    private String kpi;

    @Column(nullable = false)
    private String taskName;

    @Column(columnDefinition = "TEXT") private String q1Plan;
    @Column(columnDefinition = "TEXT") private String q2Plan;
    @Column(columnDefinition = "TEXT") private String q3Plan;
    @Column(columnDefinition = "TEXT") private String q4Plan;

    @Column(columnDefinition = "TEXT") private String q1Result;
    @Column(columnDefinition = "TEXT") private String q2Result;
    @Column(columnDefinition = "TEXT") private String q3Result;
    @Column(columnDefinition = "TEXT") private String q4Result;

    private String q1Achievement;
    private String q2Achievement;
    private String q3Achievement;
    private String q4Achievement;

    @Column(columnDefinition = "TEXT") private String q1Reason;
    @Column(columnDefinition = "TEXT") private String q2Reason;
    @Column(columnDefinition = "TEXT") private String q3Reason;
    @Column(columnDefinition = "TEXT") private String q4Reason;

    private Integer sortOrder;

    @CreatedDate @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
