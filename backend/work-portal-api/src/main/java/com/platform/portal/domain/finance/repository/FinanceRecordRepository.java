package com.platform.portal.domain.finance.repository;

import com.platform.portal.domain.finance.entity.FinanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FinanceRecordRepository extends JpaRepository<FinanceRecord, Long> {

    List<FinanceRecord> findByYearAndMonthOrderByCreatedAtDesc(int year, int month);

    List<FinanceRecord> findByYearOrderByMonthAscCreatedAtDesc(int year);

    @Query("""
        SELECT f.month,
               SUM(CASE WHEN f.category = 'REVENUE' THEN f.amount ELSE 0 END),
               SUM(CASE WHEN f.category = 'EXPENSE' THEN f.amount ELSE 0 END)
        FROM FinanceRecord f
        WHERE f.year = :year
        GROUP BY f.month
        ORDER BY f.month
        """)
    List<Object[]> findMonthlySummary(int year);

    @Query("SELECT DISTINCT f.year FROM FinanceRecord f ORDER BY f.year DESC")
    List<Integer> findDistinctYears();
}
