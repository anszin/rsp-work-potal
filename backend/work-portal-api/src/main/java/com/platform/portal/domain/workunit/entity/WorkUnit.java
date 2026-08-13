package com.platform.portal.domain.workunit.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "work_units")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class WorkUnit {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long keyTaskId;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type = Type.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.IN_PROGRESS;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreatedDate @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum Type { PROJECT, OPERATION, OTHER }
    public enum Status { IN_PROGRESS, ON_HOLD, DONE }
}
