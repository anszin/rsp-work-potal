package com.platform.portal.domain.finance.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "finance_records")
@Getter
@Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class FinanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "record_year", nullable = false)
    private Integer year;

    @Column(name = "record_month", nullable = false)
    private Integer month;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false)
    private Long amount;

    private String note;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum Category {
        REVENUE, EXPENSE
    }
}
