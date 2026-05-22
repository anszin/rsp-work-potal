package com.platform.portal.domain.report.repository;

import com.platform.portal.domain.report.entity.WeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WeeklyReportRepository extends JpaRepository<WeeklyReport, Long> {
    List<WeeklyReport> findAllByOrderByWeekStartDescCreatedAtDesc();
}
