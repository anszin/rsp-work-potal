package com.platform.portal.domain.report.repository;

import com.platform.portal.domain.report.entity.WeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WeeklyReportRepository extends JpaRepository<WeeklyReport, Long> {

    List<WeeklyReport> findAllByOrderByWeekStartDescCreatedAtDesc();

    List<WeeklyReport> findByReportTypeOrderByWeekStartDescCreatedAtDesc(WeeklyReport.ReportType type);

    List<WeeklyReport> findByAuthorAndReportTypeOrderByWeekStartDescCreatedAtDesc(String author, WeeklyReport.ReportType type);

    List<WeeklyReport> findByWeekStartAndReportTypeOrderByCreatedAtDesc(LocalDate weekStart, WeeklyReport.ReportType type);

    Optional<WeeklyReport> findByWeekStartAndReportType(LocalDate weekStart, WeeklyReport.ReportType type);
}
